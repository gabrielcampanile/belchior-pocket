# Repository guidance

Belchior Pocket is a personal finance application. Read `docs/DOMAIN-RULES.md` and `docs/ARCHITECTURE.md` before changing financial behavior.

- Keep calculations deterministic and use integer minor units.
- Transfers between owned accounts are not income or expenses; investment contributions are not expenses.
- Do not use AI for financial calculations.
- Keep provider-specific payloads outside the domain and preserve user corrections during sync.
- Validate baseline audit claims against current code.
- Keep changes focused; schema, auth, RLS, and accounting changes need tests and explicit review.
- Run `npm run lint`, `npm run typecheck`, `npm run build`, and `npm test` for relevant changes; report results accurately.
