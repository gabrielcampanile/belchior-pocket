/**
 * Pluggy -> canonical adapter. PURE and deterministic (no IA, no I/O, no persistence).
 * Maps raw Pluggy shapes (./pluggy.types.ts) to canonical DTOs the application layer
 * persists. Provider concepts stay here and never leak into src/domain.
 *
 * Invariants (AGENTS.md / DOMAIN-RULES, see docs/DATA-MODEL.md):
 *  - money is integer minor units (cents);
 *  - Pluggy `type` (CREDIT/DEBIT) is only a sign; the domain type is DERIVED from
 *    type + category + operationType, deterministically;
 *  - transfers between the user's own accounts are TRANSFER (not income/expense);
 *  - automatic investment is INVESTMENT_CONTRIBUTION (an allocation, not an expense);
 *  - a payment toward a credit-card account is CARD_PAYMENT (a settlement);
 *  - provider identity is `providerId`, never a content hash.
 */

import { toCurrencyCode, type CurrencyCode } from "@/domain/currency";
import type { PluggyAccount, PluggyTransaction, PluggyAccountSubtype } from "./pluggy.types";

/** Canonical account kind (mirrors the DB enum account_kind). */
export type CanonicalAccountKind = "CHECKING" | "CREDIT_CARD" | "INVESTMENT" | "CASH" | "OTHER";

/** Canonical transaction domain type (mirrors the DB enum tx_domain_type). */
export type CanonicalTxType =
  "EXPENSE" | "INCOME" | "TRANSFER" | "INVESTMENT_CONTRIBUTION" | "CARD_PAYMENT";

export type CanonicalTxStatus = "POSTED" | "PENDING";

export interface CanonicalAccountDTO {
  providerAccountId: string;
  kind: CanonicalAccountKind;
  name: string;
  currency: CurrencyCode;
  balanceCents: number;
  creditLimitCents: number | null;
}

export interface CanonicalTransactionDTO {
  providerTxId: string | null;
  amountCents: number; // signed: expense negative, income positive
  currency: CurrencyCode;
  occurredOn: string; // YYYY-MM-DD
  description: string;
  type: CanonicalTxType;
  status: CanonicalTxStatus;
  providerOperationType: string | null;
  providerCategoryId: string | null;
}

/** Decimal amount (e.g. 7755.36) -> integer cents (775536). Rounds half-up. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

const SUBTYPE_TO_KIND: Record<PluggyAccountSubtype, CanonicalAccountKind> = {
  CHECKING_ACCOUNT: "CHECKING",
  SAVINGS_ACCOUNT: "CHECKING",
  CREDIT_CARD: "CREDIT_CARD",
};

export function normalizeAccount(a: PluggyAccount): CanonicalAccountDTO {
  const kind: CanonicalAccountKind =
    a.type === "CREDIT" ? "CREDIT_CARD" : (SUBTYPE_TO_KIND[a.subtype] ?? "OTHER");
  const creditLimit = a.creditData?.creditLimit ?? null;
  return {
    providerAccountId: a.id,
    kind,
    name: a.name,
    currency: toCurrencyCode(a.currencyCode),
    balanceCents: toCents(a.balance ?? 0),
    creditLimitCents: creditLimit != null ? toCents(creditLimit) : null,
  };
}

// --- Domain-type classification -------------------------------------------

// Pluggy already resolved the counterparty as the account holder: always an own-account
// TRANSFER (e.g. XP -> Wise), never income/expense.
const OWN_TRANSFER_CATEGORIES = new Set(["Same person transfer"]);

// Pluggy categories that MAY be a transfer between the user's own accounts.
const TRANSFER_CATEGORIES = new Set([
  "Transfer - PIX",
  "Transfer - TED",
  "Transfer - DOC",
  "Transfers",
]);

// Paying the credit-card bill from a bank account. The card purchases are already the
// expenses; counting the bill too would double-count them.
const CARD_PAYMENT_CATEGORIES = new Set(["Credit card payment"]);

// Categories / operationTypes that denote an automatic investment allocation (aporte).
const INVESTMENT_CATEGORIES = new Set(["Automatic investment", "Investment"]);
const INVESTMENT_OPERATION_TYPES = new Set(["RENDIMENTO_APLIC_FINANCEIRA", "APLICACAO"]);

export interface ClassifyContext {
  /** The account this transaction belongs to is a credit card. */
  isCreditCardAccount?: boolean;
  /**
   * The transfer counterparty is one of the user's OWN accounts. Only then is a
   * transfer-category row a true own-account TRANSFER; otherwise it is income/expense.
   * The application layer supplies this after resolving the counterparty.
   */
  counterpartyIsOwnAccount?: boolean;
  /**
   * Currency of the account the transaction belongs to. When the purchase was made in
   * another currency (e.g. ARS on a BRL card), the amount the institution actually charged
   * (`amountInAccountCurrency`) is stored instead of converting at a market rate.
   */
  accountCurrency?: CurrencyCode;
}

