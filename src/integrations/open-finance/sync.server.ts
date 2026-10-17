/**
 * Open Finance sync — persistence SHELL (server only). Applies the pure plans from
 * ./sync.ts and ./categories.ts to Supabase. All decisions (what changed, what to skip,
 * which pending rows are stale, which category a group maps to) are made by the pure core;
 * this file only reads the current state, calls Pluggy and writes the result.
 *
 * Writes use the service role, so EVERY query is scoped by user_id explicitly.
 */

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { normalizeTransaction, type CanonicalAccountKind } from "./adapter";
import {
  categoryKindFor,
  mappingKey,
  nameKey,
  planCategoryResolution,
  topLevelCategoryId,
  UNCATEGORIZED_PROVIDER_ID,
  type CategoryKind,
  type NeededGroup,
} from "./categories";
import { configuredItems, pluggy, type ConfiguredItem } from "./pluggy.api.server";
import type { PluggyAccount, PluggyCategory, PluggyTransaction } from "./pluggy.types";
import {
  classifySyncError,
  collectTransactionPages,
  planAccountSync,
  planStalePendingRemovals,
  planTransactionSync,
  ruleAdjuster,
} from "./sync";
import type { CategorizationRule } from "@/domain/rules";
import type { ExistingTransaction, SyncStatus, TransactionUpsert } from "./sync.types";

/** Re-read this many days before the last sync: pending rows post, dates shift. */
const OVERLAP_DAYS = 30;
/** A run older than this still marked 'running' is considered dead (crashed worker). */
const RUNNING_LOCK_MS = 10 * 60 * 1000;
const CHUNK = 500;

type ConnectionStatus = "ACTIVE" | "LOGIN_ERROR" | "OUTDATED" | "DISCONNECTED";

export interface ItemSyncResult {
  itemId: string;
  institution: string;
  status: Exclude<SyncStatus, "running"> | "skipped_running";
  accounts: number;
  transactionsUpserted: number;
  pendingRemoved: number;
  error: string | null;
}

export interface SyncResult {
  items: ItemSyncResult[];
  earliestTransactionOn: string | null;
}

function itemStatus(status: string | undefined): ConnectionStatus {
  if (status === "LOGIN_ERROR" || status === "WAITING_USER_INPUT") return "LOGIN_ERROR";
  if (status === "OUTDATED") return "OUTDATED";
  return "ACTIVE";
}

function windowStartFrom(lastSyncedAt: string | null): string | undefined {
  if (!lastSyncedAt) return undefined; // first sync: full history
  const d = new Date(lastSyncedAt);
  d.setUTCDate(d.getUTCDate() - OVERLAP_DAYS);
  return d.toISOString().slice(0, 10);
}

function dueDay(raw: PluggyAccount): number | null {
  const day = Number(raw.creditData?.balanceDueDate?.slice(8, 10));
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function must<T>(result: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (result.error) throw new Error(result.error.message);
  if (result.data == null) throw new Error("Resposta vazia do banco.");
  return result.data;
}

/** For writes without .select(): PostgREST returns data = null on success, so only check error. */
function ok(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message);
}

/** PostgREST caps a select at 1000 rows; page through with .range(). */
async function selectAll<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const batch = must(await page(from, from + 999)) ?? [];
    rows.push(...batch);
    if (batch.length < 1000) return rows;
  }
}

// --- Categories -------------------------------------------------------------

class CategoryResolver {
  private catalog: Map<string, PluggyCategory> | null = null;

  constructor(private readonly userId: string) {}

  private async loadCatalog() {
    if (!this.catalog) {
      const list = await pluggy.listCategories();
      this.catalog = new Map(list.map((c) => [c.id, c]));
    }
    return this.catalog;
  }

  private async loadState() {
    const mappings = must(
      await supabaseAdmin
        .from("category_mappings")
        .select("kind, provider_category_id, category_id")
        .eq("user_id", this.userId),
    );
    const categories = must(
      await supabaseAdmin.from("categories").select("id, kind, name").eq("user_id", this.userId),
    );
    return {
      byMapping: new Map(
        mappings.map((m) => [mappingKey(m.kind, m.provider_category_id), m.category_id]),
      ),
      byName: new Map(categories.map((c) => [nameKey(c.kind, c.name), c.id])),
    };
  }

