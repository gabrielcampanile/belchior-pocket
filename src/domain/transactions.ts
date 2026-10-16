import type { CashflowKind } from "./cashflow";

/**
 * Transaction list + edit rules — PURE (no I/O). Used by the Transações screen.
 */

export type TxType = "INCOME" | "EXPENSE" | "TRANSFER" | "CARD_PAYMENT" | "INVESTMENT_CONTRIBUTION";

export const TX_TYPES: TxType[] = [
  "EXPENSE",
  "INCOME",
  "TRANSFER",
  "CARD_PAYMENT",
  "INVESTMENT_CONTRIBUTION",
];

export const TX_TYPE_LABEL: Record<TxType, string> = {
  EXPENSE: "Despesa",
  INCOME: "Receita",
  TRANSFER: "Transferência entre contas",
  CARD_PAYMENT: "Pagamento de fatura",
  INVESTMENT_CONTRIBUTION: "Aporte / investimento",
};

/** Manual entries are plain income or expense; the other types only describe imported rows. */
export const MANUAL_TX_TYPES: TxType[] = ["EXPENSE", "INCOME"];

/** Which category list a type uses; null = the type never counts and takes no category. */
export function categoryKindForType(type: string): CashflowKind | null {
  if (type === "INCOME") return "INCOME";
  if (type === "EXPENSE") return "EXPENSE";
  return null;
}

/**
 * Signed amount stored for a type (domain convention: expense negative, income positive).
 * TRANSFER / INVESTMENT_CONTRIBUTION carry their direction, so they keep `previousCents`'s
 * sign (an outflow by default when there is none).
 */
export function signedAmountForType(
  type: TxType,
  magnitudeCents: number,
  previousCents?: number,
  options: { refund?: boolean } = {},
): number {
  const magnitude = Math.abs(Math.round(magnitudeCents));
  switch (type) {
    case "INCOME":
      return magnitude;
    case "EXPENSE":
      // A refund is an expense stored positive: it reduces the category's spending.
      return options.refund ? magnitude : -magnitude;
    case "CARD_PAYMENT":
      return -magnitude;
    case "TRANSFER":
    case "INVESTMENT_CONTRIBUTION":
      return previousCents != null && previousCents > 0 ? magnitude : -magnitude;
  }
}

// --- Filters ----------------------------------------------------------------

export const NO_CATEGORY = "__none__";
export type TypeFilter = "all" | TxType;

export interface ListTransaction {
  id: string;
  accountId: string;
  description: string;
  notes: string | null;
  amountCents: number;
  occurredOn: string;
  type: string;
  categoryId: string | null;
  hidden: boolean;
}

export interface TransactionFilters {
  search: string;
  accountId: string | "all";
  /** A category id, NO_CATEGORY, or "all". */
  categoryId: string;
  type: TypeFilter;
  showHidden: boolean;
}

export const DEFAULT_FILTERS: TransactionFilters = {
  search: "",
  accountId: "all",
  categoryId: "all",
  type: "all",
  showHidden: false,
};

/** Lowercase, accent-free, single-spaced: "Café  Pão" and "cafe pao" match. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Filter, then sort newest first (stable by description for the same day). */
export function filterTransactions<T extends ListTransaction>(
  rows: T[],
  filters: TransactionFilters,
): T[] {
  const needle = normalizeSearch(filters.search);
  return rows
    .filter((t) => {
      if (!filters.showHidden && t.hidden) return false;
      if (filters.accountId !== "all" && t.accountId !== filters.accountId) return false;
      if (filters.type !== "all" && t.type !== filters.type) return false;
      if (filters.categoryId === NO_CATEGORY) {
        if (t.categoryId) return false;
      } else if (filters.categoryId !== "all" && t.categoryId !== filters.categoryId) {
        return false;
      }
      if (needle) {
        const haystack = normalizeSearch(`${t.description} ${t.notes ?? ""}`);
        if (!haystack.includes(needle)) return false;
      }
      return true;
    })
    .sort(
      (a, b) =>
        b.occurredOn.localeCompare(a.occurredOn) || a.description.localeCompare(b.description),
    );
}

/** Group an already sorted list by day, preserving order. */
export function groupByDay<T extends { occurredOn: string }>(
  rows: T[],
): { day: string; rows: T[] }[] {
  const groups: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.day === row.occurredOn) last.rows.push(row);
    else groups.push({ day: row.occurredOn, rows: [row] });
  }
  return groups;
}
