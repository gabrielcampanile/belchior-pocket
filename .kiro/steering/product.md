---
inclusion: always
---

# Product

Belchior Pocket is a personal finance app for one household. V1 is live: monthly cash flow
from Open Finance (Pluggy: XP and Wise), categories with a fixed monthly budget, a
transaction statement with manual edits, and reports.

Read before changing behavior:

- What the product does and its rules: #[[file:docs/PRD.md]]
- Financial rules (authoritative): #[[file:docs/DOMAIN-RULES.md]]
- What is next: #[[file:docs/ROADMAP.md]]

Non-negotiables:

- Only INCOME and EXPENSE count in totals; transfers, card bill payments and investment
  contributions never do.
- Money is integer cents; no AI in any arithmetic.
- A user edit to an imported row must survive sync (`user_overridden`).
- Pluggy types never reach `src/domain`.
- Secrets only on the server; never a `VITE_` prefix for a secret.

Work flow: GitHub issue → (spec in `.kiro/specs/` if bigger than a day) → branch → PR with
CI green → human review → squash merge. Update `docs/` in the same PR when behavior or
schema changes.
