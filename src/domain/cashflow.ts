import { money, type CurrencyCode } from "./currency";
import { identityConverter, type MoneyConverter } from "./exchange";

/**
 * Monthly cash flow over the Open Finance ledger — PURE and deterministic.
 *
 * Rules (docs/DOMAIN-RULES.md):
 *  - only INCOME and EXPENSE count; TRANSFER, CARD_PAYMENT and INVESTMENT_CONTRIBUTION
 *    move money between the user's own pockets and never inflate either side;
 *  - hidden rows are excluded by the caller's query, but are filtered here too;
 *  - every amount is converted to the display currency on its own date BEFORE summing;
 *  - EXPENSE amounts are stored negative and INCOME positive: we sum magnitudes.
 */

export type CashflowKind = "INCOME" | "EXPENSE";

export interface CashflowTransaction {
  amountCents: number;
  currency: CurrencyCode;
  occurredOn: string;
  type: string;
  categoryId: string | null;
  hidden?: boolean;
}

export interface CashflowCategory {
  id: string;
  name: string;
  kind: CashflowKind;
  /** Fixed monthly budget in BRL cents (v1: no per-month history). Null = no budget. */
  monthlyBudgetCents: number | null;
  color: string | null;
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  totalCents: number;
  /** Share of this side's total, 0..1. */
  share: number;
}

export interface MonthCashflow {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  income: CategoryTotal[];
  expense: CategoryTotal[];
}

export const UNCATEGORIZED_LABEL = "Sem categoria";

function totalsBySide(
  transactions: CashflowTransaction[],
  kind: CashflowKind,
  nameById: Map<string, string>,
  convert: MoneyConverter,
): { total: number; rows: CategoryTotal[] } {
  const byCategory = new Map<string | null, number>();
  let total = 0;
  for (const tx of transactions) {
    if (tx.hidden || tx.type !== kind) continue;
    const value = Math.abs(Math.round(convert(money(tx.amountCents, tx.currency), tx.occurredOn)));
    // A category id the user deleted (or that is not loaded) counts as uncategorized.
    const key = tx.categoryId && nameById.has(tx.categoryId) ? tx.categoryId : null;
    byCategory.set(key, (byCategory.get(key) ?? 0) + value);
    total += value;
  }
  const rows = [...byCategory.entries()]
    .map(([categoryId, totalCents]) => ({
      categoryId,
      name: categoryId ? nameById.get(categoryId)! : UNCATEGORIZED_LABEL,
      totalCents,
      share: total > 0 ? totalCents / total : 0,
    }))
    .sort((a, b) => b.totalCents - a.totalCents || a.name.localeCompare(b.name));
  return { total, rows };
}

export function monthCashflow(
  transactions: CashflowTransaction[],
  categories: CashflowCategory[],
  convert: MoneyConverter = identityConverter,
): MonthCashflow {
  const nameById = new Map(categories.map((c) => [c.id, c.name] as const));
  const income = totalsBySide(transactions, "INCOME", nameById, convert);
  const expense = totalsBySide(transactions, "EXPENSE", nameById, convert);
  return {
    incomeCents: income.total,
    expenseCents: expense.total,
    balanceCents: income.total - expense.total,
    income: income.rows,
    expense: expense.rows,
  };
}

// --- Budget -----------------------------------------------------------------

export type BudgetStatus = "ok" | "warning" | "over" | "none";

/** Warn from 80% of the budget; "over" from 100%. */
export const BUDGET_WARNING_RATIO = 0.8;

export function budgetStatus(spentCents: number, budgetCents: number | null): BudgetStatus {
  if (budgetCents == null) return "none";
  if (budgetCents === 0) return spentCents > 0 ? "over" : "ok";
  const ratio = spentCents / budgetCents;
  if (ratio >= 1) return "over";
  if (ratio >= BUDGET_WARNING_RATIO) return "warning";
  return "ok";
}

export interface BudgetRow {
  categoryId: string | null;
  name: string;
  spentCents: number;
  budgetCents: number | null;
  /** spent / budget; null when the category has no budget. */
  ratio: number | null;
  remainingCents: number | null;
  status: BudgetStatus;
}

export interface BudgetProgress {
  /** Sum of the expense categories' budgets; null when no category has one. */
  totalBudgetCents: number | null;
  /** ALL expenses of the month, budgeted category or not. */
  totalSpentCents: number;
  ratio: number | null;
  remainingCents: number | null;
  status: BudgetStatus;
  /** Budgeted categories first (most consumed first), then unbudgeted by amount. */
  rows: BudgetRow[];
}

/**
 * Budget vs actual for the month. Budgets are in BRL: `cashflow` must have been computed
 * with a converter targeting BRL for the ratios to be meaningful.
 */
export function budgetProgress(
  cashflow: Pick<MonthCashflow, "expense" | "expenseCents">,
  categories: CashflowCategory[],
): BudgetProgress {
  const spentById = new Map(cashflow.expense.map((r) => [r.categoryId, r.totalCents] as const));
  const rows: BudgetRow[] = [];

  for (const c of categories) {
    if (c.kind !== "EXPENSE") continue;
    const spent = spentById.get(c.id) ?? 0;
    if (c.monthlyBudgetCents == null && spent === 0) continue;
    rows.push(budgetRow(c.id, c.name, spent, c.monthlyBudgetCents));
  }
  const uncategorized = spentById.get(null);
  if (uncategorized) rows.push(budgetRow(null, UNCATEGORIZED_LABEL, uncategorized, null));

  rows.sort((a, b) => {
    if ((a.ratio == null) !== (b.ratio == null)) return a.ratio == null ? 1 : -1;
    if (a.ratio != null && b.ratio != null && a.ratio !== b.ratio) return b.ratio - a.ratio;
    return b.spentCents - a.spentCents || a.name.localeCompare(b.name);
  });

  const budgets = categories.filter((c) => c.kind === "EXPENSE" && c.monthlyBudgetCents != null);
  const totalBudgetCents = budgets.length
    ? budgets.reduce((sum, c) => sum + (c.monthlyBudgetCents ?? 0), 0)
    : null;
  const total = budgetRow(null, "", cashflow.expenseCents, totalBudgetCents);

  return {
    totalBudgetCents,
    totalSpentCents: cashflow.expenseCents,
    ratio: total.ratio,
    remainingCents: total.remainingCents,
    status: total.status,
    rows,
  };
}

function budgetRow(
  categoryId: string | null,
  name: string,
  spentCents: number,
  budgetCents: number | null,
): BudgetRow {
  return {
    categoryId,
    name,
    spentCents,
    budgetCents,
    ratio: budgetCents ? spentCents / budgetCents : null,
    remainingCents: budgetCents == null ? null : budgetCents - spentCents,
    status: budgetStatus(spentCents, budgetCents),
  };
}

/** How far into `month` ("YYYY-MM-01") `today` is, 0..1 — the pace reference for spending. */
export function monthElapsedRatio(month: string, today: string): number {
  const [y, m] = month.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (today < month) return 0;
  if (today.slice(0, 7) !== month.slice(0, 7)) return 1;
  return Number(today.slice(8, 10)) / days;
}
