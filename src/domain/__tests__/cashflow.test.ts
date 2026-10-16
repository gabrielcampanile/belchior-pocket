import { describe, expect, it } from "vitest";
import {
  budgetProgress,
  budgetStatus,
  cashflowByMonth,
  monthCashflow,
  monthElapsedRatio,
  summarizePeriod,
  UNCATEGORIZED_LABEL,
  type CashflowCategory,
  type CashflowTransaction,
} from "@/domain/cashflow";
import type { MoneyConverter } from "@/domain/exchange";

const cat = (
  id: string,
  kind: "INCOME" | "EXPENSE",
  monthlyBudgetCents: number | null = null,
): CashflowCategory => ({ id, name: id, kind, monthlyBudgetCents, color: null });

const tx = (
  type: string,
  amountCents: number,
  categoryId: string | null,
  extra: Partial<CashflowTransaction> = {},
): CashflowTransaction => ({
  type,
  amountCents,
  categoryId,
  currency: "BRL",
  occurredOn: "2026-10-05",
  ...extra,
});

const categories = [
  cat("Salário", "INCOME"),
  cat("Mercado", "EXPENSE", 100_000),
  cat("Lazer", "EXPENSE", 50_000),
  cat("Moradia", "EXPENSE"),
];

describe("cashflow: monthCashflow", () => {
  it("1. soma receitas e despesas e ignora transferência, fatura e aporte", () => {
    const flow = monthCashflow(
      [
        tx("INCOME", 1_000_000, "Salário"),
        tx("EXPENSE", -30_000, "Mercado"),
        tx("EXPENSE", -20_000, "Mercado"),
        tx("TRANSFER", -500_000, null),
        tx("CARD_PAYMENT", -383_223, null),
        tx("INVESTMENT_CONTRIBUTION", -250_000, null),
      ],
      categories,
    );
    expect(flow.incomeCents).toBe(1_000_000);
    expect(flow.expenseCents).toBe(50_000);
    expect(flow.balanceCents).toBe(950_000);
  });

  it("2. agrupa por categoria, ordena do maior pro menor e calcula a fatia", () => {
    const flow = monthCashflow(
      [
        tx("EXPENSE", -10_000, "Lazer"),
        tx("EXPENSE", -30_000, "Mercado"),
        tx("EXPENSE", -10_000, null),
      ],
      categories,
    );
    expect(flow.expense.map((r) => r.name)).toEqual(["Mercado", "Lazer", UNCATEGORIZED_LABEL]);
    expect(flow.expense[0].share).toBeCloseTo(0.6);
  });

  it("3. transação oculta não entra em nenhum total", () => {
    const flow = monthCashflow(
      [tx("EXPENSE", -10_000, "Lazer", { hidden: true }), tx("EXPENSE", -5_000, "Lazer")],
      categories,
    );
    expect(flow.expenseCents).toBe(5_000);
  });

  it("4. converte cada valor na data da transação antes de somar", () => {
    const seen: string[] = [];
    const convert: MoneyConverter = (m, onDate) => {
      seen.push(`${m.currency}@${onDate}`);
      return m.currency === "CAD" ? m.amountCents * 4 : m.amountCents;
    };
    const flow = monthCashflow(
      [tx("EXPENSE", -1_000, "Lazer", { currency: "CAD", occurredOn: "2026-10-02" })],
      categories,
      convert,
    );
    expect(flow.expenseCents).toBe(4_000);
    expect(seen).toEqual(["CAD@2026-10-02"]);
  });

  it("5. categoria apagada vira 'Sem categoria'", () => {
    const flow = monthCashflow([tx("EXPENSE", -1_000, "apagada")], categories);
    expect(flow.expense).toEqual([
      { categoryId: null, name: UNCATEGORIZED_LABEL, totalCents: 1_000, share: 1 },
    ]);
  });

  it("5b. estorno (despesa positiva) reduz o gasto da categoria", () => {
    const flow = monthCashflow(
      [tx("EXPENSE", -30_000, "Lazer"), tx("EXPENSE", 10_000, "Lazer")],
      categories,
    );
    expect(flow.expenseCents).toBe(20_000);
    expect(flow.expense[0].totalCents).toBe(20_000);
  });
});

