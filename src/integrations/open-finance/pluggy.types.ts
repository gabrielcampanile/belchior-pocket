/**
 * Raw Pluggy API shapes — exactly as returned by the REAL API (captured 2026-10-08).
 * These describe the *provider* payload and must NOT leak into the domain layer.
 * The adapter (./adapter.ts) maps them to canonical DTOs.
 *
 * Source endpoints:
 *   GET /accounts?itemId=            -> PluggyAccount
 *   GET /v2/transactions?accountId=  -> PluggyTransactionsPage (cursor pagination via `next`)
 * NOTE: the v1 GET /transactions endpoint is 410 DEPRECATED and rejects from/pageSize.
 */

export type PluggyAccountType = "BANK" | "CREDIT";
export type PluggyAccountSubtype = "CHECKING_ACCOUNT" | "SAVINGS_ACCOUNT" | "CREDIT_CARD";

/** Pluggy transaction `type` is only a sign — not the domain type. */
export type PluggyTxSign = "CREDIT" | "DEBIT";
export type PluggyTxStatus = "POSTED" | "PENDING";

export interface PluggyCreditData {
  level?: string | null;
  brand?: string | null;
  balanceCloseDate?: string | null;
  balanceDueDate?: string | null;
  availableCreditLimit?: number | null;
  creditLimit?: number | null;
  minimumPayment?: number | null;
  isLimitFlexible?: boolean | null;
  status?: string | null;
}

export interface PluggyAccount {
  id: string;
  type: PluggyAccountType;
  subtype: PluggyAccountSubtype;
  name: string;
  /** Pluggy returns a decimal amount (NOT minor units). The adapter converts to cents. */
  balance: number;
  currencyCode: string;
  itemId: string;
  number?: string | null;
  marketingName?: string | null;
  creditData?: PluggyCreditData | null;
}

export interface PluggyAccountsResponse {
  total?: number;
  results: PluggyAccount[];
}

export interface PluggyTransaction {
  id: string;
  description: string;
  descriptionRaw?: string | null;
  currencyCode: string;
  /** Decimal amount, always positive; the sign lives in `type`. Adapter -> signed cents. */
  amount: number;
  amountInAccountCurrency?: number | null;
  /** ISO datetime. */
  date: string;
  category?: string | null;
  categoryId?: string | null;
  balance?: number | null;
  accountId: string;
  status: PluggyTxStatus;
  type: PluggyTxSign;
  operationType?: string | null;
  operationTypeAdditionalInfo?: string | null;
  /** Stable provider identity — the upsert key. */
  providerId?: string | null;
  providerCode?: string | null;
}

/** GET /items/{id}. Only the fields the sync reads. */
export interface PluggyItem {
  id: string;
  /** UPDATED | UPDATING | LOGIN_ERROR | OUTDATED | WAITING_USER_INPUT | ... */
  status: string;
  connector?: { id?: number | null; name?: string | null } | null;
}

/** GET /categories. Ids are hierarchical: '17030000' belongs to top-level '17000000'. */
export interface PluggyCategory {
  id: string;
  description: string;
  /** Portuguese label, used to name the user's categories. */
  descriptionTranslated?: string | null;
  parentId?: string | null;
}

export interface PluggyCategoriesResponse {
  results: PluggyCategory[];
}

/**
 * v2 response: results + `next`, a ready-to-use QUERY STRING for the next page
 * (GET /v2/transactions{next}). Empty/absent `next` means last page.
 */
export interface PluggyTransactionsPage {
  results: PluggyTransaction[];
  next?: string | null;
}
