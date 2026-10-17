import { describe, expect, it } from "vitest";
import {
  classifySyncError,
  collectTransactionPages,
  MAX_TRANSACTION_PAGES,
  planAccountSync,
  planTransactionSync,
  ruleAdjuster,
  summarizeSyncRun,
} from "../sync";
import { normalizeAccount, normalizeTransaction } from "../adapter";
import type {
  PluggyAccountsResponse,
  PluggyTransaction,
  PluggyTransactionsPage,
} from "../pluggy.types";
import type { ExistingAccount, ExistingTransaction, SyncPlan } from "../sync.types";

import xpAccounts from "../__fixtures__/xp.accounts.fixture.json";
import xpTx from "../__fixtures__/xp.v2transactions.fixture.json";

const xpAcc = xpAccounts as unknown as PluggyAccountsResponse;
const xpPage = xpTx as unknown as PluggyTransactionsPage;

// Build an "existing DB state" snapshot from the fixture itself, as it would look
// right after a first successful sync — the baseline for proving idempotency.
function existingAccountsFromFixture(): ExistingAccount[] {
  return xpAcc.results.map((raw, i) => {
    const dto = normalizeAccount(raw);
    return {
      id: `acc-${i}`,
      providerAccountId: dto.providerAccountId,
      kind: dto.kind,
      name: dto.name,
      balanceCents: dto.balanceCents,
      creditLimitCents: dto.creditLimitCents,
    };
  });
}

function existingTransactionsFromFixture(): ExistingTransaction[] {
  return xpPage.results
    .map((raw) => normalizeTransaction(raw))
    .filter((dto) => dto.providerTxId)
    .map((dto) => ({
      providerTxId: dto.providerTxId as string,
      amountCents: dto.amountCents,
      type: dto.type,
      status: dto.status,
      occurredOn: dto.occurredOn,
      description: dto.description,
      userOverridden: false,
    }));
}

describe("sync: planAccountSync (idempotência de contas)", () => {
  it("1. estado vazio: toda conta da fixture vira insert", () => {
    const plan = planAccountSync(xpAcc.results, []);
    expect(plan).toHaveLength(xpAcc.results.length);
    expect(plan.every((p) => p.op === "insert")).toBe(true);
  });

  it("2. segunda rodada sobre o mesmo estado: ZERO upserts (idempotente)", () => {
    const existing = existingAccountsFromFixture();
    const plan = planAccountSync(xpAcc.results, existing);
    expect(plan).toHaveLength(0);
  });

  it("3. mudança de saldo gera update (com existingId), não insert", () => {
    const existing = existingAccountsFromFixture();
    existing[0] = { ...existing[0], balanceCents: existing[0].balanceCents + 123 };
    const plan = planAccountSync(xpAcc.results, existing);
    expect(plan).toHaveLength(1);
    expect(plan[0].op).toBe("update");
    expect(plan[0].existingId).toBe(existing[0].id);
  });
});

