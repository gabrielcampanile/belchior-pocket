# Development

## Prerequisites

Use the Node version supported by the current Vite/TanStack toolchain and npm. Dependencies are declared in `package.json` and `package-lock.json`.

## Setup

```sh
npm ci
```

## Commands

```sh
npm run dev
npm run lint
npm run typecheck
npm run build
npm test
npm run test:watch
```

Use Supabase environment variables only in local ignored environment files; never commit credentials. Check the repository's current runtime and scripts before changing tool versions.

## Change workflow

Keep changes focused. For financial behavior, add or update deterministic domain tests and describe the invariant in the PR. For database changes, include migration, RLS/security implications, rollback considerations, and relevant verification. Do not mix unrelated UI cleanup with schema work.

## Before opening a PR

Run lint, typecheck, build, and tests relevant to the change. Explain any command that cannot run and summarize remaining risks. Never claim a check passed unless it was run successfully.
