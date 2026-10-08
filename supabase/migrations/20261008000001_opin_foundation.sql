-- OPIN foundation: enums, provider connections, canonical accounts, exchange rates.
-- Modeled from the REAL Pluggy /accounts + /v2/transactions response (captured 2026-10-08),
-- not from the discarded Lovable schema. All money is stored as integer minor units (cents).
-- Every user-owned table carries user_id + RLS scoped to auth.uid().

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- Currencies observed on the real connections (XP: BRL; Wise: BRL/CAD/ARS/EUR) + USD headroom.
create type public.currency_code as enum ('BRL', 'CAD', 'USD', 'EUR', 'ARS');

-- Open Finance provider. Only Pluggy today; enum leaves room for others.
create type public.of_provider as enum ('PLUGGY');

-- Canonical account kind. Pluggy returns type=BANK|CREDIT with subtypes.
create type public.account_kind as enum ('CHECKING', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'OTHER');

-- Connection sync lifecycle, from the item.status + sync_runs semantics.
create type public.connection_status as enum ('ACTIVE', 'LOGIN_ERROR', 'OUTDATED', 'DISCONNECTED');

-- ---------------------------------------------------------------------------
-- provider_connections : one row per Pluggy Item (BP-026)
-- ---------------------------------------------------------------------------
create table public.provider_connections (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  provider           public.of_provider not null default 'PLUGGY',
  -- Pluggy Item id. Unique per user+provider so re-connecting the same item is idempotent.
  provider_item_id   text not null,
  -- Human label of the institution (e.g. 'XP', 'Wise' via connector MeuPluggy#200).
  institution_name   text not null,
  connector_id       integer,
  status             public.connection_status not null default 'ACTIVE',
  -- Sanitized last error (never a token / raw payload). BP-032.
  last_error         text,
  -- Opaque cursor for incremental /v2/transactions sync (the response 'next' field). BP-032/BP-029.
  sync_cursor        text,
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint provider_connections_item_uniq unique (user_id, provider, provider_item_id)
);

create index provider_connections_user_idx on public.provider_connections (user_id);

alter table public.provider_connections enable row level security;

create policy provider_connections_select on public.provider_connections
  for select using (auth.uid() = user_id);
create policy provider_connections_insert on public.provider_connections
  for insert with check (auth.uid() = user_id);
create policy provider_connections_update on public.provider_connections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy provider_connections_delete on public.provider_connections
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- accounts : canonical account, one per Pluggy account id (BP-027)
-- ---------------------------------------------------------------------------
create table public.accounts (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  connection_id      uuid not null references public.provider_connections (id) on delete cascade,
  -- Pluggy account.id — stable provider identity for upsert (BP-010/BP-027).
  provider_account_id text not null,
  kind               public.account_kind not null,
  name               text not null,
  currency           public.currency_code not null,
  -- Current balance snapshot (minor units). History is derived from transactions, not here.
  balance_cents      bigint not null default 0,
  -- Credit-card fields (Pluggy creditData), null for non-card accounts.
  credit_limit_cents bigint,
  credit_due_day     integer,
  archived           boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint accounts_provider_uniq unique (connection_id, provider_account_id)
);

create index accounts_user_idx on public.accounts (user_id);
create index accounts_connection_idx on public.accounts (connection_id);

alter table public.accounts enable row level security;

create policy accounts_select on public.accounts
  for select using (auth.uid() = user_id);
create policy accounts_insert on public.accounts
  for insert with check (auth.uid() = user_id);
create policy accounts_update on public.accounts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy accounts_delete on public.accounts
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- exchange_rates : historical FX for multi-currency balance (Wise + XP global)
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  base_currency  public.currency_code not null,
  quote_currency public.currency_code not null,
  -- Rate stored as numeric; conversion math lives in the pure domain layer.
  rate           numeric(20, 10) not null,
  effective_on   date not null,
  created_at     timestamptz not null default now(),
  constraint exchange_rates_uniq unique (user_id, base_currency, quote_currency, effective_on),
  constraint exchange_rates_distinct check (base_currency <> quote_currency)
);

create index exchange_rates_lookup_idx
  on public.exchange_rates (user_id, base_currency, quote_currency, effective_on desc);

alter table public.exchange_rates enable row level security;

create policy exchange_rates_select on public.exchange_rates
  for select using (auth.uid() = user_id);
create policy exchange_rates_insert on public.exchange_rates
  for insert with check (auth.uid() = user_id);
create policy exchange_rates_update on public.exchange_rates
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy exchange_rates_delete on public.exchange_rates
  for delete using (auth.uid() = user_id);
