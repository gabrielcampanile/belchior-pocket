# Belchior Pocket

Belchior Pocket is a personal and family finance workspace for understanding monthly income, expenses, cash flow, budgets, and recent history. Its north star is reliable financial information with simple, mobile friendly use.

## Current focus

V1 is live (https://belchiorpocket.vercel.app): monthly cash flow from Open Finance (Pluggy: XP and Wise) with categories, a fixed monthly budget, a transaction statement with manual edits, and reports. What it does is in [docs/PRD.md](docs/PRD.md); what comes next is in [docs/ROADMAP.md](docs/ROADMAP.md).

## Financial invariants

- Monthly result is income minus expenses.
- Transfers between the user's own accounts are neither income nor expense.
- Investment contributions are allocations, not operating expenses.
- Financial arithmetic is deterministic and uses integer cents.
- User corrections must survive future synchronization.
- Paying a card invoice must not count purchases a second time.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup and quality commands, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries, [docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the live schema, and [docs/DEPLOY.md](docs/DEPLOY.md) for Vercel and environment variables. The baseline audit is in [docs/audit/BASELINE-AUDIT.md](docs/audit/BASELINE-AUDIT.md).

## Product direction

The project is personal/family use. Keep the implementation small and secure. Do not add AI to financial calculations, couple domain concepts to an external provider, or introduce large infrastructure before a concrete need exists. Changes to financial rules and schema require focused review and tests.
