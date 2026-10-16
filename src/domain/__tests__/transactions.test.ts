import { describe, expect, it } from "vitest";
import {
  categoryKindForType,
  DEFAULT_FILTERS,
  filterTransactions,
  groupByDay,
  NO_CATEGORY,
  normalizeSearch,
  signedAmountForType,
  type ListTransaction,
} from "@/domain/transactions";

const row = (id: string, extra: Partial<ListTransaction> = {}): ListTransaction => ({
  id,
  accountId: "xp",
  description: id,
  notes: null,
  amountCents: -1_000,
  occurredOn: "2026-10-05",
  type: "EXPENSE",
  categoryId: "mercado",
  hidden: false,
  ...extra,
});

describe("transactions: sinal e categoria", () => {
  it("1. receita positiva, despesa e fatura negativas", () => {
    expect(signedAmountForType("INCOME", -500)).toBe(500);
    expect(signedAmountForType("EXPENSE", 500)).toBe(-500);
    expect(signedAmountForType("CARD_PAYMENT", 500)).toBe(-500);
    expect(signedAmountForType("EXPENSE", 500, undefined, { refund: true })).toBe(500);
  });

  it("2. transferência e aporte mantêm a direção original (saída por padrão)", () => {
    expect(signedAmountForType("TRANSFER", 500, 900)).toBe(500);
    expect(signedAmountForType("TRANSFER", 500, -900)).toBe(-500);
    expect(signedAmountForType("INVESTMENT_CONTRIBUTION", 500)).toBe(-500);
  });

  it("3. só receita e despesa recebem categoria", () => {
    expect(categoryKindForType("INCOME")).toBe("INCOME");
    expect(categoryKindForType("EXPENSE")).toBe("EXPENSE");
    expect(categoryKindForType("TRANSFER")).toBeNull();
    expect(categoryKindForType("CARD_PAYMENT")).toBeNull();
  });
});

describe("transactions: filtros", () => {
  const rows = [
    row("Padaria São João", { occurredOn: "2026-10-03" }),
    row("Uber", { categoryId: "transporte", occurredOn: "2026-10-07" }),
    row("Salário", { type: "INCOME", amountCents: 900_000, categoryId: null }),
    row("Oculta", { hidden: true }),
    row("Wise", { accountId: "wise", notes: "almoço com cliente" }),
  ];

  it("4. busca sem acento e sem maiúsculas, inclusive nas notas", () => {
    expect(normalizeSearch("  Café   PÃO ")).toBe("cafe pao");
    const ids = (s: string) =>
      filterTransactions(rows, { ...DEFAULT_FILTERS, search: s }).map((r) => r.id);
    expect(ids("sao joao")).toEqual(["Padaria São João"]);
    expect(ids("ALMOCO")).toEqual(["Wise"]);
  });

  it("5. ocultas só aparecem quando pedidas", () => {
    expect(filterTransactions(rows, DEFAULT_FILTERS).some((r) => r.hidden)).toBe(false);
    expect(
      filterTransactions(rows, { ...DEFAULT_FILTERS, showHidden: true }).some((r) => r.hidden),
    ).toBe(true);
  });

  it("6. conta, tipo, categoria e 'sem categoria'", () => {
    const f = (extra: Partial<typeof DEFAULT_FILTERS>) =>
      filterTransactions(rows, { ...DEFAULT_FILTERS, ...extra }).map((r) => r.id);
    expect(f({ accountId: "wise" })).toEqual(["Wise"]);
    expect(f({ type: "INCOME" })).toEqual(["Salário"]);
    expect(f({ categoryId: "transporte" })).toEqual(["Uber"]);
    expect(f({ categoryId: NO_CATEGORY })).toEqual(["Salário"]);
  });

  it("7. ordena do mais recente e agrupa por dia", () => {
    const sorted = filterTransactions(rows, DEFAULT_FILTERS);
    expect(sorted[0].id).toBe("Uber");
    expect(sorted[sorted.length - 1].id).toBe("Padaria São João");
    const groups = groupByDay(sorted);
    expect(groups.map((g) => g.day)).toEqual(["2026-10-07", "2026-10-05", "2026-10-03"]);
    expect(groups[1].rows.map((r) => r.id)).toEqual(["Salário", "Wise"]);
  });
});
