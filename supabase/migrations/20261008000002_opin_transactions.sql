-- OPIN transactions, categories and sync runs.
-- Depends on 20261008000001_opin_foundation.sql.
-- Transaction shape mirrors the REAL /v2/transactions response:
--   id, description, descriptionRaw, currencyCode, amount, amountInAccountCurrency,
--   date, category, categoryId, balance, accountId, status, type (CREDIT/DEBIT),
--   operationType, creditCardMetadata, paymentData, merchant, providerId.
-- Pluggy's `type` is only a sign (CREDIT/DEBIT); the DOMAIN type below is derived by the
-- adapter (BP-025) from type + category + operationType. No AI in the mapping (AGENTS.md).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Canonical domain transaction type. Transfers between own accounts and investment
-- contributions are EXCLUDED from income/expense totals by the domain layer.
create type public.tx_domain_type as enum (
  'EXPENSE',
  'INCOME',
  'TRANSFER',                 -- between the user's own accounts: not income, not expense
  'INVESTMENT_CONTRIBUTION',  -- aporte: an allocation, not an expense
  'CARD_PAYMENT'              -- paying a credit-card bill: a settlement, must not double-count
);

-- Posting status from Pluggy (POSTED / PENDING).
create type public.tx_status as enum ('POSTED', 'PENDING');

-- Where the row came from. IMPORT = Open Finance sync; MANUAL = user-entered.
create type public.tx_source as enum ('IMPORT', 'MANUAL');

-- ---------------------------------------------------------------------------
-- categories : user-editable, maps Pluggy categoryId -> own category (BP-042)
-- ---------------------------------------------------------------------------
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  parent_id   uuid references public.categories (id) on delete set null,
  essential   boolean not null default false,
  -- Pluggy categoryId (e.g. '03010000') this category absorbs, if any. Nullable: own categories.
  provider_category_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categories_name_uniq unique (user_id, name)
);

create index categories_user_idx on public.categories (user_id);

alter table public.categories enable row level security;
create policy categories_select on public.categories for select using (auth.uid() = user_id);
create policy categories_insert on public.categories for insert with check (auth.uid() = user_id);
create policy categories_update on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy categories_delete on public.categories for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- transactions : canonical ledger (BP-010 provider identity, BP-028 sync)
-- ---------------------------------------------------------------------------
create table public.transactions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  account_id         uuid not null references public.accounts (id) on delete cascade,

  -- Provider-scoped stable identity: Pluggy transaction providerId. The upsert key for
  -- idempotent sync (BP-009/BP-010) — NOT a content hash. Null for MANUAL rows.
  provider_tx_id     text,

  -- Economic facts, all integer minor units.
  amount_cents       bigint not null,           -- signed in domain terms (expense negative, income positive)
  currency           public.currency_code not null,
  occurred_on        date not null,             -- from `date`
  description         text not null,

  -- Domain classification (derived by adapter; the authoritative type for all math).
  type               public.tx_domain_type not null,
  status             public.tx_status not null default 'POSTED',
  source             public.tx_source not null default 'IMPORT',

  category_id        uuid references public.categories (id) on delete set null,

  -- Provider metadata kept for traceability/reconciliation, minimized (no full raw payload).
  provider_operation_type text,                 -- PIX / TED / BOLETO / CARTAO / RENDIMENTO...
  provider_category_id    text,                 -- raw Pluggy categoryId before mapping

  -- User-override guard: once a user edits a row, sync must not clobber it (BP-031).
  user_overridden    boolean not null default false,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- Provider identity is unique within its account scope. Partial unique so MANUAL
  -- rows (provider_tx_id null) are never blocked.
  constraint transactions_provider_uniq unique (account_id, provider_tx_id)
);

create index transactions_user_month_idx on public.transactions (user_id, occurred_on);
create index transactions_account_idx on public.transactions (account_id);
create index transactions_type_idx on public.transactions (user_id, type, occurred_on);

alter table public.transactions enable row level security;
create policy transactions_select on public.transactions for select using (auth.uid() = user_id);
create policy transactions_insert on public.transactions for insert with check (auth.uid() = user_id);
create policy transactions_update on public.transactions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy transactions_delete on public.transactions for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- sync_runs : observability of each sync attempt (BP-032)
-- ---------------------------------------------------------------------------
create table public.sync_runs (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  connection_id  uuid not null references public.provider_connections (id) on delete cascade,
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  -- 'running' | 'success' | 'auth_error' | 'transient_error' | 'permanent_error'
  status         text not null default 'running',
  -- Sanitized error only (never token / raw payload).
  error          text,
  -- Window + counts for auditability.
  range_from     date,
  range_to       date,
  accounts_synced     integer not null default 0,
  transactions_upserted integer not null default 0,
  cursor_before  text,
  cursor_after   text,
  created_at     timestamptz not null default now()
);

create index sync_runs_connection_idx on public.sync_runs (connection_id, started_at desc);

alter table public.sync_runs enable row level security;
create policy sync_runs_select on public.sync_runs for select using (auth.uid() = user_id);
create policy sync_runs_insert on public.sync_runs for insert with check (auth.uid() = user_id);
create policy sync_runs_update on public.sync_runs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy sync_runs_delete on public.sync_runs for delete using (auth.uid() = user_id);
