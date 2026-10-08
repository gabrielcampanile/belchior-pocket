# OPIN schema — design notes

Modeled from the **real** Pluggy response captured 2026-10-08 (XP + Wise items), not from
the discarded Lovable schema. The old Lovable migrations were deleted; the database is
rebuilt from scratch for the Open Finance (OPIN) integration.

## Source of truth: the real Pluggy contract

- **Accounts** (`GET /accounts?itemId=`): `type` (BANK/CREDIT), `subtype`
  (CHECKING_ACCOUNT/CREDIT_CARD), `currencyCode`, `balance`, `creditData` (card limit,
  due/close dates, minimum payment), `bankData`.
- **Transactions** (`GET /v2/transactions?accountId=`, **cursor pagination** via the
  response `next` field — the v1 `/transactions` endpoint returns **410 DEPRECATED** and
  does **not** accept `from`/`pageSize`). Each row:
  `id, description, descriptionRaw, currencyCode, amount, amountInAccountCurrency, date,
  category, categoryId, balance, accountId, status (POSTED/PENDING), type (CREDIT/DEBIT),
  operationType (PIX/TED/BOLETO/CARTAO/RENDIMENTO_APLIC_FINANCEIRA/OUTROS),
  creditCardMetadata, paymentData, merchant, providerId`.
- **Investments** (`GET /investments?itemId=`): rich schema (ISIN, rates, maturity). Out of
  scope for the monthly-balance feature; endpoint noted for later.

## Key modeling decisions

1. **Money is integer minor units (cents)** everywhere (`*_cents bigint`). Invariant from
   AGENTS.md.
2. **Pluggy `type` (CREDIT/DEBIT) is only a sign, not the domain type.** The adapter
   (BP-025) derives the canonical `tx_domain_type` from `type` + `category` +
   `operationType`:
   - `category` in {`Transfer - PIX`, `Transfer - TED`, `Transfers`, `Same person
     transfer`} + a counterparty that is one of the user's own accounts -> **TRANSFER**
     (excluded from income/expense).
   - `category = Automatic investment` / `operationType = RENDIMENTO_APLIC_FINANCEIRA`
     -> **INVESTMENT_CONTRIBUTION** (aporte: an allocation, not an expense).
   - a payment toward a `CREDIT_CARD` account -> **CARD_PAYMENT** (settlement, must not
     double-count the original purchases).
   - otherwise DEBIT -> **EXPENSE**, CREDIT -> **INCOME**.
   No AI is used in this mapping (AGENTS.md): it is deterministic and testable against the
   fixtures in `src/integrations/open-finance/__fixtures__/`.
3. **Provider-scoped identity, not content hash.** `transactions.provider_tx_id` stores
   Pluggy's `providerId`, unique within `(account_id, provider_tx_id)`. This is the upsert
   key for idempotent sync (BP-009/BP-010). MANUAL rows have `provider_tx_id = NULL` and
   are never blocked by the unique constraint.
4. **User overrides survive sync.** `transactions.user_overridden` tells the sync to skip
   re-writing a row the user edited (BP-031).
5. **Multi-currency.** `currency_code` enum (BRL/CAD/USD/EUR/ARS — exactly the currencies
   on the Wise item) + `exchange_rates` with historical FX. Conversion math stays in the
   pure domain layer (`src/domain/exchange.ts`), never in SQL.
6. **Balance history comes from transactions, not snapshots.** Pluggy gives one current
   balance per account; the "12 months back" series is derived by replaying transactions.
7. **Observability.** `sync_runs` records each attempt (status, sanitized error, range,
   counts, cursor before/after) for BP-032. No token or raw payload is ever persisted.
8. **RLS everywhere.** Every table carries `user_id` and policies scoped to `auth.uid()`.

## Tables

| Table | Purpose | Key issue |
|---|---|---|
| `provider_connections` | one row per Pluggy Item (institution, status, sync cursor) | BP-026 |
| `accounts` | canonical account, keyed by `provider_account_id` | BP-027 |
| `transactions` | canonical ledger with provider identity + domain type | BP-010/BP-028 |
| `categories` | user categories, maps Pluggy `categoryId` | BP-042 |
| `exchange_rates` | historical FX for multi-currency balance | — |
| `sync_runs` | per-attempt observability | BP-032 |

## Migrations

- `20261008000001_opin_foundation.sql` — enums, `provider_connections`, `accounts`,
  `exchange_rates`.
- `20261008000002_opin_transactions.sql` — `categories`, `transactions`, `sync_runs`.

Both are forward-only and apply on a clean database (`supabase db reset`).
