# Agent and contributor guidance

Belchior Pocket handles personal financial data. Read `docs/DOMAIN-RULES.md`, `docs/ARCHITECTURE.md`, and the relevant feature documentation before changing behavior.

## Non-negotiable invariants

- Financial arithmetic is deterministic and uses integer cents.
- Transfers between owned accounts do not change income or expenses.
- Investment contributions are allocations, not operating expenses.
- Card invoice settlement must not duplicate purchase expenses.
- Provider payloads stay at the integration boundary; user corrections survive sync.
- Keep credentials and privileged database access on the server.

## Workflow

- Verify baseline claims in the current code before acting on them.
- Keep changes focused and avoid unrelated cleanup or premature infrastructure.
- Add/update regression tests for financial behavior and synchronization semantics.
- For schema, auth, RLS, or accounting changes, explain migration and security implications and request focused human review.
- Do not deploy, perform destructive data changes, or rewrite published Git history.
- Run lint, typecheck, build, and relevant tests; report only checks actually completed.

The repository may be connected to an external editor or deployment workflow. Check the current Git remote and branch workflow before pushing changes.