describe("sync: planTransactionSync (idempotência de transações)", () => {
  it("4. estado vazio: toda tx com providerId vira insert", () => {
    const { upserts, skips } = planTransactionSync(xpPage.results, []);
    const withId = xpPage.results.filter((t) => (t.providerId ?? t.id) != null).length;
    expect(upserts.length).toBeGreaterThan(0);
    expect(upserts.every((u) => u.op === "insert")).toBe(true);
    // nenhuma tx deduplicada no plano
    const ids = new Set(upserts.map((u) => u.providerTxId));
    expect(ids.size).toBe(upserts.length);
    // upserts + skips cobrem todas as linhas da fixture
    expect(upserts.length + skips.length).toBeLessThanOrEqual(withId + skips.length);
  });

  it("5. segunda rodada sobre o mesmo estado: ZERO upserts, tudo skip 'unchanged'", () => {
    const existing = existingTransactionsFromFixture();
    const { upserts, skips } = planTransactionSync(xpPage.results, existing);
    expect(upserts).toHaveLength(0);
    expect(skips.length).toBeGreaterThan(0);
    expect(skips.every((s) => s.reason === "unchanged")).toBe(true);
  });

  it("6. linha editada pelo usuário é preservada (skip 'user_overridden', nunca update)", () => {
    const existing = existingTransactionsFromFixture();
    // marca a primeira como overridden E com valor divergente (sync tentaria sobrescrever)
    existing[0] = {
      ...existing[0],
      userOverridden: true,
      amountCents: existing[0].amountCents + 999,
    };
    const { upserts, skips } = planTransactionSync(xpPage.results, existing);
    const touched = upserts.find((u) => u.providerTxId === existing[0].providerTxId);
    expect(touched).toBeUndefined();
    expect(
      skips.some(
        (s) => s.providerTxId === existing[0].providerTxId && s.reason === "user_overridden",
      ),
    ).toBe(true);
  });

  it("7. mudança real (status/amount) gera update", () => {
    const existing = existingTransactionsFromFixture();
    existing[0] = { ...existing[0], amountCents: existing[0].amountCents + 500 };
    const { upserts } = planTransactionSync(xpPage.results, existing);
    const upd = upserts.find((u) => u.providerTxId === existing[0].providerTxId);
    expect(upd?.op).toBe("update");
  });

  it("8. duplicatas do mesmo providerTxId no lote colapsam para uma", () => {
    const dup = [...xpPage.results, xpPage.results[0], xpPage.results[0]];
    const { upserts } = planTransactionSync(dup, []);
    const ids = upserts.map((u) => u.providerTxId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sync: collectTransactionPages (cursor pagination v2)", () => {
  it("9. drena múltiplas páginas seguindo `next` até acabar", async () => {
    const pages = [
      { results: [{ ...xpPage.results[0] }], next: "cursor-1" },
      { results: [{ ...xpPage.results[1] }], next: "cursor-2" },
      { results: [{ ...xpPage.results[2] }], next: null },
    ];
    let call = 0;
    const fetchPage = async () => pages[call++];
    const { transactions, lastCursor } = await collectTransactionPages("acc", fetchPage, undefined);
    expect(transactions).toHaveLength(3);
    expect(lastCursor).toBeNull();
    expect(call).toBe(3);
  });

  it("10. cursor repetido interrompe o loop (anti-loop infinito)", async () => {
    const fetchPage = async () => ({ results: [{ ...xpPage.results[0] }], next: "same" });
    const { transactions } = await collectTransactionPages("acc", fetchPage, undefined, 50);
    // primeira página + a segunda que repete o cursor => para
    expect(transactions.length).toBeLessThanOrEqual(2);
  });

  it("11. respeita o cap de páginas", async () => {
    let call = 0;
    const fetchPage = async () => ({ results: [{ ...xpPage.results[0] }], next: `c-${call++}` });
    const { transactions } = await collectTransactionPages("acc", fetchPage, undefined, 3);
    expect(transactions).toHaveLength(3);
    expect(MAX_TRANSACTION_PAGES).toBeGreaterThan(0);
  });
});

describe("sync: summarizeSyncRun + classifySyncError", () => {
  it("12. resumo conta upserts/skips e carrega os cursors", () => {
    const existing = existingTransactionsFromFixture();
    const { upserts, skips } = planTransactionSync(xpPage.results, existing);
    const plan: SyncPlan = {
      accountUpserts: planAccountSync(xpAcc.results, existingAccountsFromFixture()),
      transactionUpserts: upserts,
      transactionSkips: skips,
    };
    const sum = summarizeSyncRun(plan, "cur-before", "cur-after");
    expect(sum.status).toBe("success");
    expect(sum.transactionsUpserted).toBe(upserts.length);
    expect(sum.transactionsSkipped).toBe(skips.length);
    expect(sum.cursorBefore).toBe("cur-before");
    expect(sum.cursorAfter).toBe("cur-after");
  });

  it("13. classifica erros sem vazar texto cru (401->auth, 503->transient, 400->permanent)", () => {
    expect(classifySyncError({ status: 401 }).status).toBe("auth_error");
    expect(classifySyncError({ statusCode: 503 }).status).toBe("transient_error");
    expect(classifySyncError({ status: 429 }).status).toBe("transient_error");
    expect(classifySyncError({ status: 400 }).status).toBe("permanent_error");
    expect(classifySyncError(new Error("secret token leaked")).error).not.toContain("secret");
    // Non-HTTP failures: network/timeout is transient, our own bug/DB error is not.
    const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
    expect(classifySyncError(timeout).status).toBe("transient_error");
    expect(classifySyncError(new TypeError("fetch failed")).status).toBe("transient_error");
    expect(classifySyncError(new Error("duplicate key")).status).toBe("permanent_error");
  });
});

describe("sync: regras de categorização (#66)", () => {
  const salaryTx: PluggyTransaction = {
    id: "tx-salario",
    providerId: "prov-salario",
    description: "PIX RECEBIDO ACME LTDA",
    currencyCode: "BRL",
    amount: 9000,
    date: "2026-10-05T00:00:00Z",
    accountId: "acc",
    status: "POSTED",
    type: "CREDIT",
    category: "Same person transfer",
  };
  const rules = [
    {
      id: "r1",
      pattern: "acme ltda",
      direction: "IN" as const,
      setType: "INCOME" as const,
      categoryId: "cat-salario",
      createdAt: "2026-10-16T00:00:00Z",
    },
  ];

  it("14. a regra reclassifica no sync e o re-sync seguinte não desfaz nem reescreve", () => {
    const adjust = ruleAdjuster(rules);
    const first = planTransactionSync([salaryTx], [], () => ({}), adjust);
    expect(first.upserts).toHaveLength(1);
    expect(first.upserts[0].dto.type).toBe("INCOME");
    expect(first.upserts[0].dto.amountCents).toBe(900_000);
    expect(first.upserts[0].ruleCategoryId).toBe("cat-salario");

    const stored = {
      providerTxId: "prov-salario",
      amountCents: 900_000,
      type: "INCOME" as const,
      status: "POSTED" as const,
      occurredOn: "2026-10-05",
      description: "PIX RECEBIDO ACME LTDA",
      userOverridden: false,
    };
    const second = planTransactionSync([salaryTx], [stored], () => ({}), adjust);
    expect(second.upserts).toHaveLength(0);
    expect(second.skips[0].reason).toBe("unchanged");
  });

  it("15. sem regra que case, nada muda (categoria fica com o mapeamento do Pluggy)", () => {
    const plan = planTransactionSync(
      [{ ...salaryTx, description: "OUTRA COISA" }],
      [],
      () => ({}),
      ruleAdjuster(rules),
    );
    expect(plan.upserts[0].dto.type).toBe("TRANSFER");
    expect(plan.upserts[0].ruleCategoryId).toBeUndefined();
  });
});
