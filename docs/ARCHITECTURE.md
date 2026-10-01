# Architecture

## Current baseline and target boundaries

The repository is a TypeScript and React 19 web application using TanStack Start, file-based TanStack Router, TanStack Query, Tailwind CSS, Supabase/PostgreSQL, and server functions. Preserve this stack while the domain and integration boundaries are established. A framework rewrite is not part of V1.

The target architecture separates:

1. Presentation: route components, forms, accessible interaction, filters, and view models.
2. Application: use cases that coordinate authorization, validation, repository operations, and domain services.
3. Domain: financial concepts, classification rules, money and period calculations, reconciliation policy, and typed outcomes. This layer must not depend on UI frameworks, Supabase SDK types, provider SDKs, or AI vendor SDKs.
4. Infrastructure: Supabase repositories, provider adapters, authentication, persistence, telemetry chosen by the project, and external APIs.

Do not create empty layers or abstractions without a concrete use case. Extract code when doing so makes financial invariants independently testable or prevents provider details from leaking into the domain.

## Data flow

A user action or provider event enters through a route or server function. Authenticate the caller, validate ownership and input, normalize external data at the integration boundary, then invoke a use case. The use case applies domain rules and persists through a narrow repository interface. Return a typed result suitable for the UI. Provider responses and database row shapes do not cross into domain calculations unchanged.

For imported transactions, the intended flow is: authenticated connection -> provider adapter -> canonical DTO validation -> idempotent reconciliation -> preserve user corrections -> persistence -> refreshed query and sync status. The adapter should expose a stable project-owned interface so provider replacement does not rewrite domain logic.

## Server and client boundary

- Keep provider secrets, service-role credentials, server-only Supabase clients, and privileged mutations on the server.
- Browser clients use the authenticated user's session and row-level security.
- Server functions validate authentication and ownership independently of UI guards.
- Do not import server-only modules into route client bundles.
- Do not log full provider payloads, credentials, or private transaction descriptions by default.

## Financial calculations

Centralize period inclusion, totals, currency rules, installment expansion, card statement settlement, transfer exclusion, and budget actual policy. Components format calculated values; they do not independently recreate business arithmetic. Use exact money semantics and explicit currency. Projections are separate from actuals and carry assumptions.

## Persistence and migration

Supabase/Postgres is the current persistence baseline. Review existing schema, generated types, policies, and migrations before adding tables or changing ownership. Migrations must be forward-only, reviewed for existing data, and paired with authorization checks. Generated database types are outputs of the schema process; do not hand-edit them to hide a migration mismatch.

## Existing code review

The audit backlog includes possible risks such as short-hash deduplication, hardcoded query limits, sequential mutation paths, incomplete closure behavior, and tests that do not cover financial invariants. These are audit hypotheses until verified against the current code and issue scope. Do not describe them as confirmed production defects without reproducing them.

## Architecture decision record

Record decisions that affect money semantics, user data ownership, provider identity, consent, or deployment in a dated short decision note linked from the relevant issue. State context, selected option, rejected alternatives, consequences, migration needs, and open questions. Keep product decisions in the PRD and domain rules, not hidden only in a PR discussion.
