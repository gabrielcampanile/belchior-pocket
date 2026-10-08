/**
 * Ports and state shapes for the idempotent Open Finance sync (BP-029/BP-031/BP-032).
 *
 * The sync CORE (./sync.ts) is PURE: it takes raw provider pages + a snapshot of the
 * current persisted state and returns an upsert PLAN plus a sync_runs summary. It does
 * NO I/O. The thin persistence shell (P5, over supabase-js) implements these fetcher
 * ports and applies the returned plan. Keeping the diff pure is what lets us test real
 * idempotency against the captured fixtures with no database.
 */

import type { CanonicalAccountDTO, CanonicalTransactionDTO } from "./adapter";
import type { PluggyAccount, PluggyTransaction } from "./pluggy.types";

// --- Fetcher ports (implemented by the P5 shell) ---------------------------

/** Fetches all accounts for a Pluggy item. */
export type AccountFetcher = (itemId: string) => Promise<PluggyAccount[]>;

/**
 * Fetches ONE page of /v2/transactions for an account. `cursor` is the opaque `next`
 * from the previous page (undefined on the first call). Returns the page's rows and the
 * next cursor (null/undefined => last page).
 */
export type TransactionPageFetcher = (
  accountId: string,
  cursor: string | undefined,
) => Promise<{ results: PluggyTransaction[]; next: string | null | undefined }>;

// --- Snapshot of current persisted state (read before planning) ------------

/** Minimal projection of an existing DB account row, keyed by provider id. */
export interface ExistingAccount {
  id: string; // internal uuid
  providerAccountId: string;
  kind: CanonicalAccountDTO["kind"];
  name: string;
  balanceCents: number;
  creditLimitCents: number | null;
}

/** Minimal projection of an existing DB transaction row, keyed by provider tx id. */
export interface ExistingTransaction {
  providerTxId: string;
  amountCents: number;
  type: CanonicalTransactionDTO["type"];
  status: CanonicalTransactionDTO["status"];
  /** User edited this row: sync must NOT clobber it (BP-031). */
  userOverridden: boolean;
}

// --- Upsert plan (returned by the pure core, applied by the shell) ----------

export interface AccountUpsert {
  op: "insert" | "update";
  providerAccountId: string;
  dto: CanonicalAccountDTO;
  /** Present on updates: the internal uuid to target. */
  existingId?: string;
}

export interface TransactionUpsert {
  op: "insert" | "update";
  providerTxId: string;
  dto: CanonicalTransactionDTO;
}

/** A transaction the plan deliberately SKIPPED, with the reason (for observability). */
export interface TransactionSkip {
  providerTxId: string | null;
  reason: "unchanged" | "user_overridden" | "missing_provider_id";
}

export interface SyncPlan {
  accountUpserts: AccountUpsert[];
  transactionUpserts: TransactionUpsert[];
  transactionSkips: TransactionSkip[];
}

// --- sync_runs summary ------------------------------------------------------

export type SyncStatus =
  "running" | "success" | "auth_error" | "transient_error" | "permanent_error";

export interface SyncRunSummary {
  status: SyncStatus;
  accountsSynced: number;
  transactionsUpserted: number;
  transactionsSkipped: number;
  cursorBefore: string | null;
  cursorAfter: string | null;
  error: string | null;
}
