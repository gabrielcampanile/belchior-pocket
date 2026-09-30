# Architecture

## Current baseline

The app is a TypeScript React application using TanStack Start/Router/Query, Supabase, and a pure financial domain under `src/domain/`. The baseline audit in `docs/audit/BASELINE-AUDIT.md` records current implementation findings; verify those findings against code before acting on them.

## Desired boundaries

- **Domain (`src/domain`)**: canonical finance types, validation, categorization rules, and deterministic calculations. No React, Supabase, or provider-specific types.
- **Application**: use cases such as importing, categorizing, and synchronizing. Orchestrates domain behavior and persistence.
- **Infrastructure**: Supabase repositories and external provider adapters. Translates external payloads into canonical models.
- **UI**: React routes and components; delegates finance decisions to application/domain code.

## Provider independence

Define an internal `OpenFinanceProvider` contract and canonical account/transaction types before adding provider integrations. A Pluggy adapter may implement that contract, but Pluggy identifiers and payloads must not leak into domain calculations. Keep secrets on the server and normalize provider responses at the boundary.

## Financial correctness

Use integer cents and deterministic functions. Transfers do not affect income/expense totals; investment contributions are allocations. Sync must be idempotent, handle pending-to-posted changes, and preserve user overrides. Card invoice settlement must not duplicate purchase expenses.

## Change strategy

Prefer small, reviewable milestones. M0 establishes documentation and workflow. Domain identity, database schema, closed-period policy, and card accounting are higher-impact decisions and should be designed, tested, and reviewed before migration. Do not introduce microservices, queues, event sourcing, or a complex tenancy model without demonstrated need.
