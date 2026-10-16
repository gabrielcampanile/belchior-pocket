---
inclusion: always
---

# Tech

- TanStack Start + TanStack Router (file routes in `src/routes`) + TanStack Query, React 19,
  Vite 8, Tailwind v4, shadcn/ui (`src/components/ui`), Recharts. **Not Next.js.**
- Supabase (Postgres + Auth + RLS). Browser: `src/integrations/supabase/client.ts`
  (publishable key, RLS). Server only: `client.server.ts` (service role) — import it only
  from `*.server.ts` or inside a server function handler.
- Server functions: `createServerFn` + `requireSupabaseAuth` middleware (`src/lib/*.functions.ts`).
- Open Finance: Pluggy REST v2 (`/v2/transactions` cursor pagination), server only.
- Deploy: Vercel via Nitro; see #[[file:docs/DEPLOY.md]].
- Schema: #[[file:docs/DATA-MODEL.md]]

Commands (CI runs npm on Node 22 with `package-lock.json`; Bun is for local dev):

- `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
- Validate formatting with the prettier version in `package-lock.json` (CI's), not Bun's.
- The host is memory constrained: run targeted tests (`npx vitest run <path>`) and leave the
  full build to CI.

Conventions:

- Tests: Vitest, `__tests__` next to the code, numbered Portuguese test names.
- Pure logic in `src/domain` and the pure parts of `src/integrations/open-finance`; tests
  cover every financial rule.
- Migrations: new file in `supabase/migrations`, `supabase db push`, regenerate
  `types.ts`. Never edit an applied migration. Destructive SQL is run by the owner.