/**
 * The amount + currency to store. A foreign-currency purchase uses what the institution
 * charged in the account's currency (card FX rate, spread included), when Pluggy sends it.
 * Without that value the original currency is kept and converted at the market rate later.
 */
export function chargedAmount(
  tx: Pick<PluggyTransaction, "amount" | "currencyCode" | "amountInAccountCurrency">,
  accountCurrency?: CurrencyCode,
): { amount: number; currency: CurrencyCode } {
  const original = toCurrencyCode(tx.currencyCode);
  const charged = tx.amountInAccountCurrency;
  if (accountCurrency && original !== accountCurrency && charged != null && charged !== 0) {
    return { amount: Math.abs(charged), currency: accountCurrency };
  }
  return { amount: tx.amount, currency: original };
}

/** Card-side CREDIT that is the bill payment (by category, or by its usual description). */
const BILL_PAYMENT_DESCRIPTION = /\b(pagamento|pagto|pgto|payment)\b/i;
function isCardBillPayment(
  tx: Pick<PluggyTransaction, "category"> & Partial<Pick<PluggyTransaction, "description">>,
): boolean {
  return (
    CARD_PAYMENT_CATEGORIES.has(tx.category ?? "") ||
    BILL_PAYMENT_DESCRIPTION.test(tx.category ?? "") ||
    BILL_PAYMENT_DESCRIPTION.test(tx.description ?? "")
  );
}

/**
 * Deterministic domain-type derivation from Pluggy sign + category + operationType.
 * No AI, no heuristics beyond these explicit rules.
 */
export function classifyTxType(
  tx: Pick<PluggyTransaction, "type" | "category" | "operationType"> &
    Partial<Pick<PluggyTransaction, "description">>,
  ctx: ClassifyContext = {},
): CanonicalTxType {
  const category = tx.category ?? "";
  const op = tx.operationType ?? "";

  if (INVESTMENT_CATEGORIES.has(category) || INVESTMENT_OPERATION_TYPES.has(op)) {
    return "INVESTMENT_CONTRIBUTION";
  }

  if (OWN_TRANSFER_CATEGORIES.has(category)) return "TRANSFER";

  if (CARD_PAYMENT_CATEGORIES.has(category)) return "CARD_PAYMENT";

  if (TRANSFER_CATEGORIES.has(category)) {
    // A transfer category is only a true TRANSFER when it moves money between the
    // user's own accounts. Otherwise it is a real income (CREDIT) or expense (DEBIT).
    if (ctx.counterpartyIsOwnAccount) return "TRANSFER";
    return tx.type === "CREDIT" ? "INCOME" : "EXPENSE";
  }

  // On a credit-card account an incoming CREDIT is either the bill payment landing or a
  // refund. Only the payment is a settlement; a refund is an EXPENSE stored positive, so it
  // reduces spending instead of disappearing from it.
  if (ctx.isCreditCardAccount && tx.type === "CREDIT") {
    return isCardBillPayment(tx) ? "CARD_PAYMENT" : "EXPENSE";
  }

  return tx.type === "CREDIT" ? "INCOME" : "EXPENSE";
}

/**
 * Signed cents in domain terms: EXPENSE/CARD_PAYMENT negative, INCOME positive,
 * TRANSFER/INVESTMENT_CONTRIBUTION carry the provider sign (DEBIT negative).
 */
export function signedCents(tx: PluggyTransaction, domainType: CanonicalTxType): number {
  const magnitude = Math.abs(toCents(tx.amount));
  switch (domainType) {
    case "INCOME":
      return magnitude;
    case "EXPENSE":
      // A CREDIT classified as EXPENSE is a refund (card): positive, reduces spending.
      return tx.type === "CREDIT" ? magnitude : -magnitude;
    case "CARD_PAYMENT":
      return -magnitude;
    case "TRANSFER":
    case "INVESTMENT_CONTRIBUTION":
      return tx.type === "DEBIT" ? -magnitude : magnitude;
  }
}

export function normalizeTransaction(
  tx: PluggyTransaction,
  ctx: ClassifyContext = {},
): CanonicalTransactionDTO {
  const type = classifyTxType(tx, ctx);
  const { amount, currency } = chargedAmount(tx, ctx.accountCurrency);
  return {
    providerTxId: tx.providerId ?? tx.id ?? null,
    amountCents: signedCents({ ...tx, amount }, type),
    currency,
    occurredOn: (tx.date ?? "").slice(0, 10),
    description: tx.description ?? "",
    type,
    status: tx.status,
    providerOperationType: tx.operationType ?? null,
    providerCategoryId: tx.categoryId ?? null,
  };
}
