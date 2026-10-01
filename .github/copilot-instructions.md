# Belchior Pocket: repository instructions

Belchior is a personal and household finance workspace. Read docs/PRD.md for product scope, docs/DOMAIN-RULES.md for financial invariants, docs/ARCHITECTURE.md for boundaries, docs/SECURITY.md for private-data handling, and docs/TESTING.md before changing behavior.

Correctness rules:
- Monthly result is income minus expenses. Own-account transfers and investment contributions are neither.
- Card purchases or installments are expenses under the product's recognized date policy. Paying the statement settles a liability and is not another expense.
- Preserve currency and exact money semantics. Do not use JavaScript floating point for canonical financial amounts.
- Imported updates must be idempotent and preserve user corrections.
- AI may suggest classification only. It cannot calculate totals or mutate amounts, dates, account ownership, or transaction type.
- Never expose service-role or provider credentials; every personal record must be owner-scoped and protected by RLS.

Implementation guidance:
- Keep provider and persistence shapes at infrastructure boundaries; use canonical domain behavior.
- Inspect migrations, generated types, callers, and existing tests before changing the model.
- Keep changes within the linked issue and state unresolved product decisions rather than guessing.
- Use synthetic data in tests, screenshots, and examples.
- Report checks actually run and do not claim skipped checks passed.
