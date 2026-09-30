# Product Requirements

## Problem and user

Manual imports and categorization make it difficult for an individual or family to know what came in, what went out, where it went, and how much remains in a month.

## Goal

Turn financial data into a reliable, automated, actionable monthly view while retaining transparent, deterministic financial calculations.

## V1 outcomes

The user can connect financial accounts through Open Finance, import history, synchronize without duplicates, inspect and categorize transactions, correct categories, retain corrections after sync, and review monthly income, expenses, result, budgets, and investment contributions. Card purchases, installments, and invoice settlement must not double-count spending. The experience must work on mobile.

## Non-goals for the first release

Complete net-worth management, advanced projections, a financial chatbot, AI-based accounting, native mobile apps, complex multi-tenant authorization, monetization, and public launch.

## Product milestones

- **M0 Foundation:** canonical documentation, development workflow, CI, and review guidance.
- **M1 Domain hardening:** transaction identity, idempotency, user overrides, closed-month safeguards, transfer pairing, and domain tests.
- **M2 Credit cards:** card accounts, billing cycles, installments, settlement, and reconciliation.
- **M3 Open Finance:** provider abstraction, normalized models, connection, account and transaction sync, retries, and override preservation.
- **M4 Personal V1:** monthly dashboard, budgets, search, manual editing, category management, and mobile refinement.
- **M5 Agentic workflow:** focused specialist reviews and automation with human approval.
- **M6 Future:** optional AI insights, planning, projections, and patrimony features.

## Success criteria

The user can explain monthly income, expenses, categories, remaining result, investment allocation, and budget status; repeat synchronization safely; and correct imported data without losing edits. Card bill payment is not counted as a second expense.