  /** Ensure every group has a mapping; return mappingKey -> category id. */
  async resolve(needed: NeededGroup[]): Promise<Map<string, string>> {
    let state = await this.loadState();
    if (needed.every((g) => state.byMapping.has(mappingKey(g.kind, g.providerCategoryId)))) {
      return state.byMapping;
    }

    const plan = planCategoryResolution(
      needed,
      new Set(state.byMapping.keys()),
      new Set(state.byName.keys()),
      await this.loadCatalog(),
    );

    if (plan.categoriesToCreate.length > 0) {
      ok(
        await supabaseAdmin.from("categories").upsert(
          plan.categoriesToCreate.map((c) => ({
            user_id: this.userId,
            kind: c.kind,
            name: c.name,
          })),
          { onConflict: "user_id,kind,name", ignoreDuplicates: true },
        ),
      );
      state = await this.loadState();
    }

    const mappingRows = plan.mappingsToCreate.flatMap((m) => {
      const categoryId = state.byName.get(nameKey(m.kind, m.name));
      return categoryId
        ? [
            {
              user_id: this.userId,
              kind: m.kind,
              provider_category_id: m.providerCategoryId,
              category_id: categoryId,
            },
          ]
        : [];
    });
    if (mappingRows.length > 0) {
      ok(
        await supabaseAdmin.from("category_mappings").upsert(mappingRows, {
          onConflict: "user_id,kind,provider_category_id",
          ignoreDuplicates: true,
        }),
      );
    }
    return (await this.loadState()).byMapping;
  }
}

function groupOf(upsert: TransactionUpsert): { kind: CategoryKind; key: string } | null {
  const kind = categoryKindFor(upsert.dto.type);
  if (!kind) return null;
  const top = upsert.dto.providerCategoryId
    ? topLevelCategoryId(upsert.dto.providerCategoryId)
    : UNCATEGORIZED_PROVIDER_ID;
  return { kind, key: top };
}

// --- One item ----------------------------------------------------------------

/** The user's categorization rules (#66), in the shape the pure core expects. */
async function loadRules(userId: string): Promise<CategorizationRule[]> {
  const rows = must(
    await supabaseAdmin
      .from("categorization_rules")
      .select("id, pattern, direction, set_type, category_id, created_at")
      .eq("user_id", userId),
  );
  return rows.map((r) => ({
    id: r.id,
    pattern: r.pattern,
    direction: r.direction as CategorizationRule["direction"],
    setType: r.set_type,
    categoryId: r.category_id,
    createdAt: r.created_at,
  }));
}

interface AccountWork {
  accountId: string;
  upserts: TransactionUpsert[];
  staleProviderTxIds: string[];
}

