/**
 * Idempotent Open Finance sync CORE — PURE and deterministic (no I/O, no persistence).
 *
 * Responsibilities (BP-029/BP-030/BP-031/BP-032):
 *  - drain /v2/transactions cursor pages (the `next` field) with a hard page cap;
 *  - normalize via the P3 adapter;
 *  - produce an idempotent upsert PLAN keyed by provider identity:
 *      * accounts upsert by providerAccountId,
 *      * transactions upsert by providerTxId,
 *      * a row unchanged since last sync is SKIPPED (second run => no writes),
 *      * a user-overridden row is SKIPPED (sync never clobbers a manual edit),
 *      * a row without a provider id is SKIPPED (cannot be deduped safely);
 *  - summarize the run for sync_runs (counts, cursor before/after, status).
 *
 * The P5 shell implements the fetcher ports and applies the plan over supabase-js.
 */

import {
  normalizeAccount,
  normalizeTransaction,
  type CanonicalAccountDTO,
  type CanonicalTransactionDTO,
  type ClassifyContext,
} from "./adapter";
import type { PluggyTransaction } from "./pluggy.types";
import type {
  AccountFetcher,
  AccountUpsert,
  ExistingAccount,
  ExistingTransaction,
  SyncPlan,
  SyncRunSummary,
  SyncStatus,
  TransactionPageFetcher,
  TransactionSkip,
  TransactionUpsert,
} from "./sync.types";

/** Hard cap on cursor pages drained per account, so a broken cursor can't loop forever. */
export const MAX_TRANSACTION_PAGES = 500;

/**
 * Drain every /v2/transactions page for an account by following the opaque `next` cursor.
 * Stops when `next` is falsy, when a page is empty, or at MAX_TRANSACTION_PAGES.
 * Returns the collected rows and the LAST cursor seen (the resume point for next sync).
 */
export async function collectTransactionPages(
  accountId: string,
  fetchPage: TransactionPageFetcher,
  startCursor: string | undefined,
  maxPages: number = MAX_TRANSACTION_PAGES,
): Promise<{ transactions: PluggyTransaction[]; lastCursor: string | null }> {
  const transactions: PluggyTransaction[] = [];
  let cursor: string | undefined = startCursor;
  let lastCursor: string | null = startCursor ?? null;
  const seenCursors = new Set<string>();

  for (let page = 0; page < maxPages; page++) {
    const { results, next } = await fetchPage(accountId, cursor);
    if (results.length > 0) transactions.push(...results);

    if (!next) {
      lastCursor = next ?? null;
      break;
    }
    // Guard against a provider returning the same cursor forever.
    if (seenCursors.has(next)) break;
    seenCursors.add(next);

    lastCursor = next;
    cursor = next;
  }

  return { transactions, lastCursor };
}

// --- Account plan ----------------------------------------------------------

/**
 * Plan account upserts: insert when the provider account is new, update when a mapped
 * row exists AND a tracked field actually changed (so a no-op sync writes nothing).
 */
export function planAccountSync(
  rawAccounts: Parameters<typeof normalizeAccount>[0][],
  existing: ExistingAccount[],
): AccountUpsert[] {
  const byProvider = new Map(existing.map((a) => [a.providerAccountId, a]));
  const plan: AccountUpsert[] = [];

  for (const raw of rawAccounts) {
    const dto = normalizeAccount(raw);
    const prior = byProvider.get(dto.providerAccountId);
    if (!prior) {
      plan.push({ op: "insert", providerAccountId: dto.providerAccountId, dto });
      continue;
    }
    if (accountChanged(prior, dto)) {
      plan.push({
        op: "update",
        providerAccountId: dto.providerAccountId,
        dto,
        existingId: prior.id,
      });
    }
  }
  return plan;
}

function accountChanged(prior: ExistingAccount, dto: CanonicalAccountDTO): boolean {
  return (
    prior.kind !== dto.kind ||
    prior.name !== dto.name ||
    prior.balanceCents !== dto.balanceCents ||
    prior.creditLimitCents !== dto.creditLimitCents
  );
}

// --- Transaction plan ------------------------------------------------------

/**
 * Plan transaction upserts idempotently. For each raw tx:
 *  - no provider id  -> skip ('missing_provider_id'): can't dedupe safely;
 *  - user overrode it -> skip ('user_overridden'): never clobber a manual edit;
 *  - unchanged        -> skip ('unchanged'): a re-sync of the same data writes nothing;
 *  - new              -> insert;
 *  - changed          -> update.
 * Later duplicates of the same providerTxId within one batch collapse to the first.
 */
export function planTransactionSync(
  rawTransactions: PluggyTransaction[],
  existing: ExistingTransaction[],
  classify: (tx: PluggyTransaction) => ClassifyContext = () => ({}),
): { upserts: TransactionUpsert[]; skips: TransactionSkip[] } {
  const byProvider = new Map(existing.map((t) => [t.providerTxId, t]));
  const upserts: TransactionUpsert[] = [];
  const skips: TransactionSkip[] = [];
  const seen = new Set<string>();

  for (const raw of rawTransactions) {
    const dto = normalizeTransaction(raw, classify(raw));
    const id = dto.providerTxId;

    if (!id) {
      skips.push({ providerTxId: null, reason: "missing_provider_id" });
      continue;
    }
    if (seen.has(id)) continue; // collapse intra-batch duplicates
    seen.add(id);

    const prior = byProvider.get(id);
    if (prior?.userOverridden) {
      skips.push({ providerTxId: id, reason: "user_overridden" });
      continue;
    }
    if (!prior) {
      upserts.push({ op: "insert", providerTxId: id, dto });
      continue;
    }
    if (transactionChanged(prior, dto)) {
      upserts.push({ op: "update", providerTxId: id, dto });
    } else {
      skips.push({ providerTxId: id, reason: "unchanged" });
    }
  }

  return { upserts, skips };
}

function transactionChanged(prior: ExistingTransaction, dto: CanonicalTransactionDTO): boolean {
  return (
    prior.amountCents !== dto.amountCents || prior.type !== dto.type || prior.status !== dto.status
  );
}

// --- Run summary -----------------------------------------------------------

/** Build the sync_runs summary row from a completed plan. */
export function summarizeSyncRun(
  plan: SyncPlan,
  cursorBefore: string | null,
  cursorAfter: string | null,
  status: SyncStatus = "success",
  error: string | null = null,
): SyncRunSummary {
  return {
    status,
    accountsSynced: plan.accountUpserts.length,
    transactionsUpserted: plan.transactionUpserts.length,
    transactionsSkipped: plan.transactionSkips.length,
    cursorBefore,
    cursorAfter,
    error,
  };
}

/**
 * Classify a thrown provider error into a sanitized sync status. Never surfaces the raw
 * error text to the summary (tokens/payloads must not land in sync_runs.error).
 */
export function classifySyncError(err: unknown): { status: SyncStatus; error: string } {
  const status = Number(
    (err as { status?: number; statusCode?: number })?.status ??
      (err as { statusCode?: number })?.statusCode ??
      0,
  );
  if (status === 401 || status === 403) {
    return { status: "auth_error", error: "Provider authentication failed." };
  }
  if (status === 429 || (status >= 500 && status <= 599) || status === 0) {
    return { status: "transient_error", error: "Transient provider error; retry later." };
  }
  return { status: "permanent_error", error: "Permanent provider error." };
}
