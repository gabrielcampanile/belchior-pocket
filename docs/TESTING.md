# Testing Strategy

## Unit tests

Keep financial domain logic pure and cover boundary values and invariants: integer cents, monthly totals, transfer exclusion, investment contributions, currency conversion, categorization, CSV parsing, transaction identity, and projection behavior.

## Integration tests

Where practical, verify persistence and sync semantics including ownership/RLS, idempotent upsert, pending-to-posted reconciliation, override preservation, and card invoice settlement.

## Quality gates

CI runs lint, TypeScript checking, production build, and Vitest. Tests must not use real financial accounts or production credentials. Add regression cases for financial bugs and describe the scenario they protect.

## Test commands

`npm test` runs Vitest once; `npm run test:watch` starts watch mode.
