-- Transaksi harian, anggaran per kategori, dan lampiran struk.
-- Saldo rekening dicatat pada balance_set_at; saldo berjalan = saldo itu + transaksi sesudahnya.

alter table public.accounts
  add column balance_set_at timestamptz not null default now(),
  add constraint accounts_id_household_key unique (id, household_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  account_id uuid,
  occurred_on date not null,
  direction text not null check (direction in ('masuk', 'keluar')),
  amount bigint not null check (amount > 0 and amount < 1000000000000000),
  category text not null check (char_length(btrim(category)) between 1 and 60),
  description text not null check (char_length(btrim(description)) between 1 and 140),
  note text check (char_length(note) <= 500),
  source text not null default 'manual' check (source in ('manual', 'struk', 'mutasi')),
  receipt_path text check (receipt_path is null or receipt_path like household_id::text || '/%'),
  import_ref text check (char_length(import_ref) <= 80),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- The account must belong to the same household; deleting it keeps the transaction.
  foreign key (account_id, household_id) references public.accounts (id, household_id) on delete set null (account_id),
  unique (household_id, import_ref)
);

create index transactions_household_date_idx on public.transactions (household_id, occurred_on desc);
create index transactions_account_idx on public.transactions (account_id);

create table public.budgets (
  household_id uuid not null references public.households (id) on delete cascade,
  category text not null check (char_length(btrim(category)) between 1 and 60),
  monthly_limit bigint not null check (monthly_limit > 0 and monthly_limit < 1000000000000000),
  updated_at timestamptz not null default now(),
  primary key (household_id, category)
);

alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

create policy "members read transactions" on public.transactions
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write transactions" on public.transactions
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create policy "members read budgets" on public.budgets
  for select to authenticated using (public.has_household_role(household_id, array['owner', 'member', 'viewer']));
create policy "editors write budgets" on public.budgets
  for all to authenticated
  using (public.has_household_role(household_id, array['owner', 'member']))
  with check (public.has_household_role(household_id, array['owner', 'member']));

create view public.account_balances with (security_invoker = true) as
select
  a.id,
  a.household_id,
  a.name,
  a.kind,
  a.is_emergency,
  a.balance as opening_balance,
  a.balance_set_at,
  -- A transaction counts if it is dated after the day the balance was taken, or dated that day and recorded after it.
  a.balance + coalesce(sum(case when t.direction = 'masuk' then t.amount else -t.amount end) filter (where
    t.occurred_on > (a.balance_set_at at time zone 'Asia/Jakarta')::date
    or (t.occurred_on = (a.balance_set_at at time zone 'Asia/Jakarta')::date and t.created_at > a.balance_set_at)), 0) as current_balance
from public.accounts a
left join public.transactions t on t.account_id = a.id
group by a.id;

grant select on public.account_balances to authenticated;

-- Receipt photos live under "<household_id>/<file>"; the folder decides who may touch them.
create function public.can_access_receipt(object_name text, allowed text[])
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when split_part(object_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_household_role(split_part(object_name, '/', 1)::uuid, allowed)
    else false
  end;
$$;

revoke execute on function public.can_access_receipt(text, text[]) from public, anon;
grant execute on function public.can_access_receipt(text, text[]) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "members read receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.can_access_receipt(name, array['owner', 'member', 'viewer']));
create policy "editors upload receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_access_receipt(name, array['owner', 'member']));
create policy "editors delete receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and public.can_access_receipt(name, array['owner', 'member']));
