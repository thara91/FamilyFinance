// Runs the Supabase migrations against an in-process Postgres (PGlite) with a stubbed auth schema,
// then checks save_baseline and the row level security policies as two different users.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const db = new PGlite();

await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
`);

const dir = new URL('../../supabase/migrations/', import.meta.url);
for (const file of readdirSync(dir).sort()) {
  await db.exec(readFileSync(new URL(file, dir), 'utf8'));
}

await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users (id) values ('${A}'), ('${B}')`);

async function as(user, sql, params = []) {
  await db.exec('reset role');
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user ?? '']);
  await db.exec(user ? 'set role authenticated' : 'set role anon');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

const payload = (name, accounts, extra = {}) => JSON.stringify({
  household: { name, ownerName: 'Ayah', earningStatus: 'lajang', emergencyTargetMonths: 3, allocationPct: 10, ...extra.household },
  accounts,
  incomes: [{ name: 'Gaji', earner: 'Ayah', amount: 18500000 }],
  expenses: [{ category: 'Rumah tangga & makan', amount: 4000000, isRoutine: true }, { category: 'Hiburan', amount: 1000000, isRoutine: false }],
  debts: [{ name: 'KPR rumah', kind: 'kpr', principal: 420000000, installment: 7500000 }],
  assets: [{ name: 'Rumah', kind: 'properti', value: 900000000 }],
});

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push(`PASS ${name}`);
  } catch (err) {
    results.push(`FAIL ${name}: ${err.message}`);
  }
}

await check('anon cannot call save_baseline', async () => {
  await assert.rejects(as(null, 'select public.save_baseline($1::jsonb)', [payload('X', [])]));
});

let hidA;
await check('first save creates household and owner membership', async () => {
  const r = await as(A, 'select public.save_baseline($1::jsonb) as id', [
    payload('Keluarga A', [{ name: 'Rek. Utama', kind: 'tabungan', balance: 12400000 }, { name: 'Dompet', kind: 'tunai', balance: 500000 }]),
  ]);
  hidA = r.rows[0].id;
  const m = await as(A, 'select role from public.household_members where household_id = $1', [hidA]);
  assert.deepEqual(m.rows, [{ role: 'owner' }]);
  const acc = await as(A, 'select count(*)::int as n from public.accounts');
  assert.equal(acc.rows[0].n, 2);
});

await check('second save replaces rows in the same household', async () => {
  const r = await as(A, 'select public.save_baseline($1::jsonb) as id', [
    payload('Keluarga A baru', [{ name: 'Rek. Bersama', kind: 'tabungan', balance: 7500000 }]),
  ]);
  assert.equal(r.rows[0].id, hidA);
  const acc = await as(A, 'select name from public.accounts');
  assert.deepEqual(acc.rows, [{ name: 'Rek. Bersama' }]);
  const h = await as(A, 'select name from public.households');
  assert.deepEqual(h.rows, [{ name: 'Keluarga A baru' }]);
});

await check('other user sees nothing of household A', async () => {
  for (const t of ['households', 'household_members', 'accounts', 'income_sources', 'monthly_expenses', 'debts', 'assets']) {
    const r = await as(B, `select count(*)::int as n from public.${t}`);
    assert.equal(r.rows[0].n, 0, t);
  }
});

await check('other user cannot insert into household A', async () => {
  await assert.rejects(as(B, `insert into public.accounts (household_id, name, kind, balance) values ($1, 'Curian', 'tunai', 1)`, [hidA]));
});

await check('other user cannot add themselves as member of household A', async () => {
  await assert.rejects(as(B, `insert into public.household_members (household_id, user_id, role) values ($1, $2, 'owner')`, [hidA, B]));
});

await check('user B gets a separate household', async () => {
  const r = await as(B, 'select public.save_baseline($1::jsonb) as id', [payload('Keluarga B', [])]);
  assert.notEqual(r.rows[0].id, hidA);
});

await check('invalid kind is rejected and nothing is half-saved', async () => {
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A rusak', [{ name: 'X', kind: 'bitcoin', balance: 1 }]),
  ]));
  const h = await as(A, 'select name from public.households');
  assert.deepEqual(h.rows, [{ name: 'Keluarga A baru' }]);
  const acc = await as(A, 'select count(*)::int as n from public.accounts');
  assert.equal(acc.rows[0].n, 1);
});

await check('negative balance is rejected', async () => {
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A', [{ name: 'X', kind: 'tunai', balance: -5 }]),
  ]));
});

await check('empty household name is rejected', async () => {
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [payload('   ', [])]));
});

await check('emergency tag and routine flag are stored', async () => {
  await as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A baru', [{ name: 'Tabungan darurat', kind: 'tabungan', balance: 5000000, isEmergency: true }, { name: 'RDPU', kind: 'rdpu', balance: 2000000, isEmergency: true }]),
  ]);
  const acc = await as(A, 'select kind, is_emergency from public.accounts order by kind');
  assert.deepEqual(acc.rows, [{ kind: 'rdpu', is_emergency: true }, { kind: 'tabungan', is_emergency: true }]);
  const exp = await as(A, 'select category, is_routine from public.monthly_expenses order by category');
  assert.deepEqual(exp.rows, [{ category: 'Hiburan', is_routine: false }, { category: 'Rumah tangga & makan', is_routine: true }]);
  const h = await as(A, 'select earning_status, emergency_target_months, emergency_allocation_pct from public.households');
  assert.deepEqual(h.rows, [{ earning_status: 'lajang', emergency_target_months: 3, emergency_allocation_pct: 10 }]);
});

await check('cash cannot be tagged as emergency instrument', async () => {
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A baru', [{ name: 'Dompet', kind: 'tunai', balance: 1, isEmergency: true }]),
  ]));
});

await check('months must match the earning status', async () => {
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A baru', [], { household: { earningStatus: 'lajang', emergencyTargetMonths: 6 } }),
  ]));
  await assert.rejects(as(A, 'select public.save_baseline($1::jsonb)', [
    payload('Keluarga A baru', [], { household: { earningStatus: 'menikah_anak', emergencyTargetMonths: 10 } }),
  ]));
  const r = await as(A, 'select public.save_baseline($1::jsonb) as id', [
    payload('Keluarga A baru', [], { household: { earningStatus: 'menikah_anak', emergencyTargetMonths: 12 } }),
  ]);
  assert.equal(r.rows[0].id, hidA);
});

console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
