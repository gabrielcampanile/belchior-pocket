# Roadmap

One place for what is next. Each item becomes a GitHub issue (and, when it is bigger than a
day, a Kiro spec under `.kiro/specs/<feature>/`) before implementation starts.

## Done — V1 (2026-10-16)

Monthly cash flow on Open Finance: schema (#54, #58), Pluggy adapter and idempotent sync
(#56, #57, #59), Mês atual with budget (#60), Transações with manual CRUD (#61),
Relatórios (#62), Vercel deploy (#63, #64).

## Done — V1.1 Polimento (2026-10-17)

Manual accounts (#69), recategorization rules (#71), `bun.lock` (#70), bitcoin manual
accounts (#72), exchange-rate pagination fix (#73), card purchases at the charged BRL amount
(#74), Mercado Pago internal movements as transfers (#75), mobile-first pass on all screens
(#76–#79), bounded sync retry (#35).

## Later — not scheduled

- Credit-card engine: invoices, closing date, installments as grouped transactions.
- Investment contributions target and net worth (XP investments endpoint).
- Planning, scenarios, projections (reference only: `legacy/lovable-screens/`).
- AI: categorization fallback and insights — never in the arithmetic.
- Agentic engineering: review agents in CI (`.github/agents/`).
