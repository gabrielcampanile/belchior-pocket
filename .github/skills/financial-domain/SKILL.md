---
name: financial-domain
description: Apply Belchior Pocket financial semantics consistently in implementation and review.
---

# Purpose

Read docs/DOMAIN-RULES.md and docs/PRD.md before changing transaction, category, budget, card, or dashboard behavior. This skill is for domain reasoning, not a substitute for inspecting the actual implementation and schema.

# Workflow

1. Identify the economic event and its explicit transaction kind.
2. Trace the date, currency, amount representation, account ownership, source, and status from input to persistence and totals.
3. State whether the event affects income, expense, transfer, contribution, balance, budget actual, or more than one of these separate measures.
4. Check duplicates, pending-to-posted transitions, installment group, user correction, and relevant period boundaries.
5. Find a focused test with an explicit expected amount and period result.
6. If a behavior is undecided, write the example and request a product decision instead of guessing.

# Invariants

Monthly result equals income minus expenses. Own-account transfers, card statement settlement, and investment contributions are excluded from income and expense. Card purchase recognition and installment timing follow the product policy. Currency is explicit, and exact money semantics are required. User corrections outrank machine suggestions.

# Anti-patterns

Do not infer expense from every negative provider amount. Do not count both card purchase and invoice payment. Do not collapse installment occurrences into the full purchase in every month. Do not use floating-point arithmetic, date-plus-amount as a unique key, or AI output as financial authority.

# Evidence

Use the transaction's path through validation, domain logic, persistence, aggregation, and tests. State confirmed behavior separately from assumptions and unresolved policy.
