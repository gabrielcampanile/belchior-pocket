/**
 * Pure request helpers for the Pluggy API (no credentials, no I/O). Kept out of
 * pluggy.client.server.ts so they can be unit-tested: *.server.ts modules are replaced by
 * an import-protection mock outside the server runtime.
 */

export const PLUGGY_API_BASE = "https://api.pluggy.ai";

export interface ConfiguredItem {
  itemId: string;
  label: string | null;
}

/** Parse PLUGGY_ITEM_IDS ("XP:uuid,uuid2"): optional label, duplicates ignored. */
export function parseItemIds(raw: string | undefined): ConfiguredItem[] {
  const seen = new Set<string>();
  const items: ConfiguredItem[] = [];
  for (const part of (raw ?? "").split(",")) {
    const entry = part.trim();
    if (!entry) continue;
    const sep = entry.lastIndexOf(":");
    const label = sep > 0 ? entry.slice(0, sep).trim() : null;
    const itemId = (sep > 0 ? entry.slice(sep + 1) : entry).trim();
    if (!itemId || seen.has(itemId)) continue;
    seen.add(itemId);
    items.push({ itemId, label: label || null });
  }
  return items;
}

/**
 * URL for a /v2/transactions page. `next` is the query string returned by the previous page
 * (GET /v2/transactions{next}); it is only accepted if it stays on the same endpoint, so a
 * tampered cursor cannot redirect the API key to another host or path.
 */
export function transactionsPageUrl(
  accountId: string,
  next: string | undefined,
  dateFrom?: string,
): URL {
  if (next) {
    if (!next.startsWith("?")) throw new Error("Cursor de paginação inválido.");
    const url = new URL(`/v2/transactions${next}`, PLUGGY_API_BASE);
    if (url.origin !== PLUGGY_API_BASE || url.pathname !== "/v2/transactions") {
      throw new Error("Cursor de paginação inválido.");
    }
    return url;
  }
  const url = new URL("/v2/transactions", PLUGGY_API_BASE);
  url.searchParams.set("accountId", accountId);
  if (dateFrom) url.searchParams.set("dateFrom", dateFrom);
  return url;
}
