# Belchior Pocket

Belchior Pocket is a personal and family finance workspace for understanding monthly income, expenses, cash flow, budgets, and recent history. Its north star is reliable financial information with simple, mobile friendly use.

## Current focus

The first product phase prioritizes the present and recent past: accounts, transactions, income and expenses, budgets, and monthly reporting. Open Finance is the intended data source, but provider integration must follow domain normalization and safe synchronization design.

## Financial invariants

- Monthly result is income minus expenses.
- Transfers between the user's own accounts are neither income nor expense.
- Investment contributions are allocations, not operating expenses.
- Financial arithmetic is deterministic and uses integer cents.
- User corrections must survive future synchronization.
- Paying a card invoice must not count purchases a second time.

## Development

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup and quality commands, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries, and [docs/PRD.md](docs/PRD.md) for scope and milestones. The baseline audit is in [docs/audit/BASELINE-AUDIT.md](docs/audit/BASELINE-AUDIT.md).

## Product direction

The project is personal/family use. Keep the implementation small and secure. Do not add AI to financial calculations, couple domain concepts to an external provider, or introduce large infrastructure before a concrete need exists. Changes to financial rules and schema require focused review and tests.
