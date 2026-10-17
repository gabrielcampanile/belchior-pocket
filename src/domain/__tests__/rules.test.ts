import { describe, expect, it } from "vitest";
import {
  applyRule,
  categorize,
  planRetroactivePatches,
  ruleMatches,
  suggestPattern,
  validateRule,
  type CategorizationRule,
} from "@/domain/rules";

const rule = (
  id: string,
  pattern: string,
  extra: Partial<CategorizationRule> = {},
): CategorizationRule => ({
  id,
  pattern,
  direction: "ANY",
  setType: null,
  categoryId: null,
  createdAt: `2026-10-0${id.length}T00:00:00Z`,
  ...extra,
});

describe("rules: casamento", () => {
  it("1. contém, sem acento e sem maiúsculas", () => {
    const r = rule("r", "acme ltda");
    expect(
      ruleMatches(r, { description: "PIX RECEBIDO ACME LTDA", amountCents: 1, type: "TRANSFER" }),
    ).toBe(true);
    expect(
      ruleMatches(rule("p", "padaria sao joao"), {
        description: "Padaria São João",
        amountCents: -1,
        type: "EXPENSE",
      }),
    ).toBe(true);
    expect(ruleMatches(r, { description: "ACME SA", amountCents: 1, type: "INCOME" })).toBe(false);
  });

  it("2. direção: só entradas / só saídas", () => {
    const inOnly = rule("r", "joao", { direction: "IN" });
    expect(ruleMatches(inOnly, { description: "PIX JOAO", amountCents: 500, type: "INCOME" })).toBe(
      true,
    );
    expect(
      ruleMatches(inOnly, { description: "PIX JOAO", amountCents: -500, type: "EXPENSE" }),
    ).toBe(false);
  });

  it("3. a regra mais específica (texto mais longo) vence; empate vai pra mais antiga", () => {
    const rules = [
      rule("a", "uber", { categoryId: "transporte" }),
      rule("bb", "uber eats", { categoryId: "restaurantes" }),
    ];
    expect(
      categorize(rules, { description: "UBER EATS *PEDIDO", amountCents: -1, type: "EXPENSE" })
        ?.categoryId,
    ).toBe("restaurantes");
    expect(
      categorize(rules, { description: "UBER *TRIP", amountCents: -1, type: "EXPENSE" })
        ?.categoryId,
    ).toBe("transporte");
    expect(
      categorize(rules, { description: "IFOOD", amountCents: -1, type: "EXPENSE" }),
    ).toBeNull();
  });
});

describe("rules: efeito", () => {
  it("4. salário que chegou como transferência vira receita positiva na categoria Salário", () => {
    const out = applyRule(rule("s", "acme ltda", { setType: "INCOME", categoryId: "salario" }), {
      description: "PIX ACME LTDA",
      amountCents: 900_000,
      type: "TRANSFER",
    });
    expect(out).toMatchObject({ type: "INCOME", amountCents: 900_000, categoryId: "salario" });
  });

  it("5. entrada classificada como despesa é estorno (positiva); saída vira negativa", () => {
    const toExpense = rule("e", "loja", { setType: "EXPENSE" });
    expect(
      applyRule(toExpense, { description: "LOJA", amountCents: 3_000, type: "INCOME" }).amountCents,
    ).toBe(3_000);
    expect(
      applyRule(toExpense, { description: "LOJA", amountCents: -3_000, type: "TRANSFER" })
        .amountCents,
    ).toBe(-3_000);
  });

  it("6. regra só de categoria mantém o tipo; tipo sem categoria limpa a categoria", () => {
    expect(
      applyRule(rule("c", "uber", { categoryId: "t" }), {
        description: "UBER",
        amountCents: -1,
        type: "EXPENSE",
      }),
    ).toMatchObject({ type: "EXPENSE", categoryId: "t" });
    expect(
      applyRule(rule("t", "xp", { setType: "TRANSFER", categoryId: "t" }), {
        description: "XP",
        amountCents: -1,
        type: "EXPENSE",
      }).categoryId,
    ).toBeNull();
    expect(
      applyRule(rule("o", "uber", { setType: "EXPENSE" }), {
        description: "UBER",
        amountCents: -1,
        type: "EXPENSE",
      }).categoryId,
    ).toBeUndefined();
  });

  it("7. validação", () => {
    expect(validateRule({ pattern: "ab", setType: "INCOME", categoryId: null })).not.toBeNull();
    expect(validateRule({ pattern: "acme", setType: null, categoryId: null })).not.toBeNull();
    expect(validateRule({ pattern: "acme", setType: null, categoryId: "c" })).toBeNull();
  });

  it("8. sugestão de texto tira datas, números longos e asteriscos", () => {
    expect(suggestPattern("PIX RECEBIDO 12/10 ACME LTDA 0012345")).toBe("pix recebido acme ltda");
    expect(suggestPattern("UBER *TRIP HELP.UBER.COM")).toBe("uber trip help.uber.com");
  });
});

describe("rules: aplicação retroativa", () => {
  const base = { source: "IMPORT", userOverridden: false, categoryId: null as string | null };
  const salary = rule("s", "acme", { setType: "INCOME", categoryId: "salario" });

  it("9. corrige o passado, mas não toca em edição manual, lançamento manual nem no que já está certo", () => {
    const patches = planRetroactivePatches(
      [salary],
      [
        { ...base, id: "1", description: "PIX ACME", amountCents: 900_000, type: "TRANSFER" },
        {
          ...base,
          id: "2",
          description: "PIX ACME",
          amountCents: 900_000,
          type: "TRANSFER",
          userOverridden: true,
        },
        {
          ...base,
          id: "3",
          description: "PIX ACME",
          amountCents: 900_000,
          type: "TRANSFER",
          source: "MANUAL",
        },
        {
          ...base,
          id: "4",
          description: "PIX ACME",
          amountCents: 900_000,
          type: "INCOME",
          categoryId: "salario",
        },
        { ...base, id: "5", description: "MERCADO", amountCents: -1_000, type: "EXPENSE" },
      ],
    );
    expect(patches).toEqual([
      { id: "1", type: "INCOME", categoryId: "salario", amountCents: 900_000 },
    ]);
  });

  it("10. regra só de tipo que troca despesa por receita limpa a categoria de despesa", () => {
    const patches = planRetroactivePatches(
      [rule("r", "reembolso", { setType: "INCOME" })],
      [
        {
          ...base,
          id: "1",
          description: "REEMBOLSO",
          amountCents: -500,
          type: "EXPENSE",
          categoryId: "mercado",
        },
      ],
    );
    expect(patches).toEqual([{ id: "1", type: "INCOME", categoryId: null, amountCents: 500 }]);
  });
});
