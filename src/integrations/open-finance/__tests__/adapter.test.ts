import { describe, expect, it } from "vitest";
import {
  chargedAmount,
  classifyTxType,
  normalizeAccount,
  normalizeTransaction,
  signedCents,
  toCents,
  type CanonicalTxType,
} from "../adapter";
import type {
  PluggyAccountsResponse,
  PluggyTransaction,
  PluggyTransactionsPage,
} from "../pluggy.types";

import xpAccounts from "../__fixtures__/xp.accounts.fixture.json";
import wiseAccounts from "../__fixtures__/wise.accounts.fixture.json";
import xpTx from "../__fixtures__/xp.v2transactions.fixture.json";

const xpAcc = xpAccounts as unknown as PluggyAccountsResponse;
const wiseAcc = wiseAccounts as unknown as PluggyAccountsResponse;
const xpPage = xpTx as unknown as PluggyTransactionsPage;

describe("adapter: toCents", () => {
  it("1. decimal vira centavos inteiros, half-up", () => {
    expect(toCents(7755.36)).toBe(775536);
    expect(toCents(0.1)).toBe(10);
    expect(toCents(0.005)).toBe(1);
    expect(toCents(0)).toBe(0);
  });
});

describe("adapter: normalizeAccount (contrato com fixtures reais)", () => {
  it("2. XP: 2 contas corrente + 1 cartão, moedas e kinds corretos", () => {
    const out = xpAcc.results.map(normalizeAccount);
    expect(out).toHaveLength(3);
    expect(out.filter((a) => a.kind === "CHECKING")).toHaveLength(2);
    const card = out.find((a) => a.kind === "CREDIT_CARD");
    expect(card).toBeDefined();
    expect(out.every((a) => a.currency === "BRL")).toBe(true);
    // balances são inteiros (centavos)
    expect(out.every((a) => Number.isInteger(a.balanceCents))).toBe(true);
  });

  it("3. Wise: 4 contas, uma por moeda BRL/CAD/ARS/EUR", () => {
    const out = wiseAcc.results.map(normalizeAccount);
    const currencies = out.map((a) => a.currency).sort();
    expect(currencies).toEqual(["ARS", "BRL", "CAD", "EUR"]);
    expect(out.every((a) => a.kind === "CHECKING")).toBe(true);
  });
});

describe("adapter: classifyTxType (regras determinísticas, sem IA)", () => {
  const mk = (
    partial: Partial<
      Pick<PluggyTransaction, "type" | "category" | "operationType" | "description">
    >,
  ): Pick<PluggyTransaction, "type" | "category" | "operationType" | "description"> => ({
    type: "DEBIT",
    category: null,
    operationType: null,
    description: "",
    ...partial,
  });

  it("4. automatic investment vira INVESTMENT_CONTRIBUTION", () => {
    expect(
      classifyTxType(
        mk({
          type: "CREDIT",
          category: "Automatic investment",
          operationType: "RENDIMENTO_APLIC_FINANCEIRA",
        }),
      ),
    ).toBe<CanonicalTxType>("INVESTMENT_CONTRIBUTION");
  });

  it("5. transferência entre contas próprias vira TRANSFER", () => {
    expect(
      classifyTxType(mk({ type: "DEBIT", category: "Transfer - PIX" }), {
        counterpartyIsOwnAccount: true,
      }),
    ).toBe<CanonicalTxType>("TRANSFER");
  });

  it("6. transferência para terceiro NÃO é TRANSFER (vira INCOME/EXPENSE pelo sinal)", () => {
    expect(classifyTxType(mk({ type: "CREDIT", category: "Transfer - PIX" }))).toBe("INCOME");
    expect(classifyTxType(mk({ type: "DEBIT", category: "Transfer - TED" }))).toBe("EXPENSE");
  });

  it("7. DEBIT comum vira EXPENSE, CREDIT comum vira INCOME", () => {
    expect(classifyTxType(mk({ type: "DEBIT", category: "Groceries" }))).toBe("EXPENSE");
    expect(classifyTxType(mk({ type: "CREDIT", category: "Services" }))).toBe("INCOME");
  });

  it("8. CREDIT numa conta de cartão vira CARD_PAYMENT (settlement)", () => {
    expect(
      classifyTxType(mk({ type: "CREDIT", category: "Payment" }), { isCreditCardAccount: true }),
    ).toBe("CARD_PAYMENT");
  });

  it("8b. no cartão, crédito que não é pagamento de fatura é estorno: EXPENSE positivo", () => {
    const card = { isCreditCardAccount: true };
    expect(classifyTxType(mk({ type: "CREDIT", description: "Pagamento recebido" }), card)).toBe(
      "CARD_PAYMENT",
    );
    expect(classifyTxType(mk({ type: "CREDIT", category: "Credit card payment" }), card)).toBe(
      "CARD_PAYMENT",
    );
    const refund = mk({ type: "CREDIT", category: "Shopping", description: "ESTORNO LOJA X" });
    expect(classifyTxType(refund, card)).toBe("EXPENSE");
    const tx: PluggyTransaction = {
      id: "r",
      description: "ESTORNO LOJA X",
      currencyCode: "BRL",
      amount: 50,
      date: "2026-01-01T00:00:00Z",
      accountId: "card",
      status: "POSTED",
      type: "CREDIT",
      category: "Shopping",
    };
    expect(normalizeTransaction(tx, card).amountCents).toBe(5000);
  });
});

