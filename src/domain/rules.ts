import {
  categoryKindForType,
  normalizeSearch,
  signedAmountForType,
  type TxType,
} from "./transactions";

/**
 * Categorization rules — PURE and deterministic.
 *
 * A rule says: "a transaction whose description contains <pattern> (optionally only money
 * coming in, or only going out) is <type> in <category>". Rules are the user's, are applied
 * to the past when created and to every future sync, and never touch a row the user edited
 * by hand (user_overridden) or a manual entry.
 *
 * Precedence when several rules match: the longest pattern wins (it is the most specific),
 * then the oldest rule. Order of authority overall: manual edit > rule > Pluggy mapping.
 */

export type RuleDirection = "IN" | "OUT" | "ANY";

export const RULE_DIRECTION_LABEL: Record<RuleDirection, string> = {
  ANY: "Entradas e saídas",
  IN: "Só entradas",
  OUT: "Só saídas",
};

export interface CategorizationRule {
  id: string;
  /** Stored normalized (normalizeSearch): lowercase, no accents, single spaces. */
  pattern: string;
  direction: RuleDirection;
  /** Null keeps the transaction's type. */
  setType: TxType | null;
  /** Null keeps the category (or lets the Pluggy mapping decide). */
  categoryId: string | null;
  createdAt: string;
}

export interface RuleTarget {
  description: string;
  amountCents: number;
  type: string;
}

export const MIN_PATTERN_LENGTH = 3;

export function validateRule(rule: Pick<CategorizationRule, "pattern" | "setType" | "categoryId">) {
  const pattern = normalizeSearch(rule.pattern);
  if (pattern.length < MIN_PATTERN_LENGTH) {
    return `Use pelo menos ${MIN_PATTERN_LENGTH} caracteres no texto da regra.`;
  }
  if (!rule.setType && !rule.categoryId) return "Escolha um tipo, uma categoria ou os dois.";
  return null;
}

function directionMatches(direction: RuleDirection, amountCents: number): boolean {
  if (direction === "IN") return amountCents > 0;
  if (direction === "OUT") return amountCents < 0;
  return true;
}

export function ruleMatches(rule: CategorizationRule, tx: RuleTarget): boolean {
  if (!rule.pattern || !directionMatches(rule.direction, tx.amountCents)) return false;
  return normalizeSearch(tx.description).includes(rule.pattern);
}

/** Most specific first: longer pattern, then older rule, then id (total order). */
export function sortRules(rules: CategorizationRule[]): CategorizationRule[] {
  return [...rules].sort(
    (a, b) =>
      b.pattern.length - a.pattern.length ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
}

export function findRule(rules: CategorizationRule[], tx: RuleTarget): CategorizationRule | null {
  return sortRules(rules).find((r) => ruleMatches(r, tx)) ?? null;
}

export interface RuleOutcome {
  type: TxType;
  amountCents: number;
  /** undefined = the rule does not decide the category. */
  categoryId: string | null | undefined;
  ruleId: string;
}

/**
 * Apply one rule. Changing the type re-signs the amount by the domain convention; money
 * coming in that a rule calls an expense is a refund (positive, reduces spending).
 */
export function applyRule(rule: CategorizationRule, tx: RuleTarget): RuleOutcome {
  const type = (rule.setType ?? tx.type) as TxType;
  const amountCents =
    type === tx.type
      ? tx.amountCents
      : signedAmountForType(type, tx.amountCents, tx.amountCents, {
          refund: type === "EXPENSE" && tx.amountCents > 0,
        });
  // A type that takes no category (transfer, bill payment...) clears it.
  const takesCategory = type === "INCOME" || type === "EXPENSE";
  return {
    type,
    amountCents,
    categoryId: takesCategory ? (rule.categoryId ?? undefined) : null,
    ruleId: rule.id,
  };
}

/** The first matching rule's outcome, or null when no rule applies. */
export function categorize(rules: CategorizationRule[], tx: RuleTarget): RuleOutcome | null {
  const rule = findRule(rules, tx);
  return rule ? applyRule(rule, tx) : null;
}

/**
 * A starting pattern from a bank description: drop dates, long numbers and ids so
 * "PIX RECEBIDO 12/10 ACME LTDA 0012345" suggests "pix recebido acme ltda".
 */
export function suggestPattern(description: string): string {
  return normalizeSearch(description)
    .replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g, " ")
    .replace(/\b[\w*-]*\d{4,}[\w*-]*\b/g, " ")
    .replace(/[*#]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface TransactionPatch {
  id: string;
  type: TxType;
  categoryId: string | null;
  amountCents: number;
}

/**
 * Patches to bring past transactions in line with `rules` (used right after a rule is
 * created or edited). Only IMPORT rows the user did not edit by hand; only rows whose
 * type, category or amount actually change.
 */
export function planRetroactivePatches(
  rules: CategorizationRule[],
  transactions: (RuleTarget & {
    id: string;
    categoryId: string | null;
    source: string;
    userOverridden: boolean;
  })[],
): TransactionPatch[] {
  const sorted = sortRules(rules);
  const patches: TransactionPatch[] = [];
  for (const tx of transactions) {
    if (tx.source !== "IMPORT" || tx.userOverridden) continue;
    const rule = sorted.find((r) => ruleMatches(r, tx));
    if (!rule) continue;
    const out = applyRule(rule, tx);
    // A rule that only changes the type between income and expense leaves a category of the
    // wrong kind behind: clear it instead.
    const kindChanged = categoryKindForType(out.type) !== categoryKindForType(tx.type);
    const categoryId =
      out.categoryId === undefined ? (kindChanged ? null : tx.categoryId) : out.categoryId;
    if (
      out.type === tx.type &&
      out.amountCents === tx.amountCents &&
      categoryId === tx.categoryId
    ) {
      continue;
    }
    patches.push({ id: tx.id, type: out.type, categoryId, amountCents: out.amountCents });
  }
  return patches;
}