describe("cashflow: orçamento", () => {
  it("6. status: abaixo de 80% ok, 80% alerta, 100% estourado, sem orçamento none", () => {
    expect(budgetStatus(79_999, 100_000)).toBe("ok");
    expect(budgetStatus(80_000, 100_000)).toBe("warning");
    expect(budgetStatus(100_000, 100_000)).toBe("over");
    expect(budgetStatus(10, null)).toBe("none");
    expect(budgetStatus(10, 0)).toBe("over");
  });

  it("7. total do orçamento soma as categorias e compara com TODAS as despesas", () => {
    const flow = monthCashflow(
      [
        tx("EXPENSE", -90_000, "Mercado"),
        tx("EXPENSE", -10_000, "Lazer"),
        tx("EXPENSE", -50_000, "Moradia"),
      ],
      categories,
    );
    const budget = budgetProgress(flow, categories);
    expect(budget.totalBudgetCents).toBe(150_000);
    expect(budget.totalSpentCents).toBe(150_000);
    expect(budget.ratio).toBe(1);
    expect(budget.status).toBe("over");
    expect(budget.remainingCents).toBe(0);
  });

  it("8. linhas: orçadas primeiro (mais consumida no topo), depois sem orçamento", () => {
    const flow = monthCashflow(
      [
        tx("EXPENSE", -90_000, "Mercado"),
        tx("EXPENSE", -5_000, "Moradia"),
        tx("EXPENSE", -1_000, null),
      ],
      categories,
    );
    const rows = budgetProgress(flow, categories).rows;
    expect(rows.map((r) => [r.name, r.status])).toEqual([
      ["Mercado", "warning"],
      ["Lazer", "ok"],
      ["Moradia", "none"],
      [UNCATEGORIZED_LABEL, "none"],
    ]);
    expect(rows[1].spentCents).toBe(0); // orçada sem gasto ainda aparece
  });

  it("9. sem nenhuma categoria orçada o total fica nulo", () => {
    const flow = monthCashflow([tx("EXPENSE", -1_000, "Moradia")], [cat("Moradia", "EXPENSE")]);
    const budget = budgetProgress(flow, [cat("Moradia", "EXPENSE")]);
    expect(budget.totalBudgetCents).toBeNull();
    expect(budget.status).toBe("none");
  });

  it("10. ritmo do mês", () => {
    expect(monthElapsedRatio("2026-10-01", "2026-10-16")).toBeCloseTo(16 / 31);
    expect(monthElapsedRatio("2026-09-01", "2026-10-16")).toBe(1);
    expect(monthElapsedRatio("2026-11-01", "2026-10-16")).toBe(0);
  });
});

describe("cashflow: histórico", () => {
  it("11. um ponto por mês, na ordem pedida, com meses vazios zerados", () => {
    const points = cashflowByMonth(
      [
        tx("INCOME", 500_000, "Salário", { occurredOn: "2026-08-05" }),
        tx("EXPENSE", -100_000, "Mercado", { occurredOn: "2026-08-20" }),
        tx("EXPENSE", -40_000, "Lazer", { occurredOn: "2026-10-01" }),
        tx("EXPENSE", -99_000, "Lazer", { occurredOn: "2026-05-01" }), // fora do período
      ],
      ["2026-08-01", "2026-09-01", "2026-10-01"],
      categories,
    );
    expect(points.map((p) => [p.month, p.incomeCents, p.expenseCents])).toEqual([
      ["2026-08-01", 500_000, 100_000],
      ["2026-09-01", 0, 0],
      ["2026-10-01", 0, 40_000],
    ]);
    expect(points[0].savingsRatio).toBeCloseTo(0.8);
    expect(points[2].savingsRatio).toBeNull();
  });

  it("12. resumo do período soma e tira a média contando meses vazios", () => {
    const s = summarizePeriod([
      { month: "a", incomeCents: 300, expenseCents: 100, balanceCents: 200, savingsRatio: null },
      { month: "b", incomeCents: 0, expenseCents: 0, balanceCents: 0, savingsRatio: null },
    ]);
    expect(s).toEqual({
      incomeCents: 300,
      expenseCents: 100,
      balanceCents: 200,
      avgIncomeCents: 150,
      avgExpenseCents: 50,
    });
  });
});
