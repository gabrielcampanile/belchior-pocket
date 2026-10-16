import { describe, expect, it } from "vitest";
import {
  categoryKindFor,
  categoryLabel,
  mappingKey,
  nameKey,
  planCategoryResolution,
  topLevelCategoryId,
  UNCATEGORIZED_PROVIDER_ID,
} from "../categories";
import { classifyTxType } from "../adapter";
import { planStalePendingRemovals } from "../sync";
import { parseItemIds, transactionsPageUrl } from "../pluggy.request";
import type { PluggyCategory } from "../pluggy.types";
import type { ExistingTransaction } from "../sync.types";

const catalog = new Map<string, PluggyCategory>([
  ["17000000", { id: "17000000", description: "Housing", descriptionTranslated: "Moradia" }],
  ["05000000", { id: "05000000", description: "Transfers", descriptionTranslated: null }],
]);

describe("categorias: agrupamento e nome", () => {
  it("1. agrupa pelo nível de topo do Pluggy", () => {
    expect(topLevelCategoryId("17030000")).toBe("17000000");
    expect(topLevelCategoryId("05070000")).toBe("05000000");
    expect(topLevelCategoryId("abc")).toBe("abc");
  });

  it("2. nome em português, com fallback para o inglês e para 'Outros'", () => {
    expect(categoryLabel("17000000", catalog)).toBe("Moradia");
    expect(categoryLabel("05000000", catalog)).toBe("Transfers");
    expect(categoryLabel("99000000", catalog)).toBe("Outros");
    expect(categoryLabel(UNCATEGORIZED_PROVIDER_ID, catalog)).toBe("Outros");
  });

  it("3. só receita e despesa recebem categoria", () => {
    expect(categoryKindFor("INCOME")).toBe("INCOME");
    expect(categoryKindFor("EXPENSE")).toBe("EXPENSE");
    expect(categoryKindFor("TRANSFER")).toBeNull();
    expect(categoryKindFor("CARD_PAYMENT")).toBeNull();
    expect(categoryKindFor("INVESTMENT_CONTRIBUTION")).toBeNull();
  });
});

describe("categorias: planCategoryResolution", () => {
  it("4. grupo novo cria categoria e mapeamento, uma vez só", () => {
    const plan = planCategoryResolution(
      [
        { kind: "EXPENSE", providerCategoryId: "17000000" },
        { kind: "EXPENSE", providerCategoryId: "17000000" },
      ],
      new Set(),
      new Set(),
      catalog,
    );
    expect(plan.categoriesToCreate).toEqual([{ kind: "EXPENSE", name: "Moradia" }]);
    expect(plan.mappingsToCreate).toEqual([
      { kind: "EXPENSE", providerCategoryId: "17000000", name: "Moradia" },
    ]);
  });

  it("5. grupo já mapeado não gera nada (o usuário pode ter renomeado a categoria)", () => {
    const plan = planCategoryResolution(
      [{ kind: "EXPENSE", providerCategoryId: "17000000" }],
      new Set([mappingKey("EXPENSE", "17000000")]),
      new Set(),
      catalog,
    );
    expect(plan.categoriesToCreate).toHaveLength(0);
    expect(plan.mappingsToCreate).toHaveLength(0);
  });

  it("6. reaproveita categoria existente com o mesmo nome (sem diferenciar maiúsculas)", () => {
    const plan = planCategoryResolution(
      [{ kind: "EXPENSE", providerCategoryId: "17000000" }],
      new Set(),
      new Set([nameKey("EXPENSE", "moradia")]),
      catalog,
    );
    expect(plan.categoriesToCreate).toHaveLength(0);
    expect(plan.mappingsToCreate).toHaveLength(1);
  });

  it("7. o mesmo grupo vira uma categoria de receita e outra de despesa", () => {
    const plan = planCategoryResolution(
      [
        { kind: "INCOME", providerCategoryId: "05000000" },
        { kind: "EXPENSE", providerCategoryId: "05000000" },
      ],
      new Set(),
      new Set(),
      catalog,
    );
    expect(plan.categoriesToCreate.map((c) => c.kind)).toEqual(["INCOME", "EXPENSE"]);
  });
});

describe("adapter: transferência própria e fatura", () => {
  it("8. 'Same person transfer' é sempre TRANSFER, nos dois sentidos", () => {
    expect(classifyTxType({ type: "CREDIT", category: "Same person transfer" })).toBe("TRANSFER");
    expect(classifyTxType({ type: "DEBIT", category: "Same person transfer" })).toBe("TRANSFER");
  });

  it("9. pagamento de fatura na conta corrente é CARD_PAYMENT (não é despesa duplicada)", () => {
    expect(classifyTxType({ type: "DEBIT", category: "Credit card payment" })).toBe("CARD_PAYMENT");
  });
});

describe("sync: pendentes que sumiram", () => {
  const tx = (
    id: string,
    status: "PENDING" | "POSTED",
    occurredOn: string,
    userOverridden = false,
  ) =>
    ({
      providerTxId: id,
      amountCents: -100,
      type: "EXPENSE",
      status,
      occurredOn,
      description: "x",
      userOverridden,
    }) satisfies ExistingTransaction;

  it("10. remove só pendentes não vistos, dentro da janela e não editados", () => {
    const existing = [
      tx("seen", "PENDING", "2026-10-10"),
      tx("gone", "PENDING", "2026-10-10"),
      tx("posted", "POSTED", "2026-10-10"),
      tx("edited", "PENDING", "2026-10-10", true),
      tx("old", "PENDING", "2026-08-01"),
    ];
    expect(planStalePendingRemovals(existing, new Set(["seen"]), "2026-09-15")).toEqual(["gone"]);
  });
});

describe("cliente Pluggy: config e cursor", () => {
  it("11. PLUGGY_ITEM_IDS aceita rótulo opcional e ignora repetidos", () => {
    expect(parseItemIds(" XP:item-1 , item-2,XP:item-1,, ")).toEqual([
      { itemId: "item-1", label: "XP" },
      { itemId: "item-2", label: null },
    ]);
    expect(parseItemIds(undefined)).toEqual([]);
  });

  it("12. primeira página usa accountId e dateFrom; as seguintes usam o `next`", () => {
    const first = transactionsPageUrl("acc-1", undefined, "2026-09-01");
    expect(first.toString()).toBe(
      "https://api.pluggy.ai/v2/transactions?accountId=acc-1&dateFrom=2026-09-01",
    );
    const next = transactionsPageUrl("acc-1", "?accountId=acc-1&after=abc");
    expect(next.toString()).toBe("https://api.pluggy.ai/v2/transactions?accountId=acc-1&after=abc");
  });

  it("13. cursor adulterado não muda host nem caminho", () => {
    expect(() => transactionsPageUrl("a", "//evil.example/x")).toThrow();
    expect(() => transactionsPageUrl("a", "https://evil.example/")).toThrow();
    expect(() => transactionsPageUrl("a", "?x=1#")).not.toThrow();
  });
});
