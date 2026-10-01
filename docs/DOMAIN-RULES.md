# Domain Rules

These rules are the source of truth for domain behavior. UI labels, imported provider semantics, and AI suggestions must conform to them. When an issue requires a new financial rule, document the decision here before implementing it.

## Classification of events

- Income increases the period result.
- Expense decreases the period result.
- Transfer between accounts owned by the household changes account balances but is neither income nor expense.
- Investment contribution moves money into an investment holding and is neither income nor expense. It may be shown as a separate savings or contribution metric.
- Cash withdrawal is a transfer from bank account to cash only when the cash account is tracked. Without a tracked cash destination, the product may record it as spending only under an explicit user decision; do not silently classify every withdrawal as consumption.
- Bank fee, card fee, interest, and tax charged to the household are expenses.
- A credit card purchase is an expense when the purchase or installment is recognized. Paying the card statement settles a liability and is not another expense.

## Period totals

- Monthly result = included income minus included expenses.
- Transfers and investment contributions are excluded from both sides of monthly result.
- Totals only combine amounts in the same currency. Any conversion requires a named exchange-rate source, rate timestamp, and conversion policy.
- The transaction's agreed effective date determines the reporting period. Keep transaction date, posting date, and statement due date distinct; do not substitute one for another without an explicit rule.
- Pending transactions must not be counted again when replaced or reconciled by the posted version.
- Every dashboard total must be explainable by a query or domain calculation with a documented inclusion policy.

## Money and precision

- Never use JavaScript binary floating point as the canonical money representation.
- Validate currency and amount at input and provider boundaries.
- Keep sign conventions consistent. Prefer positive magnitudes paired with an explicit transaction kind over overloaded sign meanings.
- Round only at a documented currency boundary. Do not round every intermediate calculation.
- Reject unsupported or malformed precision instead of silently changing a financial amount.

## Credit cards and installments

- A card purchase and invoice payment have different meanings and identifiers.
- Statement settlement reduces the card liability; it does not create new spending.
- Installment number, count, original purchase group, installment due date, amount, and card account must remain related.
- Three installments of R$300 create three occurrences of R$300, not one monthly expense of R$900.
- Statement items and imported transactions may refer to the same economic event and require reconciliation before aggregation.
- Refund, reversal, chargeback, and disputed transaction semantics are not decided; do not infer them.

## Categorization and corrections

- Category suggestion source is distinguishable: built-in deterministic rule, user rule, provider hint, optional AI suggestion, or manual user choice.
- Explicit user correction has precedence over machine suggestion.
- A later provider update can refresh provider-owned fields but cannot overwrite user-owned category or description corrections.
- Rules are scoped by transaction type and owner. A match must not silently change the transaction's financial kind.
- Rule ordering, conflict resolution, and regex safety must be deterministic and testable.
- Uncertain AI output remains a suggestion and never changes financial amounts, dates, accounts, or totals.

## Identity, import, and deduplication

- Provider IDs are scoped by provider connection and resource type.
- Prefer a stable provider transaction ID; retain enough source identity to reconcile pending-to-posted changes.
- Date, amount, merchant text, or a short non-cryptographic hash alone are not safe unique keys.
- A repeated import of the same provider object is idempotent.
- Similar-looking purchases are not automatically duplicates unless the reconciliation policy has sufficient evidence.
- User-created and imported records retain distinguishable provenance.

## Period closure and projections

- A closed period must have an explicit policy for late imports and user corrections. Current behavior must not be described as frozen until it is implemented.
- Historical actuals remain separate from forecasts.
- Projection methods, assumed returns, inflation, and future income are not financial facts. Label each assumption and do not mix projection values into actual totals.
- The current V1 target is cash-flow and budget understanding, not full net-worth forecasting.

## Unknown cases

When an issue, provider payload, or design introduces an unspecified financial case, implement no hidden assumption. Record examples, propose a rule, and update this document after the product decision. Use domain terminology in code and tests so that transfers, expenses, settlements, and contributions cannot be confused by generic labels such as movement.
