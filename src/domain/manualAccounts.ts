/**
 * Manual accounts (cash, an account outside Open Finance) — PURE rules.
 *
 * A manual account has no provider balance to trust. Its balance is the opening balance the
 * user typed plus every visible transaction on it, of any type: a transfer into the cash
 * wallet raises it just like an income does.
 */

export type ManualAccountKind = "CASH" | "CHECKING" | "OTHER";

export const MANUAL_ACCOUNT_KINDS: ManualAccountKind[] = ["CASH", "CHECKING", "OTHER"];

export const MANUAL_ACCOUNT_KIND_LABEL: Record<ManualAccountKind, string> = {
  CASH: "Dinheiro",
  CHECKING: "Conta fora do Open Finance",
  OTHER: "Outra",
};

export function manualAccountBalance(
  openingCents: number,
  transactions: { amountCents: number; hidden?: boolean }[],
): number {
  return transactions.reduce((sum, t) => (t.hidden ? sum : sum + t.amountCents), openingCents);
}

/**
 * Deleting an account would cascade its transactions away, erasing history from past
 * months. Only an account with no transactions may be deleted; otherwise archive it.
 */
export function canDeleteManualAccount(transactionCount: number): boolean {
  return transactionCount === 0;
}

export function validateManualAccountName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return "Dê um nome para a conta.";
  if (trimmed.length > 60) return "Use no máximo 60 caracteres.";
  return null;
}
