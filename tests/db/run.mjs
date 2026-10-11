// Runs the real migrations in PGlite (auth and storage stubbed in setup.mjs) and checks the access rules
// for baseline, transactions, budgets and receipt files as owners of different households and as a viewer.
import { createDatabase } from './setup.mjs';
import assert from 'node:assert/strict';

const db = await createDatabase();

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

const C = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users (id) values ('${C}')`);

let accA;
await check('save keeps account ids so transactions stay attached', async () => {
  await as(A, 'select public.save_baseline($1::jsonb)', [payload('Keluarga A', [{ name: 'Rek. Utama', kind: 'tabungan', balance: 10000000, isEmergency: true }])]);
  accA = (await as(A, 'select id from public.accounts')).rows[0].id;
  await as(A, `insert into public.transactions (household_id, account_id, occurred_on, direction, amount, category, description)
    values ($1, $2, current_date + 1, 'keluar', 250000, 'Rumah tangga & makan', 'Belanja pasar')`, [hidA, accA]);
  await as(A, 'select public.save_baseline($1::jsonb)', [payload('Keluarga A', [{ id: accA, name: 'Rek. Utama BSI', kind: 'tabungan', balance: 10000000, isEmergency: true }])]);
  const acc = await as(A, 'select id, name from public.accounts');
  assert.deepEqual(acc.rows, [{ id: accA, name: 'Rek. Utama BSI' }]);
  const t = await as(A, 'select account_id from public.transactions');
  assert.equal(t.rows[0].account_id, accA);
});

await check('running balance adds transactions recorded after the balance, including the same day', async () => {
  await as(A, `insert into public.transactions (household_id, account_id, occurred_on, direction, amount, category, description)
    values ($1, $2, current_date - 30, 'keluar', 999, 'Lainnya', 'Sebelum saldo awal'),
           ($1, $2, (now() at time zone 'Asia/Jakarta')::date, 'keluar', 50000, 'Lainnya', 'Hari yang sama, sesudah saldo'),
           ($1, $2, current_date + 1, 'masuk', 1000000, 'Gaji', 'Gaji')`, [hidA, accA]);
  const b = await as(A, 'select opening_balance::bigint as o, current_balance::bigint as c from public.account_balances');
  assert.deepEqual(b.rows, [{ o: 10000000, c: 10700000 }]);
});

await check('changing a balance re-stamps it and leaves unchanged ones alone', async () => {
  await as(A, `update public.accounts set balance_set_at = now() - interval '10 days'`);
  await as(A, 'select public.save_baseline($1::jsonb)', [payload('Keluarga A', [{ id: accA, name: 'Rek. Utama BSI', kind: 'tabungan', balance: 10000000, isEmergency: true }])]);
  let r = await as(A, `select balance_set_at < now() - interval '1 day' as old from public.accounts`);
  assert.equal(r.rows[0].old, true);
  await as(A, 'select public.save_baseline($1::jsonb)', [payload('Keluarga A', [{ id: accA, name: 'Rek. Utama BSI', kind: 'tabungan', balance: 12000000, isEmergency: true }])]);
  r = await as(A, `select balance_set_at > now() - interval '1 minute' as today from public.accounts`);
  assert.equal(r.rows[0].today, true);
});

await check('removing an account keeps its transactions without an account', async () => {
  await as(A, 'select public.save_baseline($1::jsonb)', [payload('Keluarga A', [{ name: 'Dompet', kind: 'tunai', balance: 100000 }])]);
  const t = await as(A, 'select count(*)::int as n, count(account_id)::int as linked from public.transactions');
  assert.deepEqual(t.rows, [{ n: 4, linked: 0 }]);
  accA = (await as(A, 'select id from public.accounts')).rows[0].id;
});

let hidB, accB;
await check('a transaction cannot point at another household account', async () => {
  hidB = (await as(B, 'select id from public.households')).rows[0].id;
  await as(B, 'select public.save_baseline($1::jsonb)', [payload('Keluarga B', [{ name: 'Rek B', kind: 'tabungan', balance: 1 }])]);
  accB = (await as(B, 'select id from public.accounts')).rows[0].id;
  await assert.rejects(as(A, `insert into public.transactions (household_id, account_id, occurred_on, direction, amount, category, description)
    values ($1, $2, current_date, 'keluar', 1, 'Lainnya', 'X')`, [hidA, accB]));
});

await check('other household cannot read, insert, or change transactions of A', async () => {
  assert.equal((await as(B, 'select count(*)::int as n from public.transactions')).rows[0].n, 0);
  await assert.rejects(as(B, `insert into public.transactions (household_id, occurred_on, direction, amount, category, description)
    values ($1, current_date, 'keluar', 1, 'Lainnya', 'X')`, [hidA]));
  const u = await as(B, `update public.transactions set amount = 1 where household_id = $1 returning id`, [hidA]);
  assert.equal(u.rows.length, 0);
});

await check('transaction checks: positive amount, known direction, receipt inside own folder', async () => {
  await assert.rejects(as(A, `insert into public.transactions (household_id, occurred_on, direction, amount, category, description) values ($1, current_date, 'keluar', 0, 'Lainnya', 'X')`, [hidA]));
  await assert.rejects(as(A, `insert into public.transactions (household_id, occurred_on, direction, amount, category, description) values ($1, current_date, 'pinjam', 5, 'Lainnya', 'X')`, [hidA]));
  await assert.rejects(as(A, `insert into public.transactions (household_id, occurred_on, direction, amount, category, description, receipt_path) values ($1, current_date, 'keluar', 5, 'Lainnya', 'X', $2)`, [hidA, `${hidB}/x.jpg`]));
});

await check('the same statement row cannot be imported twice', async () => {
  const q = `insert into public.transactions (household_id, occurred_on, direction, amount, category, description, source, import_ref) values ($1, current_date, 'keluar', 5, 'Lainnya', 'X', 'mutasi', 'ref-1')`;
  await as(A, q, [hidA]);
  await assert.rejects(as(A, q, [hidA]));
});

await check('budgets: one limit per category, readable only by the household', async () => {
  await as(A, `insert into public.budgets (household_id, category, monthly_limit) values ($1, 'Rumah tangga & makan', 6000000)`, [hidA]);
  await assert.rejects(as(A, `insert into public.budgets (household_id, category, monthly_limit) values ($1, 'Rumah tangga & makan', 1)`, [hidA]));
  await assert.rejects(as(A, `insert into public.budgets (household_id, category, monthly_limit) values ($1, 'Transportasi', 0)`, [hidA]));
  assert.equal((await as(B, 'select count(*)::int as n from public.budgets')).rows[0].n, 0);
});

await check('receipts: members upload and read only inside their household folder', async () => {
  await as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${hidA}/a.jpg`]);
  await assert.rejects(as(A, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${hidB}/a.jpg`]));
  await assert.rejects(as(A, `insert into storage.objects (bucket_id, name) values ('receipts', 'bukan-uuid/a.jpg')`));
  assert.equal((await as(B, `select count(*)::int as n from storage.objects`)).rows[0].n, 0);
  assert.equal((await as(A, `select count(*)::int as n from storage.objects`)).rows[0].n, 1);
});

await check('a viewer can read but not write', async () => {
  await db.exec(`insert into public.household_members (household_id, user_id, role) values ('${hidA}', '${C}', 'viewer')`);
  assert.ok((await as(C, 'select count(*)::int as n from public.transactions')).rows[0].n > 0);
  await assert.rejects(as(C, `insert into public.transactions (household_id, occurred_on, direction, amount, category, description) values ($1, current_date, 'keluar', 1, 'Lainnya', 'X')`, [hidA]));
  await assert.rejects(as(C, `insert into public.budgets (household_id, category, monthly_limit) values ($1, 'Lainnya', 1)`, [hidA]));
  await assert.rejects(as(C, `insert into storage.objects (bucket_id, name) values ('receipts', $1)`, [`${hidA}/c.jpg`]));
});

console.log(results.join('\n'));
if (results.some((r) => r.startsWith('FAIL'))) process.exit(1);
