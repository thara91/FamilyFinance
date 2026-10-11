-- Rekening kini diperbarui di tempat (bukan dihapus lalu dibuat ulang), agar transaksi tetap menempel pada rekeningnya.
-- Saldo yang berubah mencatat ulang balance_set_at.

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
  kept uuid[];
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

    delete from public.income_sources where household_id = hid;
    delete from public.monthly_expenses where household_id = hid;
    delete from public.debts where household_id = hid;
    delete from public.assets where household_id = hid;
  end if;

  update public.accounts a
  set name = r.name,
      kind = r.kind,
      is_emergency = coalesce(r."isEmergency", false),
      balance_set_at = case when a.balance is distinct from r.balance then now() else a.balance_set_at end,
      balance = r.balance
  from jsonb_to_recordset(coalesce(payload -> 'accounts', '[]'))
    as r (id text, name text, kind text, balance bigint, "isEmergency" boolean)
  where a.household_id = hid and a.id::text = r.id;

  select coalesce(array_agg(a.id), '{}') into kept
  from public.accounts a
  join jsonb_to_recordset(coalesce(payload -> 'accounts', '[]')) as r (id text) on a.id::text = r.id
  where a.household_id = hid;

  delete from public.accounts where household_id = hid and id <> all (kept);

  insert into public.accounts (household_id, name, kind, balance, is_emergency)
  select hid, r.name, r.kind, r.balance, coalesce(r."isEmergency", false)
  from jsonb_to_recordset(coalesce(payload -> 'accounts', '[]'))
    as r (id text, name text, kind text, balance bigint, "isEmergency" boolean)
  where r.id is null or not (r.id = any (select k::text from unnest(kept) k));

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
