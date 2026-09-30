# Domain Rules

These rules govern application behavior. They are independent of database and provider schemas.

## Ledger semantics

- `INCOME` increases monthly income.
- `EXPENSE` increases monthly expenses.
- `TRANSFER` moves value between owned accounts and changes neither income nor expenses. Pair source and destination when possible.
- `INVESTMENT_CONTRIBUTION` is an allocation and not an operating expense.
- A cash withdrawal is an expense under the current product rules.
- Fees and interest are expenses.
- Refunds/reversals must be represented so the original spending is not silently erased.

## Monthly result

`monthly result = total income - total expenses`. Transfers and investment contributions are excluded. All arithmetic is deterministic and uses integer cents; AI must never supply financial totals.

## Categories and corrections

Income and expense categories are user-editable. A user correction takes precedence over a provider refresh and should be retained as an explicit override. Categorization suggestions may be automated; accepted financial records and calculations remain inspectable and deterministic.

## Credit cards

Purchases are expenses according to the purchase/invoice policy selected by the domain model. Invoice payment is settlement of an existing liability, not another expense. Installments must be represented distinctly and linked to their purchase group. Reconciliation must prevent a bank debit for the invoice from duplicating card purchases.

## Period integrity

Closed periods must not be silently mutated. Any correction to a closed period requires an explicit product flow and an auditable result.

## Currency

Preserve integer minor units and the transaction currency. Currency conversion uses explicit rates and dates; never silently treat values in different currencies as directly additive.
