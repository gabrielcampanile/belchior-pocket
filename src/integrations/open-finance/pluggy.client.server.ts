/**
 * Pluggy HTTP client — SERVER ONLY. Credentials come from server env vars and never reach
 * the browser bundle (only import this from other *.server.ts modules or inside a server
 * handler via dynamic import).
 *
 * Env:
 *   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET  dashboard.pluggy.ai application credentials
 *   PLUGGY_ITEM_IDS                         comma-separated items, optionally labelled:
 *                                           "XP:<item-uuid>,Wise:<item-uuid>"
 */

import type {
  PluggyAccount,
  PluggyAccountsResponse,
  PluggyCategoriesResponse,
  PluggyCategory,
  PluggyItem,
  PluggyTransaction,
  PluggyTransactionsPage,
} from "./pluggy.types";
import {
  parseItemIds,
  PLUGGY_API_BASE as API_BASE,
  transactionsPageUrl,
  type ConfiguredItem,
} from "./pluggy.request";
const TIMEOUT_MS = 20_000;
// The API key lives 2h; renew a bit earlier.
const API_KEY_TTL_MS = 100 * 60 * 1000;

/** HTTP failure carrying only the status (classifySyncError reads it). No body, no token. */
export class PluggyHttpError extends Error {
  constructor(
    readonly status: number,
    endpoint: string,
  ) {
    super(`Pluggy ${endpoint} respondeu ${status}.`);
    this.name = "PluggyHttpError";
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Configure a variável ${name} no ambiente do servidor.`);
  return value;
}

export type { ConfiguredItem };

export function configuredItems(): ConfiguredItem[] {
  const items = parseItemIds(process.env.PLUGGY_ITEM_IDS);
  if (items.length === 0) throw new Error("Configure a variável PLUGGY_ITEM_IDS no servidor.");
  return items;
}

let cachedKey: { value: string; expiresAt: number } | null = null;

async function apiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;
  const response = await fetch(`${API_BASE}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: requiredEnv("PLUGGY_CLIENT_ID"),
      clientSecret: requiredEnv("PLUGGY_CLIENT_SECRET"),
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new PluggyHttpError(response.status, "/auth");
  const payload = (await response.json()) as { apiKey?: string };
  if (!payload.apiKey) throw new PluggyHttpError(401, "/auth");
  cachedKey = { value: payload.apiKey, expiresAt: Date.now() + API_KEY_TTL_MS };
  return payload.apiKey;
}

async function get<T>(url: URL, endpoint: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "X-API-KEY": await apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) cachedKey = null;
  if (!response.ok) throw new PluggyHttpError(response.status, endpoint);
  return (await response.json()) as T;
}

export const pluggy = {
  getItem(itemId: string): Promise<PluggyItem> {
    return get(new URL(`/items/${encodeURIComponent(itemId)}`, API_BASE), "/items");
  },

  async listAccounts(itemId: string): Promise<PluggyAccount[]> {
    const url = new URL("/accounts", API_BASE);
    url.searchParams.set("itemId", itemId);
    return (await get<PluggyAccountsResponse>(url, "/accounts")).results ?? [];
  },

  async fetchTransactionsPage(
    accountId: string,
    next: string | undefined,
    dateFrom?: string,
  ): Promise<{ results: PluggyTransaction[]; next: string | null }> {
    const page = await get<PluggyTransactionsPage>(
      transactionsPageUrl(accountId, next, dateFrom),
      "/v2/transactions",
    );
    return { results: page.results ?? [], next: page.next ?? null };
  },

  async listCategories(): Promise<PluggyCategory[]> {
    return (
      (await get<PluggyCategoriesResponse>(new URL("/categories", API_BASE), "/categories"))
        .results ?? []
    );
  },
};
