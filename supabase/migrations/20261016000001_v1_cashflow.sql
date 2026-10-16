-- v1 cashflow: customizable income/expense categories with a FIXED monthly budget,
-- manual accounts next to Open Finance ones, and per-transaction hide/notes.
-- Depends on 20261008000001/2/4. Scope: monthly balance by category (no planning,
-- scenarios or investments — those are v2).

-- ---------------------------------------------------------------------------
-- categories: user-customizable, split into INCOME and EXPENSE
-- ---------------------------------------------------------------------------
create type public.category_kind as enum ('INCOME', 'EXPENSE');

alter table public.categories
  add column kind public.category_kind not null default 'EXPENSE',
  -- Fixed monthly budget for this category (minor units, BRL). Null = no budget.
  -- The total budget is the sum over EXPENSE categories; no per-month history (v1).
  add column monthly_budget_cents bigint,
  add column color text,
  add column sort_order integer not null default 0,
  add constraint categories_budget_non_negative
    check (monthly_budget_cents is null or monthly_budget_cents >= 0);

-- The same name may exist once per kind (e.g. "Outros" as income and as expense).
alter table public.categories drop constraint categories_name_uniq;
alter table public.categories
  add constraint categories_name_uniq unique (user_id, kind, name);

-- At most one category per Pluggy categoryId per kind, so auto-mapping is deterministic.
create unique index categories_provider_uniq
  on public.categories (user_id, kind, provider_category_id)
  where provider_category_id is not null;

-- ---------------------------------------------------------------------------
-- accounts: allow MANUAL accounts (e.g. cash) besides Open Finance ones
-- ---------------------------------------------------------------------------
alter table public.accounts
  add column source public.tx_source not null default 'IMPORT',
  alter column connection_id drop not null,
  alter column provider_account_id drop not null,
  add constraint accounts_import_has_provider check (
    source = 'MANUAL' or (connection_id is not null and provider_account_id is not null)
  );

-- ---------------------------------------------------------------------------
-- transactions: manual CRUD support
-- ---------------------------------------------------------------------------
alter table public.transactions
  -- Hiding instead of deleting: an Open Finance row deleted here would come back on the
  -- next sync. Hidden rows are excluded from every total. MANUAL rows may be deleted.
  add column hidden boolean not null default false,
  add column notes text;

create index transactions_visible_month_idx
  on public.transactions (user_id, occurred_on)
  where hidden = false;