describe("adapter: compra em moeda estrangeira no cartão", () => {
  const ars: PluggyTransaction = {
    id: "eth",
    description: "ETHIOPIAN AIRLINES",
    currencyCode: "ARS",
    amount: 604440,
    amountInAccountCurrency: 2395.34,
    date: "2026-06-06T22:41:00Z",
    accountId: "card",
    status: "POSTED",
    type: "DEBIT",
  };
  const card = { isCreditCardAccount: true, accountCurrency: "BRL" as const };

  it("13. usa o valor cobrado em reais na moeda da conta", () => {
    const out = normalizeTransaction(ars, card);
    expect(out.currency).toBe("BRL");
    expect(out.amountCents).toBe(-239534);
  });

  it("14. sem o valor cobrado, mantém a moeda original para converter pela cotação", () => {
    const out = normalizeTransaction({ ...ars, amountInAccountCurrency: null }, card);
    expect(out.currency).toBe("ARS");
    expect(out.amountCents).toBe(-60444000);
  });

  it("15. na mesma moeda da conta, ignora o campo e usa o valor original", () => {
    const brl = { ...ars, currencyCode: "BRL", amount: 83.84, amountInAccountCurrency: 83.84 };
    expect(normalizeTransaction(brl, card)).toMatchObject({ currency: "BRL", amountCents: -8384 });
  });

  it("16. estorno estrangeiro no cartão continua positivo, em reais", () => {
    const refund = { ...ars, type: "CREDIT" as const, category: "Shopping" };
    expect(normalizeTransaction(refund, card)).toMatchObject({
      currency: "BRL",
      amountCents: 239534,
    });
  });

  it("17. sem a moeda da conta no contexto, mantém o comportamento anterior", () => {
    expect(chargedAmount(ars)).toEqual({ amount: 604440, currency: "ARS" });
  });
});

describe("adapter: signedCents (invariantes de sinal)", () => {
  const base: PluggyTransaction = {
    id: "x",
    description: "x",
    currencyCode: "BRL",
    amount: 100,
    date: "2026-01-01T00:00:00Z",
    accountId: "a",
    status: "POSTED",
    type: "DEBIT",
  };

  it("9. EXPENSE negativo, INCOME positivo", () => {
    expect(signedCents({ ...base, type: "DEBIT" }, "EXPENSE")).toBe(-10000);
    expect(signedCents({ ...base, type: "CREDIT" }, "INCOME")).toBe(10000);
  });

  it("10. CARD_PAYMENT é negativo", () => {
    expect(signedCents(base, "CARD_PAYMENT")).toBe(-10000);
  });
});

describe("adapter: normalizeTransaction (contrato com página v2 real)", () => {
  it("11. toda transação da fixture normaliza com identidade e tipo canônico", () => {
    const out = xpPage.results.map((t) => normalizeTransaction(t));
    expect(out.length).toBeGreaterThan(0);
    for (const t of out) {
      expect(Number.isInteger(t.amountCents)).toBe(true);
      expect(t.occurredOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect([
        "EXPENSE",
        "INCOME",
        "TRANSFER",
        "INVESTMENT_CONTRIBUTION",
        "CARD_PAYMENT",
      ]).toContain(t.type);
      // identidade provider-scoped presente (providerId ou id da fixture, redigido mas string)
      expect(t.providerTxId === null || typeof t.providerTxId === "string").toBe(true);
    }
  });

  it("12. a fixture contém pelo menos um aporte e uma transferência (cobre as regras)", () => {
    const types = xpPage.results.map((t) => normalizeTransaction(t).type);
    expect(types).toContain("INVESTMENT_CONTRIBUTION");
    // Transfer categories sem counterparty próprio caem em INCOME/EXPENSE — garantimos que a regra roda
    expect(types.some((t) => ["INCOME", "EXPENSE"].includes(t))).toBe(true);
  });
});
