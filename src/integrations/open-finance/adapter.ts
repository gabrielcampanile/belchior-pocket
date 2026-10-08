/**
 * Pluggy -> canonical adapter. PURE and deterministic (no IA, no I/O, no persistence).
 * Maps raw Pluggy shapes (./pluggy.types.ts) to canonical DTOs the application layer
 * persists. Provider concepts stay here and never leak into src/domain.
 *
 * Invariants (AGENTS.md / DOMAIN-RULES, see docs/OPIN-SCHEMA.md):
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

// Pluggy categories that denote a transfer between the user's own accounts.
const TRANSFER_CATEGORIES = new Set([
  "Transfer - PIX",
  "Transfer - TED",
  "Transfer - DOC",
  "Transfers",
  "Same person transfer",
]);

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
}

/**
 * Deterministic domain-type derivation from Pluggy sign + category + operationType.
 * No AI, no heuristics beyond these explicit rules.
 */
export function classifyTxType(
  tx: Pick<PluggyTransaction, "type" | "category" | "operationType">,
  ctx: ClassifyContext = {},
): CanonicalTxType {
  const category = tx.category ?? "";
  const op = tx.operationType ?? "";

  if (INVESTMENT_CATEGORIES.has(category) || INVESTMENT_OPERATION_TYPES.has(op)) {
    return "INVESTMENT_CONTRIBUTION";
  }

  if (TRANSFER_CATEGORIES.has(category)) {
    // A transfer category is only a true TRANSFER when it moves money between the
    // user's own accounts. Otherwise it is a real income (CREDIT) or expense (DEBIT).
    if (ctx.counterpartyIsOwnAccount) return "TRANSFER";
    return tx.type === "CREDIT" ? "INCOME" : "EXPENSE";
  }

  // Paying a credit-card bill: a DEBIT from a bank account toward a card is a settlement.
  if (ctx.isCreditCardAccount && tx.type === "CREDIT") {
    // On the card account, an incoming CREDIT is the bill payment landing.
    return "CARD_PAYMENT";
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
  return {
    providerTxId: tx.providerId ?? tx.id ?? null,
    amountCents: signedCents(tx, type),
    currency: toCurrencyCode(tx.currencyCode),
    occurredOn: (tx.date ?? "").slice(0, 10),
    description: tx.description ?? "",
    type,
    status: tx.status,
    providerOperationType: tx.operationType ?? null,
    providerCategoryId: tx.categoryId ?? null,
  };
}
