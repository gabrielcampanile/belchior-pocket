-- Categorization rules (#66): "description contains <pattern> -> <type> / <category>",
-- applied to the past when created and by every future sync. Matching is done in the app
-- (src/domain/rules.ts) so it is the same code for past and future rows.

create table public.categorization_rules (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  -- Stored normalized: lowercase, accent-free, single spaces (normalizeSearch).
  pattern     text not null,
  direction   text not null default 'ANY',
  set_type    public.tx_domain_type,
  -- Deleting the category deletes the rule: a rule without its target means nothing.
  category_id uuid references public.categories (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint categorization_rules_direction check (direction in ('IN', 'OUT', 'ANY')),
  constraint categorization_rules_pattern_len check (char_length(pattern) between 3 and 120),
  constraint categorization_rules_has_effect check (set_type is not null or category_id is not null),
  constraint categorization_rules_uniq unique (user_id, pattern, direction)
);

create index categorization_rules_user_idx on public.categorization_rules (user_id);

alter table public.categorization_rules enable row level security;
create policy categorization_rules_select on public.categorization_rules
  for select using (auth.uid() = user_id);
create policy categorization_rules_insert on public.categorization_rules
  for insert with check (auth.uid() = user_id);
create policy categorization_rules_update on public.categorization_rules
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy categorization_rules_delete on public.categorization_rules
  for delete using (auth.uid() = user_id);

-- Apply many (type, category, amount) patches in one statement. SECURITY INVOKER: RLS on
-- transactions still applies, and the explicit filters keep manual entries and rows the
-- user edited by hand out of reach. Returns how many rows changed.
create function public.apply_transaction_patches(patches jsonb)
returns integer
language sql
security invoker
set search_path = public
as $$
  with p as (
    select *
    from jsonb_to_recordset(patches)
      as x(id uuid, type public.tx_domain_type, category_id uuid, amount_cents bigint)
  ),
  changed as (
    update public.transactions t
       set type = p.type,
           category_id = p.category_id,
           amount_cents = p.amount_cents,
           updated_at = now()
      from p
     where t.id = p.id
       and t.user_id = auth.uid()
       and t.source = 'IMPORT'
       and t.user_overridden = false
    returning 1
  )
  select count(*)::integer from changed;
$$;

revoke all on function public.apply_transaction_patches(jsonb) from public, anon;
grant execute on function public.apply_transaction_patches(jsonb) to authenticated;
