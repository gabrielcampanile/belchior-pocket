# Testing Strategy

Tests protect financial meaning, ownership boundaries, synchronization behavior, and the user flows that make imported information trustworthy. A passing build alone is not evidence that totals are correct.

## Test layers

- Domain unit tests: money precision, period inclusion, transfer exclusion, contribution treatment, installments, card settlement, budget actuals, categorization precedence, and pending-to-posted reconciliation.
- Application tests: authentication and ownership decisions, repository coordination, idempotency, error mapping, and safe retry policy.
- Integration tests: Supabase queries and policies, provider adapters, webhook signature and replay validation, schema migrations, and representative provider fixtures.
- UI tests: accessible names, keyboard operation, transaction correction, filter state, empty and error states, and sync feedback.
- End-to-end checks: sign in, review current month, correct an imported category, and verify the correction survives a later sync where a safe sandbox exists.

## Required financial scenarios

Use explicit examples with currency, date, status, account, and expected period totals. Cover at minimum:
- income and expense in the same period;
- a transfer between owned accounts;
- investment contribution excluded from income and expense;
- card purchase plus later invoice payment counted exactly once;
- three installments of R$300 shown as separate occurrences;
- pending item reconciled to posted without duplicate spending;
- currency mismatch rejected or converted under an explicit rate policy;
- user category correction surviving provider refresh;
- importing the same provider event twice producing one canonical event.

## Security scenarios

Test that a user can read and mutate their own records, cannot read or mutate another user's records, cannot access another user's provider connection through an indirect identifier, and cannot call privileged operations without server authorization. Test malformed and missing ownership references.

## Fixtures and privacy

Fixtures are synthetic and contain no real banking data, secrets, account numbers, or copied provider payloads with identifying values. Keep only fields needed to reproduce normalization and reconciliation. Document which provider schema version a fixture represents.

## Commands and CI

The canonical local checks are npm run lint, npm run typecheck, npm test, and npm run build. CI runs npm ci followed by these checks on pull requests. A change that alters domain behavior should add or update focused tests in the same issue. Report commands actually run and their results; do not claim a check passed when it was skipped.
