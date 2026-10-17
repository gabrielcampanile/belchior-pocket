# Data model

The schema below is what is live in the Supabase project, built from
`supabase/migrations/` (forward-only). Generated types:
`src/integrations/supabase/types.ts` (`supabase gen types`, never hand-edited). Every table
has RLS; private tables are scoped by `user_id = auth.uid()`.

## Tables

| Table                  | Purpose                                                                                                                                                                         | Identity / constraints                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `provider_connections` | one row per Pluggy item: institution, status, `last_synced_at`, sanitized `last_error`                                                                                          | unique `(user_id, provider, provider_item_id)`                                                          |
| `accounts`             | canonical account: `kind`, `name`, `currency`, `balance_cents`, card `credit_limit_cents` / `credit_due_day`, `source`, `archived`                                              | unique `(connection_id, provider_account_id)`; `source = MANUAL` allows no connection                   |
| `transactions`         | the ledger: signed `amount_cents`, `currency`, `occurred_on`, `description`, `type`, `status`, `source`, `category_id`, `hidden`, `notes`, `user_overridden`, provider metadata | unique `(account_id, provider_tx_id)`; manual rows have `provider_tx_id = null`                         |
| `categories`           | user categories: `kind` (INCOME/EXPENSE), `name`, optional fixed `monthly_budget_cents` (BRL), `color`                                                                          | unique `(user_id, kind, name)`                                                                          |
| `category_mappings`    | Pluggy top-level category → user category, per kind                                                                                                                             | unique `(user_id, kind, provider_category_id)`; cascades on category delete                             |
| `exchange_rates`       | **global** FX history: `base_currency`, `quote_currency`, `rate`, `effective_on`, `source`                                                                                      | unique `(base, quote, effective_on)`; readable by authenticated users, written only by the service role |
| `sync_runs`            | one row per sync attempt: status, range, counts, sanitized error                                                                                                                | —                                                                                                       |

## Enums

- `currency_code`: BRL, CAD, USD, EUR, ARS
- `account_kind`: CHECKING, CREDIT_CARD, INVESTMENT, CASH, OTHER
- `tx_domain_type`: EXPENSE, INCOME, TRANSFER, INVESTMENT_CONTRIBUTION, CARD_PAYMENT
- `tx_status`: POSTED, PENDING · `tx_source`: IMPORT, MANUAL
- `category_kind`: INCOME, EXPENSE · `connection_status`: ACTIVE, LOGIN_ERROR, OUTDATED, DISCONNECTED

## Invariants

- **Sign convention:** EXPENSE and CARD_PAYMENT negative, INCOME positive; TRANSFER and
  INVESTMENT_CONTRIBUTION keep the movement's direction. A positive EXPENSE is a refund.
- **Identity is the provider id**, never a content hash. Re-sync upserts on
  `(account_id, provider_tx_id)`.
- **`user_overridden = true`** rows are skipped by the sync entirely.
- **`hidden = true`** rows are excluded from every total and are not re-shown by sync.
- **Pending rows** that disappear from a complete re-read of their window are deleted
  (unless overridden), so a pending→posted change never double-counts.
- **No stored monthly balances**: monthly figures are derived from transactions in
  `src/domain/cashflow.ts`.
- **Manual accounts** (`source = MANUAL`): `balance_cents` is the opening balance the user
  typed; the shown balance is opening + all visible transactions on the account. They are
  archived, not deleted, once they have transactions (delete would cascade the history).
- **Budgets** are a fixed BRL value per expense category; the month total is their sum and
  is compared with all expenses of the month.

## Where the logic lives

| Concern                                     | Module                                         |
| ------------------------------------------- | ---------------------------------------------- |
| Pluggy → canonical DTO, type classification | `src/integrations/open-finance/adapter.ts`     |
| Idempotent sync plan (pure)                 | `src/integrations/open-finance/sync.ts`        |
| Sync persistence (server, service role)     | `src/integrations/open-finance/sync.server.ts` |
| Default categories from Pluggy groups       | `src/integrations/open-finance/categories.ts`  |
| Monthly cash flow, budget, history          | `src/domain/cashflow.ts`                       |
| Transaction filters, sign rules             | `src/domain/transactions.ts`                   |
| Currency conversion                         | `src/domain/exchange.ts`                       |

## Changing the schema

Add a new migration (never edit an applied one), apply with `supabase db push`, regenerate
types, and update this file in the same PR. Destructive statements (`drop table`) are run
by the owner in the SQL editor, followed by `supabase migration repair` if needed.
