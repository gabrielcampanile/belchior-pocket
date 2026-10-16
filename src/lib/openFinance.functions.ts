import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Auto-sync when the app opens only if the last one is older than this. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
/** History backfill for exchange rates never goes further back than this. */
const MAX_HISTORY_DAYS = 400;

/**
 * The Pluggy items in PLUGGY_ITEM_IDS are the owner's bank data. Without this gate any
 * account created on the auth screen could pull them into its own rows.
 */
function assertOwner(userId: string) {
  const owner = process.env.PLUGGY_OWNER_USER_ID?.trim();
  if (!owner) throw new Error("Configure a variável PLUGGY_OWNER_USER_ID no servidor.");
  if (owner !== userId) throw new Error("Este usuário não pode sincronizar estas conexões.");
}

async function syncAndRates(userId: string) {
  const { runOpenFinanceSync } = await import("@/integrations/open-finance/sync.server");
  const { refreshLatestRates, backfillRatesSince } = await import("@/lib/exchangeRates.server");

  const result = await runOpenFinanceSync(userId);

  // Rates never fail the sync: conversion falls back to the nearest known rate.
  let ratesError: string | null = null;
  try {
    await refreshLatestRates();
    if (result.earliestTransactionOn) {
      const floor = new Date(Date.now() - MAX_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
      await backfillRatesSince(
        result.earliestTransactionOn < floor ? floor : result.earliestTransactionOn,
      );
    }
  } catch (err) {
    console.error("[sync] exchange rates failed:", err instanceof Error ? err.message : err);
    ratesError = "Não foi possível atualizar as cotações agora.";
  }

  return { skipped: false as const, items: result.items, ratesError };
}

/** "Sincronizar agora". */
export const syncOpenFinance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.userId);
    return syncAndRates(context.userId);
  });

/** Called when the app opens: syncs only if the newest connection sync is stale. */
export const syncOpenFinanceIfStale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertOwner(context.userId);
    const { data } = await context.supabase
      .from("provider_connections")
      .select("last_synced_at")
      .order("last_synced_at", { ascending: false, nullsFirst: false })
      .limit(1);
    const last = data?.[0]?.last_synced_at;
    if (last && Date.now() - new Date(last).getTime() < STALE_AFTER_MS) {
      return { skipped: true as const, items: [], ratesError: null };
    }
    return syncAndRates(context.userId);
  });
