-- Category mappings: which of the user's categories absorbs each Pluggy category group.
-- Depends on 20261016000001_v1_cashflow.sql.
--
-- Why a separate table instead of categories.provider_category_id: the user customizes
-- categories (rename, merge, delete). With the mapping in its own row, renaming a category
-- keeps the mapping, several Pluggy groups can point to the same category, and remapping a
-- group never touches the category itself. The sync creates a mapping (and a category
-- named after the Pluggy group, in Portuguese) the first time it sees a group; after that
-- it only reads the mapping.

create table public.category_mappings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users (id) on delete cascade,
  -- Same Pluggy group can feed an INCOME and an EXPENSE category (e.g. transfers).
  kind                 public.category_kind not null,
  -- Top-level Pluggy categoryId (e.g. '17000000'), the grouping level used by the sync.
  provider_category_id text not null,
  category_id          uuid not null references public.categories (id) on delete cascade,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  constraint category_mappings_uniq unique (user_id, kind, provider_category_id)
);

create index category_mappings_category_idx on public.category_mappings (category_id);

alter table public.category_mappings enable row level security;
create policy category_mappings_select on public.category_mappings
  for select using (auth.uid() = user_id);
create policy category_mappings_insert on public.category_mappings
  for insert with check (auth.uid() = user_id);
create policy category_mappings_update on public.category_mappings
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy category_mappings_delete on public.category_mappings
  for delete using (auth.uid() = user_id);

-- The mapping now lives in category_mappings; the per-category column is redundant.
drop index if exists public.categories_provider_uniq;
alter table public.categories drop column provider_category_id;
