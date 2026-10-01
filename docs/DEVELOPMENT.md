# Development Guide

## Local setup

Use the Node version in CI (22) and the lockfile selected by the repository's package manager. Install dependencies from the lockfile before changing package versions. Configure Supabase URL and public anonymous key for local development; place server-only service-role and provider secrets in an ignored local environment file. Never use production financial data as a development fixture.

Run the app with npm run dev. Use a local or disposable Supabase project for schema and authentication work. Confirm callback URLs and OAuth provider configuration in that project before testing Google sign-in.

## Change workflow

1. Read the issue, its acceptance criteria, and linked product/domain docs.
2. Inspect the current route, server function, schema, tests, and callers before choosing an implementation.
3. Confirm behavior that affects money, account ownership, period boundaries, provider identity, or consent.
4. Make a focused change in the existing stack. Avoid unrelated cleanup.
5. Add synthetic tests for the affected invariant and update generated types after schema changes.
6. Run lint, typecheck, tests, and build as appropriate. Report exact skipped checks.
7. Open a pull request linked to the issue and summarize data, security, migration, and rollout impact.

## Database work

Review current migrations and policies first. Use forward migrations with explicit constraints and indexes. Verify row-level security with both owner and non-owner cases. Regenerate types using the repository's approved schema process and inspect the diff. Never reset a shared or production database as a shortcut.

## Financial feature checklist

Before implementing a feature, identify its transaction kind, currency, effective date, ownership, source, idempotency key, effect on monthly totals and budgets, pending and correction behavior, and relevant accessibility state. Reuse domain calculations; do not recalculate totals in UI components.

## Commands

- npm run dev starts local development.
- npm run lint checks lint rules.
- npm run typecheck checks TypeScript.
- npm test runs the test suite.
- npm run build creates the production build.
- npm run format rewrites repository files; run it only when formatting is part of the change.

## Pull request hygiene

Keep the diff issue-sized. Document schema changes and provider configuration needs. Do not commit local environment files, customer information, generated build output, or unrelated staged work. Wait for CI and requested specialist reviews before merging.
