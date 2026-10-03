-- Kas Keluarga: kondisi keuangan awal keluarga.
-- Semua nominal disimpan sebagai rupiah bulat (bigint), tanpa desimal.

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  currency text not null default 'IDR' check (currency = 'IDR'),
  dependents smallint not null default 0 check (dependents between 0 and 20),
  emergency_target_months smallint not null default 6 check (emergency_target_months between 1 and 24),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member', 'viewer')),
  display_name text check (char_length(display_name) <= 60),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index household_members_user_idx on public.household_members (user_id);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('tabungan', 'giro', 'ewallet', 'tunai', 'deposito')),
  balance bigint not null default 0 check (balance >= 0),
  created_at timestamptz not null default now()
);

create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  earner text check (char_length(earner) <= 60),
  monthly_amount bigint not null check (monthly_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.monthly_expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  monthly_amount bigint not null check (monthly_amount >= 0),
  created_at timestamptz not null default now()
);

create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('kpr', 'kendaraan', 'kartu_kredit', 'pinjaman')),
  principal_remaining bigint not null check (principal_remaining >= 0),
  monthly_installment bigint not null check (monthly_installment >= 0),
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  kind text not null check (kind in ('properti', 'kendaraan', 'emas', 'reksa_dana', 'saham', 'obligasi', 'lainnya')),
  current_value bigint not null check (current_value >= 0),
  created_at timestamptz not null default now()
);

create index accounts_household_idx on public.accounts (household_id);
create index income_sources_household_idx on public.income_sources (household_id);
create index monthly_expenses_household_idx on public.monthly_expenses (household_id);
create index debts_household_idx on public.debts (household_id);
create index assets_household_idx on public.assets (household_id);

-- Security definer so policies can check membership without recursing into household_members' own policy.
create function public.has_household_role(target uuid, allowed text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members m
    where m.household_id = target
      and m.user_id = (select auth.uid())
      and m.role = any (allowed)
  );
$$;

revoke execute on function public.has_household_role(uuid, text[]) from public, anon;
grant execute on function public.has_household_role(uuid, text[]) to authenticated;

alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.accounts enable row level security;
alter table public.income_sources enable row level security;
alter table public.monthly_expenses enable row level security;
alter table public.debts enable row level security;
alter table public.assets enable row level security;

create policy "members read their household" on public.households
  for select to authenticated
  using (public.has_household_role(id, array['owner', 'member', 'viewer']));

create policy "owner updates household" on public.households
  for update to authenticated
  using (public.has_household_role(id, array['owner']))
  with check (public.has_household_role(id, array['owner']));

-- Membership rows are written only by save_baseline (and a future invite flow), never directly.
create policy "members read co-members" on public.household_members
  for select to authenticated
  using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));

create policy "members read accounts" on public.accounts
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write accounts" on public.accounts
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create policy "members read income" on public.income_sources
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write income" on public.income_sources
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create policy "members read expenses" on public.monthly_expenses
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write expenses" on public.monthly_expenses
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create policy "members read debts" on public.debts
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write debts" on public.debts
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create policy "members read assets" on public.assets
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write assets" on public.assets
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

-- Saves the whole onboarding form in one transaction: creates the caller's household on first run,
-- and on later runs replaces the baseline rows of the household the caller owns.
create function public.save_baseline(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  fam jsonb := payload -> 'household';
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if jsonb_typeof(fam) is distinct from 'object' then
    raise exception 'household is required' using errcode = '22023';
  end if;

  if greatest(
    jsonb_array_length(coalesce(payload -> 'accounts', '[]')),
    jsonb_array_length(coalesce(payload -> 'incomes', '[]')),
    jsonb_array_length(coalesce(payload -> 'expenses', '[]')),
    jsonb_array_length(coalesce(payload -> 'debts', '[]')),
    jsonb_array_length(coalesce(payload -> 'assets', '[]'))
  ) > 50 then
    raise exception 'too many rows' using errcode = '22023';
  end if;

  select m.household_id into hid
  from public.household_members m
  where m.user_id = uid and m.role = 'owner'
  order by m.created_at
  limit 1;

  if hid is null then
    insert into public.households (name, dependents, emergency_target_months, created_by)
    values (
      fam ->> 'name',
      coalesce((fam ->> 'dependents')::smallint, 0),
      coalesce((fam ->> 'emergencyTargetMonths')::smallint, 6),
      uid
    )
    returning id into hid;

    insert into public.household_members (household_id, user_id, role, display_name)
    values (hid, uid, 'owner', nullif(btrim(fam ->> 'ownerName'), ''));
  else
    update public.households
    set name = fam ->> 'name',
        dependents = coalesce((fam ->> 'dependents')::smallint, 0),
        emergency_target_months = coalesce((fam ->> 'emergencyTargetMonths')::smallint, 6),
        updated_at = now()
    where id = hid;

    update public.household_members
    set display_name = nullif(btrim(fam ->> 'ownerName'), '')
    where household_id = hid and user_id = uid;

    delete from public.accounts where household_id = hid;
    delete from public.income_sources where household_id = hid;
    delete from public.monthly_expenses where household_id = hid;
    delete from public.debts where household_id = hid;
    delete from public.assets where household_id = hid;
  end if;

  insert into public.accounts (household_id, name, kind, balance)
  select hid, r.name, r.kind, r.balance
  from jsonb_to_recordset(coalesce(payload -> 'accounts', '[]')) as r (name text, kind text, balance bigint);

  insert into public.income_sources (household_id, name, earner, monthly_amount)
  select hid, r.name, nullif(btrim(r.earner), ''), r.amount
  from jsonb_to_recordset(coalesce(payload -> 'incomes', '[]')) as r (name text, earner text, amount bigint);

  insert into public.monthly_expenses (household_id, category, monthly_amount)
  select hid, r.category, r.amount
  from jsonb_to_recordset(coalesce(payload -> 'expenses', '[]')) as r (category text, amount bigint);

  insert into public.debts (household_id, name, kind, principal_remaining, monthly_installment)
  select hid, r.name, r.kind, r.principal, r.installment
  from jsonb_to_recordset(coalesce(payload -> 'debts', '[]')) as r (name text, kind text, principal bigint, installment bigint);

  insert into public.assets (household_id, name, kind, current_value)
  select hid, r.name, r.kind, r.value
  from jsonb_to_recordset(coalesce(payload -> 'assets', '[]')) as r (name text, kind text, value bigint);

  return hid;
end;
$$;

revoke execute on function public.save_baseline(jsonb) from public, anon;
grant execute on function public.save_baseline(jsonb) to authenticated;
