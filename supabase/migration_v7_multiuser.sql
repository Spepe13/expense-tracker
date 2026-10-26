-- ============================================================================
-- FinTrack v7 — Multi-user migration
-- ============================================================================
-- Τρέξε το στο Supabase → SQL Editor, σε ΔΥΟ βήματα:
--
--   ΒΗΜΑ A  (τώρα)                → προσθέτει user_id, RLS, policies
--   Deploy της νέας έκδοσης στο Vercel
--   Κάνε εγγραφή στην εφαρμογή με το email σου
--   ΒΗΜΑ B  (μετά την εγγραφή)   → περνάει τα υπάρχοντα δεδομένα στον λογαριασμό σου
--
-- Ανάμεσα στο A και στο B τα παλιά δεδομένα ΔΕΝ χάνονται, απλώς δεν φαίνονται
-- μέχρι να αποκτήσουν ιδιοκτήτη.
-- ============================================================================


-- ############################################################################
-- ΒΗΜΑ A
-- ############################################################################

-- 1. Στήλη user_id σε όλους τους πίνακες (default = ο συνδεδεμένος χρήστης)
alter table public.installments
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.monthly_budgets
  add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.recurring_items
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.installments    alter column user_id set default auth.uid();
alter table public.monthly_budgets alter column user_id set default auth.uid();
alter table public.recurring_items alter column user_id set default auth.uid();

-- 2. Νέα στήλη: επαναλαμβανόμενα που ο χρήστης έσβησε μόνο για έναν μήνα
--    (στη v6 ξαναεμφανίζονταν μόνα τους — αυτό το διορθώνει)
alter table public.monthly_budgets
  add column if not exists skipped_recurring jsonb not null default '[]'::jsonb;

-- 3. Ο μήνας πλέον είναι μοναδικός ΑΝΑ ΧΡΗΣΤΗ, όχι συνολικά.
--    Αφαιρεί τυχόν παλιό unique constraint / index μόνο στη στήλη month.
do $$
declare r record;
begin
  for r in
    select con.conname
    from pg_constraint con
    join pg_class c      on c.oid = con.conrelid
    join pg_namespace n  on n.oid = c.relnamespace
    join pg_attribute a  on a.attrelid = c.oid and a.attnum = con.conkey[1]
    where n.nspname = 'public'
      and c.relname = 'monthly_budgets'
      and con.contype = 'u'
      and array_length(con.conkey, 1) = 1
      and a.attname = 'month'
  loop
    execute format('alter table public.monthly_budgets drop constraint %I', r.conname);
  end loop;

  for r in
    select i.relname as idxname
    from pg_index x
    join pg_class i      on i.oid = x.indexrelid
    join pg_class c      on c.oid = x.indrelid
    join pg_namespace n  on n.oid = c.relnamespace
    join pg_attribute a  on a.attrelid = c.oid and a.attnum = x.indkey[0]
    where n.nspname = 'public'
      and c.relname = 'monthly_budgets'
      and x.indisunique
      and not x.indisprimary
      and x.indnatts = 1
      and a.attname = 'month'
  loop
    execute format('drop index if exists public.%I', r.idxname);
  end loop;
end $$;

create unique index if not exists monthly_budgets_user_month_key
  on public.monthly_budgets (user_id, month);

create index if not exists installments_user_id_idx    on public.installments (user_id);
create index if not exists recurring_items_user_id_idx on public.recurring_items (user_id);

-- 4. Row Level Security
alter table public.installments    enable row level security;
alter table public.monthly_budgets enable row level security;
alter table public.recurring_items enable row level security;

-- Σβήνει ΟΛΕΣ τις παλιές policies (π.χ. "allow all for anon") σε αυτούς τους πίνακες
do $$
declare r record;
begin
  for r in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in ('installments', 'monthly_budgets', 'recurring_items')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Κάθε χρήστης βλέπει / γράφει ΜΟΝΟ τις δικές του γραμμές
create policy "Own rows" on public.installments
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own rows" on public.monthly_budgets
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Own rows" on public.recurring_items
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Ο anon ρόλος δεν έχει πλέον καμία πρόσβαση
revoke all on public.installments    from anon;
revoke all on public.monthly_budgets from anon;
revoke all on public.recurring_items from anon;

-- 5. Realtime: βεβαιώσου ότι οι πίνακες είναι στο publication
do $$
begin
  begin execute 'alter publication supabase_realtime add table public.installments';    exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.monthly_budgets'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table public.recurring_items'; exception when duplicate_object then null; end;
end $$;


-- ############################################################################
-- ΒΗΜΑ B — τρέξε το ΑΦΟΥ κάνεις εγγραφή στη νέα εφαρμογή
-- Άλλαξε το email παρακάτω με αυτό που χρησιμοποίησες στην εγγραφή.
-- ############################################################################

/*
do $$
declare owner_id uuid;
begin
  select id into owner_id from auth.users where email = 'YOUR_EMAIL@example.com';
  if owner_id is null then
    raise exception 'Δεν βρέθηκε χρήστης με αυτό το email — έκανες εγγραφή;';
  end if;

  update public.installments    set user_id = owner_id where user_id is null;
  update public.monthly_budgets set user_id = owner_id where user_id is null;
  update public.recurring_items set user_id = owner_id where user_id is null;
end $$;

-- Από εδώ και πέρα κάθε γραμμή ΠΡΕΠΕΙ να έχει ιδιοκτήτη
alter table public.installments    alter column user_id set not null;
alter table public.monthly_budgets alter column user_id set not null;
alter table public.recurring_items alter column user_id set not null;
*/
