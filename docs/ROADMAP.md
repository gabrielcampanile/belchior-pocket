# Roadmap

One place for what is next. Each item becomes a GitHub issue (and, when it is bigger than a
day, a Kiro spec under `.kiro/specs/<feature>/`) before implementation starts.

## Done — V1 (2026-10-16)

Monthly cash flow on Open Finance: schema (#54, #58), Pluggy adapter and idempotent sync
(#56, #57, #59), Mês atual with budget (#60), Transações with manual CRUD (#61),
Relatórios (#62), Vercel deploy (#63, #64).

## V1.1 — polish (milestone "V1.1 — Polimento")

- Manual accounts (cash) from the UI — the schema already supports `source = MANUAL`.
- Mobile pass on the four screens (iPhone): touch targets, tables, sheet and dialog.
- Sync retry/backoff for transient Pluggy errors (BP-035).
- Recategorization rules: "always put UBER in Transporte" as a user rule applied by sync.
- Local `bun.lock` aligned with `package-lock.json` (TanStack Start security bump, #64).

## Later — not scheduled

- Credit-card engine: invoices, closing date, installments as grouped transactions.
- Investment contributions target and net worth (XP investments endpoint).
- Planning, scenarios, projections (reference only: `legacy/lovable-screens/`).
- AI: categorization fallback and insights — never in the arithmetic.
- Agentic engineering: review agents in CI (`.github/agents/`).
