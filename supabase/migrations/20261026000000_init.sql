-- ============================================================================
-- FinTrack — πλήρες schema για ΚΑΙΝΟΥΡΓΙΑ εγκατάσταση
-- ============================================================================
-- Χρήση:
--   • Supabase CLI:  npx supabase link --project-ref <ref> && npx supabase db push
--   • ή επικόλλησε όλο το αρχείο στον SQL Editor του Supabase και πάτα Run.
--
-- ΣΗΜΕΙΩΣΗ: Αν αναβαθμίζεις υπάρχουσα βάση της v6, ΜΗΝ τρέξεις αυτό —
-- χρησιμοποίησε το supabase/migration_v7_multiuser.sql.
-- ============================================================================

-- ---------------------------------------------------------------- tables
create table if not exists public.installments (
  id                 bigint primary key,
  user_id            uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name               text not null,
  amount             numeric(12, 2) not null check (amount >= 0),
  start_date         date not null,
  total_installments integer not null check (total_installments > 0),
  day_of_month       integer not null default 1 check (day_of_month between 1 and 31),
  payments           jsonb not null default '[]'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.monthly_budgets (
  id                bigint primary key,
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  month             text not null check (month ~ '^\d{4}-\d{2}$'),
  incomes           jsonb not null default '[]'::jsonb,
  expenses          jsonb not null default '[]'::jsonb,
  skipped_recurring jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.recurring_items (
  id          bigint primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  type        text not null check (type in ('income', 'expense')),
  description text not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  category    text,
  start_month text check (start_month ~ '^\d{4}-\d{2}$'),
  end_month   text check (end_month ~ '^\d{4}-\d{2}$'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes
create unique index if not exists monthly_budgets_user_month_key on public.monthly_budgets (user_id, month);
create index if not exists installments_user_id_idx    on public.installments (user_id);
create index if not exists recurring_items_user_id_idx on public.recurring_items (user_id);

-- ---------------------------------------------------------------- row level security
alter table public.installments    enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.recurring_items enable row level security;

drop policy if exists "Own rows" on public.installments;
drop policy if exists "Own rows" on public.monthly_budgets;
drop policy if exists "Own rows" on public.recurring_items;

create policy "Own rows" on public.installments
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own rows" on public.monthly_budgets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own rows" on public.recurring_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.installments    from anon;
revoke all on public.monthly_budgets from anon;
revoke all on public.recurring_items from anon;

grant select, insert, update, delete on public.installments    to authenticated;
grant select, insert, update, delete on public.monthly_budgets to authenticated;
grant select, insert, update, delete on public.recurring_items to authenticated;

-- ---------------------------------------------------------------- realtime
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin execute 'alter publication supabase_realtime add table public.installments';    exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.monthly_budgets'; exception when duplicate_object then null; end;
    begin execute 'alter publication supabase_realtime add table public.recurring_items'; exception when duplicate_object then null; end;
  end if;
end $$;