async function syncItem(
  userId: string,
  item: ConfiguredItem,
  categories: CategoryResolver,
  adjust: ReturnType<typeof ruleAdjuster>,
): Promise<ItemSyncResult & { earliest: string | null }> {
  const pluggyItem = await pluggy.getItem(item.itemId);
  const institution = item.label ?? pluggyItem.connector?.name ?? "Instituição";
  const connectionStatus = itemStatus(pluggyItem.status);

  const connection = must(
    await supabaseAdmin
      .from("provider_connections")
      .upsert(
        {
          user_id: userId,
          provider: "PLUGGY" as const,
          provider_item_id: item.itemId,
          institution_name: institution,
          connector_id: pluggyItem.connector?.id ?? null,
          status: connectionStatus,
        },
        { onConflict: "user_id,provider,provider_item_id" },
      )
      .select("id, last_synced_at")
      .single(),
  );

  const base = { itemId: item.itemId, institution, earliest: null as string | null };

  // Another sync of this connection is in flight (e.g. auto-sync + button): do not race it.
  const running = must(
    await supabaseAdmin
      .from("sync_runs")
      .select("id")
      .eq("connection_id", connection.id)
      .eq("status", "running")
      .gte("started_at", new Date(Date.now() - RUNNING_LOCK_MS).toISOString())
      .limit(1),
  );
  if (running.length > 0) {
    return {
      ...base,
      status: "skipped_running",
      accounts: 0,
      transactionsUpserted: 0,
      pendingRemoved: 0,
      error: null,
    };
  }

  const windowStart = windowStartFrom(connection.last_synced_at);
  const rangeTo = new Date().toISOString().slice(0, 10);
  const run = must(
    await supabaseAdmin
      .from("sync_runs")
      .insert({
        user_id: userId,
        connection_id: connection.id,
        status: "running",
        range_from: windowStart ?? null,
        range_to: rangeTo,
      })
      .select("id")
      .single(),
  );

  try {
    // Accounts
    const rawAccounts = await pluggy.listAccounts(item.itemId);
    const existingAccounts = must(
      await supabaseAdmin
        .from("accounts")
        .select("id, provider_account_id, kind, name, balance_cents, credit_limit_cents")
        .eq("user_id", userId)
        .eq("connection_id", connection.id),
    );
    const accountPlan = planAccountSync(
      rawAccounts,
      existingAccounts.flatMap((a) =>
        a.provider_account_id
          ? [
              {
                id: a.id,
                providerAccountId: a.provider_account_id,
                kind: a.kind,
                name: a.name,
                balanceCents: Number(a.balance_cents),
                creditLimitCents:
                  a.credit_limit_cents == null ? null : Number(a.credit_limit_cents),
              },
            ]
          : [],
      ),
    );
    const rawById = new Map(rawAccounts.map((a) => [a.id, a]));
    if (accountPlan.length > 0) {
      ok(
        await supabaseAdmin.from("accounts").upsert(
          accountPlan.map(({ dto }) => ({
            user_id: userId,
            connection_id: connection.id,
            provider_account_id: dto.providerAccountId,
            source: "IMPORT" as const,
            kind: dto.kind,
            name: dto.name,
            currency: dto.currency,
            balance_cents: dto.balanceCents,
            credit_limit_cents: dto.creditLimitCents,
            credit_due_day: dueDay(rawById.get(dto.providerAccountId)!),
          })),
          { onConflict: "connection_id,provider_account_id" },
        ),
      );
    }
    const accounts = must(
      await supabaseAdmin
        .from("accounts")
        .select("id, provider_account_id, kind")
        .eq("user_id", userId)
        .eq("connection_id", connection.id),
    );
    const accountByProvider = new Map(
      accounts.flatMap((a) => (a.provider_account_id ? [[a.provider_account_id, a] as const] : [])),
    );

    // Transactions: plan every account first, then resolve categories once, then write.
    const work: AccountWork[] = [];
    let earliest: string | null = null;
    for (const raw of rawAccounts) {
      const account = accountByProvider.get(raw.id);
      if (!account) continue;
      const kind = account.kind as CanonicalAccountKind;

      const { transactions, lastCursor } = await collectTransactionPages(
        raw.id,
        (accountId, cursor) => pluggy.fetchTransactionsPage(accountId, cursor, windowStart),
        undefined,
      );
      const existing: ExistingTransaction[] = (
        await selectAll((from, to) =>
          supabaseAdmin
            .from("transactions")
            .select(
              "provider_tx_id, amount_cents, type, status, occurred_on, description, user_overridden",
            )
            .eq("user_id", userId)
            .eq("account_id", account.id)
            .eq("source", "IMPORT")
            .order("id")
            .range(from, to),
        )
      ).flatMap((t) =>
        t.provider_tx_id
          ? [
              {
                providerTxId: t.provider_tx_id,
                amountCents: Number(t.amount_cents),
                type: t.type,
                status: t.status,
                occurredOn: String(t.occurred_on),
                description: t.description,
                userOverridden: t.user_overridden,
              },
            ]
          : [],
      );

      const ctx = { isCreditCardAccount: kind === "CREDIT_CARD" };
      const { upserts } = planTransactionSync(transactions, existing, () => ctx, adjust);

      // Only a complete drain proves a missing pending row is gone.
      const complete = !lastCursor;
      const seen = new Set(
        transactions.flatMap((t: PluggyTransaction) => {
          const id = normalizeTransaction(t, ctx).providerTxId;
          return id ? [id] : [];
        }),
      );
      const stale = complete ? planStalePendingRemovals(existing, seen, windowStart) : [];

      for (const u of upserts) {
        if (!earliest || u.dto.occurredOn < earliest) earliest = u.dto.occurredOn;
      }
      // Counts only (no ids, amounts or descriptions): enough to tell "nothing new" from
      // "the provider returned nothing".
      console.info(
        `[sync] ${institution} ${kind}: fetched=${transactions.length} existing=${existing.length} upserts=${upserts.length} stale=${stale.length} from=${windowStart ?? "all"}`,
      );
      work.push({ accountId: account.id, upserts, staleProviderTxIds: stale });
    }

    const needed: NeededGroup[] = [];
    for (const w of work) {
      for (const u of w.upserts) {
        const g = groupOf(u);
        if (g) needed.push({ kind: g.kind, providerCategoryId: g.key });
      }
    }
    const categoryByGroup = needed.length > 0 ? await categories.resolve(needed) : new Map();

    let upserted = 0;
    let removed = 0;
    for (const w of work) {
      const rows = w.upserts.map((u) => {
        const g = groupOf(u);
        return {
          user_id: userId,
          account_id: w.accountId,
          provider_tx_id: u.providerTxId,
          amount_cents: u.dto.amountCents,
          currency: u.dto.currency,
          occurred_on: u.dto.occurredOn,
          description: u.dto.description,
          type: u.dto.type,
          status: u.dto.status,
          source: "IMPORT" as const,
          category_id:
            u.ruleCategoryId !== undefined
              ? u.ruleCategoryId
              : g
                ? (categoryByGroup.get(mappingKey(g.kind, g.key)) ?? null)
                : null,
          provider_operation_type: u.dto.providerOperationType,
          provider_category_id: u.dto.providerCategoryId,
        };
      });
      for (const batch of chunks(rows)) {
        ok(
          await supabaseAdmin
            .from("transactions")
            .upsert(batch, { onConflict: "account_id,provider_tx_id" }),
        );
      }
      upserted += rows.length;

      for (const ids of chunks(w.staleProviderTxIds)) {
        ok(
          await supabaseAdmin
            .from("transactions")
            .delete()
            .eq("user_id", userId)
            .eq("account_id", w.accountId)
            .eq("source", "IMPORT")
            .eq("status", "PENDING")
            .eq("user_overridden", false)
            .in("provider_tx_id", ids),
        );
        removed += ids.length;
      }
    }

    const finishedAt = new Date().toISOString();
    ok(
      await supabaseAdmin
        .from("sync_runs")
        .update({
          status: "success",
          finished_at: finishedAt,
          accounts_synced: accountPlan.length,
          transactions_upserted: upserted,
        })
        .eq("id", run.id),
    );
    ok(
      await supabaseAdmin
        .from("provider_connections")
        .update({ last_synced_at: finishedAt, last_error: null, status: connectionStatus })
        .eq("id", connection.id),
    );

    return {
      ...base,
      earliest,
      status: "success",
      accounts: rawAccounts.length,
      transactionsUpserted: upserted,
      pendingRemoved: removed,
      error: null,
    };
  } catch (err) {
    const { status, error } = classifySyncError(err);
    // Server log keeps the real message for debugging; it never contains a token or payload.
    console.error(`[sync] item ${item.itemId} failed:`, err instanceof Error ? err.message : err);
    await supabaseAdmin
      .from("sync_runs")
      .update({ status, error, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    await supabaseAdmin
      .from("provider_connections")
      .update({
        last_error: error,
        status: status === "auth_error" ? "LOGIN_ERROR" : connectionStatus,
      })
      .eq("id", connection.id);
    return { ...base, status, accounts: 0, transactionsUpserted: 0, pendingRemoved: 0, error };
  }
}

/** Sync every configured Pluggy item for `userId`. One failing item does not stop the others. */
export async function runOpenFinanceSync(userId: string): Promise<SyncResult> {
  const categories = new CategoryResolver(userId);
  const adjust = ruleAdjuster(await loadRules(userId));
  const items: ItemSyncResult[] = [];
  let earliestTransactionOn: string | null = null;

  for (const item of configuredItems()) {
    try {
      const { earliest, ...result } = await syncItem(userId, item, categories, adjust);
      items.push(result);
      if (earliest && (!earliestTransactionOn || earliest < earliestTransactionOn)) {
        earliestTransactionOn = earliest;
      }
    } catch (err) {
      // Failed before a sync_run existed (e.g. item lookup): report it, keep going.
      const { status, error } = classifySyncError(err);
      console.error(`[sync] item ${item.itemId} failed:`, err instanceof Error ? err.message : err);
      items.push({
        itemId: item.itemId,
        institution: item.label ?? "Instituição",
        status,
        accounts: 0,
        transactionsUpserted: 0,
        pendingRemoved: 0,
        error,
      });
    }
  }
  return { items, earliestTransactionOn };
}
