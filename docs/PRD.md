# Product Requirements Document

Status: **V1 shipped** (2026-10-16, https://belchiorpocket.vercel.app). This document
describes what the product is today and the rules it must keep. Planned work lives in
[ROADMAP.md](ROADMAP.md); history of how we got here is in the closed issues and PRs.

## Problem

Tracking monthly finances by hand (exporting statements, categorizing, building charts at
month end) gives a late snapshot and does not show how the current month is going. The XP
app already covers investments and net worth well; what is missing is a reliable,
automatic view of **where the money went**.

## V1 scope — monthly cash flow from Open Finance

V1 answers two questions:

1. **How did I spend my money in past months, by category?**
2. **How am I spending this month, against my budget?**

| Screen                     | What it does                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mês atual (`/`)            | Income, expenses and balance of the month so far; spending by category; fixed monthly budget per expense category with progress (warning at 80%, over at 100%) and month pace. Category and budget editor in a side sheet. |
| Transações (`/transacoes`) | Open Finance statement plus manual entries: month or last 12 months, search, filters (account, category, type, hidden), inline recategorization, edit, hide/unhide, create/delete manual entries.                          |
| Relatórios (`/relatorios`) | 3, 6, 12 months or year to date: monthly income vs expenses with balance, month table, share by category (expenses and income), one category over time.                                                                    |
| Conexões (`/conexoes`)     | Pluggy connections (XP, Wise), last sync, sanitized errors, accounts and balances, "Sincronizar agora".                                                                                                                    |

### Data source and freshness

- Pluggy (Meu Pluggy) items configured on the server (`PLUGGY_ITEM_IDS`); one owner
  (`PLUGGY_OWNER_USER_ID`).
- Sync runs when the app opens if the last one is older than 6 hours, and on demand.
  Pluggy refreshes bank data about once a day, so "current" means up to today/yesterday.
- First sync imports the full available history; later syncs re-read the last 30 days.
- Exchange rates: daily latest (open.er-api.com) plus historical backfill (ECB via
  Frankfurter); every amount is converted on its own date.

### Users

One household, one account (the owner). The partner may use the same login. No teams,
invitations or roles. Sign-ups are disabled in Supabase once the owner exists.

## Product rules (authoritative details in [DOMAIN-RULES.md](DOMAIN-RULES.md))

1. Monthly result = income − expenses. Only `INCOME` and `EXPENSE` count.
2. Transfers between own accounts, card bill payments and investment contributions never
   count as income or expense.
3. A card purchase is spending on its date; a card refund is an expense stored positive and
   reduces spending.
4. Money is integer cents; arithmetic is deterministic and never uses AI.
5. A user edit to an imported row survives every future sync (`user_overridden`).
6. Imported rows are hidden, never deleted (they would come back); manual rows can be
   deleted.
7. Categories are the user's: renamable, mergeable, with an optional fixed BRL budget.
   Merging moves the Pluggy mapping so future syncs land in the target.
8. Provider data is normalized at the boundary; the domain never sees Pluggy types.
9. Secrets stay on the server; browser access goes through RLS.

## Out of V1

Net worth and investments, projections, scenarios and planning, AI categorization and
insights, CSV import, monthly closures, credit-card invoices and installment modeling,
multi-user, native app. See [ROADMAP.md](ROADMAP.md).

## Success criteria (met)

- Real XP and Wise accounts connected; history imported; re-sync creates no duplicates.
- Transactions auto-categorized from Pluggy groups; corrections persist after sync.
- Current month and past months readable by category, with budget progress.
- Card bill payment does not double-count purchases.
- Deployed with secrets server-side only.
