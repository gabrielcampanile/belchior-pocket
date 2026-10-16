-- Make exchange_rates GLOBAL instead of per-user.
-- An FX rate (e.g. BRL->CAD on a date) is the same for everyone, so scoping it per user
-- would duplicate identical rows. The server (refreshExchangeRates) writes with the
-- service_role key; authenticated clients only read. Also adds the `source` column the
-- code already records (provenance of the quote, e.g. 'open.er-api.com').

-- Drop the per-user policies and the user-scoped unique/index.
drop policy if exists exchange_rates_select on public.exchange_rates;
drop policy if exists exchange_rates_insert on public.exchange_rates;
drop policy if exists exchange_rates_update on public.exchange_rates;
drop policy if exists exchange_rates_delete on public.exchange_rates;

drop index if exists public.exchange_rates_lookup_idx;
alter table public.exchange_rates drop constraint if exists exchange_rates_uniq;

-- Drop user ownership; add provenance.
alter table public.exchange_rates drop column if exists user_id;
alter table public.exchange_rates add column if not exists source text not null default 'unknown';

-- Global uniqueness: one rate per pair per day.
alter table public.exchange_rates
  add constraint exchange_rates_uniq unique (base_currency, quote_currency, effective_on);

create index exchange_rates_lookup_idx
  on public.exchange_rates (base_currency, quote_currency, effective_on desc);

-- RLS stays enabled: any authenticated user may READ; writes are service_role only
-- (no insert/update/delete policy => blocked for anon/authenticated, allowed for the
-- service_role key which bypasses RLS).
create policy exchange_rates_select on public.exchange_rates
  for select to authenticated using (true);
