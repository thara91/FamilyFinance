-- Dana darurat: status penghasilan menentukan pengali, dasar hitung pengeluaran rutin,
-- alokasi bulanan dari pemasukan, dan instrumen penampung yang ditandai.

alter table public.households
  add column earning_status text check (earning_status in ('freelance', 'lajang', 'menikah', 'menikah_anak')),
  add column emergency_allocation_pct smallint not null default 10 check (emergency_allocation_pct between 1 and 50);

-- Owner's rule: freelance 12, single 3, married 6, married with children 9 or 12 months of routine spending.
alter table public.households
  add constraint households_emergency_months_match_status check (
    earning_status is null
    or (earning_status = 'freelance' and emergency_target_months = 12)
    or (earning_status = 'lajang' and emergency_target_months = 3)
    or (earning_status = 'menikah' and emergency_target_months = 6)
    or (earning_status = 'menikah_anak' and emergency_target_months in (9, 12))
  );

alter table public.monthly_expenses
  add column is_routine boolean not null default true;

alter table public.accounts drop constraint accounts_kind_check;
alter table public.accounts
  add constraint accounts_kind_check check (kind in ('tabungan', 'giro', 'ewallet', 'rdpu', 'tunai', 'deposito')),
  add column is_emergency boolean not null default false,
  add constraint accounts_emergency_instrument check (not is_emergency or kind in ('tabungan', 'ewallet', 'rdpu'));

create or replace function public.save_baseline(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  hid uuid;
  fam jsonb := payload -> 'household';
  status text;
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

  status := nullif(fam ->> 'earningStatus', '');

  select m.household_id into hid
  from public.household_members m
  where m.user_id = uid and m.role = 'owner'
  order by m.created_at
  limit 1;

  if hid is null then
    insert into public.households (name, earning_status, emergency_target_months, emergency_allocation_pct, created_by)
    values (
      fam ->> 'name',
      status,
      coalesce((fam ->> 'emergencyTargetMonths')::smallint, 6),
      coalesce((fam ->> 'allocationPct')::smallint, 10),
      uid
    )
    returning id into hid;

    insert into public.household_members (household_id, user_id, role, display_name)
    values (hid, uid, 'owner', nullif(btrim(fam ->> 'ownerName'), ''));
  else
    update public.households
    set name = fam ->> 'name',
        earning_status = status,
        emergency_target_months = coalesce((fam ->> 'emergencyTargetMonths')::smallint, 6),
        emergency_allocation_pct = coalesce((fam ->> 'allocationPct')::smallint, 10),
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

  insert into public.accounts (household_id, name, kind, balance, is_emergency)
  select hid, r.name, r.kind, r.balance, coalesce(r."isEmergency", false)
  from jsonb_to_recordset(coalesce(payload -> 'accounts', '[]')) as r (name text, kind text, balance bigint, "isEmergency" boolean);

  insert into public.income_sources (household_id, name, earner, monthly_amount)
  select hid, r.name, nullif(btrim(r.earner), ''), r.amount
  from jsonb_to_recordset(coalesce(payload -> 'incomes', '[]')) as r (name text, earner text, amount bigint);

  insert into public.monthly_expenses (household_id, category, monthly_amount, is_routine)
  select hid, r.category, r.amount, coalesce(r."isRoutine", true)
  from jsonb_to_recordset(coalesce(payload -> 'expenses', '[]')) as r (category text, amount bigint, "isRoutine" boolean);

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
