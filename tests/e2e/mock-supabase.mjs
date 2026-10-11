// A small stand-in for Supabase Auth, PostgREST, Storage and the Claude Messages API, backed by PGlite running the real
// migrations. Only what this app calls is implemented. For local end-to-end tests, never for production.
import { createServer } from 'node:http';
import { createDatabase } from '../db/setup.mjs';

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const db = await createDatabase();

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const pendingCodes = new Map();
const files = new Map();

function sessionFor(user) {
  const now = Math.floor(Date.now() / 1000);
  const access_token = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({
    sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600, session_id: 's1',
  })}.sig`;
  return { access_token, token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: `r-${user.id}`, user: userJson(user) };
}

function userJson(u) {
  return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: new Date().toISOString() };
}

function subFrom(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return p.role === 'authenticated' ? p.sub : null;
  } catch {
    return null;
  }
}

async function asUser(sub, sql, params) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub ?? '']);
    await tx.exec(sub ? 'set local role authenticated' : 'set local role anon');
    return tx.query(sql, params);
  });
}

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw new Error(`bad identifier ${s}`);
  return s;
};

function where(params, values) {
  const out = [];
  for (const [k, v] of params) {
    if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue;
    const col = ident(k);
    const m = /^(eq|neq|gt|gte|lt|lte|ilike|like|in|is)\.(.*)$/s.exec(v);
    if (!m) throw new Error(`bad filter ${k}=${v}`);
    const [, op, raw] = m;
    if (op === 'in') {
      const list = raw.replace(/^\(|\)$/g, '').split(',').map((x) => x.replace(/^"|"$/g, ''));
      values.push(list);
      out.push(`${col}::text = any($${values.length}::text[])`);
    } else if (op === 'is') {
      out.push(`${col} is ${raw === 'null' ? 'null' : raw === 'true' ? 'true' : 'false'}`);
    } else if (op === 'eq' || op === 'neq' || op === 'ilike' || op === 'like') {
      values.push(op === 'ilike' || op === 'like' ? raw.replace(/\*/g, '%') : raw);
      out.push(`${col}::text ${{ eq: '=', neq: '<>', ilike: 'ilike', like: 'like' }[op]} $${values.length}::text`);
    } else {
      values.push(raw);
      out.push(`${col} ${{ gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} $${values.length}`);
    }
  }
  return out.length ? ` where ${out.join(' and ')}` : '';
}

function columns(sel) {
  const cols = (sel ?? '*').split(',').map((c) => c.trim()).filter(Boolean);
  return cols.map((c) => (c === '*' ? '*' : ident(c))).join(', ');
}

function orderBy(params) {
  const o = params.get('order');
  if (!o) return '';
  return ` order by ${o.split(',').map((part) => {
    const [col, dir, nulls] = part.split('.');
    return `${ident(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullslast' ? ' nulls last' : nulls === 'nullsfirst' ? ' nulls first' : ''}`;
  }).join(', ')}`;
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
  res.end(body === undefined ? '' : typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function pgError(err) {
  return { code: err.code ?? 'P0001', message: err.message, details: null, hint: null };
}

function jakartaToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function anthropicReply(body) {
  const tool = body.tools?.[0]?.name;
  const day = (d) => `${jakartaToday().slice(0, 8)}${String(d).padStart(2, '0')}`;
  const today = Number(jakartaToday().slice(8, 10));
  const d = (n) => day(Math.max(1, Math.min(today, n)));
  const input = tool === 'catat_struk'
    ? { merchant: 'Superindo Cibubur', date: jakartaToday(), total: 287500, category: 'Rumah tangga & makan', items: [{ name: 'Beras 5kg', amount: 78000 }, { name: 'Minyak 2L', amount: 39500 }] }
    : {
      bank: 'BSI', period_start: d(1), period_end: d(28),
      rows: [
        { date: d(1), description: 'GAJI OKTOBER', direction: 'masuk', amount: 15000000, balance_after: null, category: 'Gaji' },
        { date: d(2), description: 'QRIS KOPI KENANGAN 0231', direction: 'keluar', amount: 25000, balance_after: null, category: 'Hiburan & makan di luar' },
        { date: d(2), description: 'QRIS KOPI KENANGAN 0231', direction: 'keluar', amount: 25000, balance_after: null, category: 'Hiburan & makan di luar' },
        { date: d(3), description: 'TOKEN PLN 5223', direction: 'keluar', amount: 500000, balance_after: null, category: 'Listrik, air, internet' },
        { date: d(4), description: 'TARIK TUNAI ATM', direction: 'keluar', amount: 1000000, balance_after: null, category: 'Transfer & tarik tunai' },
        { date: d(5), description: 'INDOMARET BELANJA', direction: 'keluar', amount: 3400000, balance_after: null, category: 'Rumah tangga & makan' },
      ],
    };
  return {
    id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, stop_reason: 'tool_use', stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 10 },
    content: [{ type: 'tool_use', id: 'toolu_mock', name: tool, input }],
  };
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  const ctype = req.headers['content-type'] ?? '';
  const json = () => (raw.length && ctype.includes('json') ? JSON.parse(raw.toString()) : {});
  const path = url.pathname;
  const sub = subFrom(req);
  const prefer = req.headers.prefer ?? '';
  process.stdout.write(`${req.method} ${path}${url.search}\n`);

  try {
    if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });

    if (path === '/v1/messages' && req.method === 'POST') return send(res, 200, anthropicReply(json()));

    if (path === '/auth/v1/otp' && req.method === 'POST') {
      const { email } = json();
      let row = (await db.query('select id, email from auth.users where email = $1', [email])).rows[0];
      if (!row) row = (await db.query('insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id, email', [email])).rows[0];
      pendingCodes.set(`code-${email}`, row);
      return send(res, 200, {});
    }
    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const user = pendingCodes.get(json().auth_code);
      return user ? send(res, 200, sessionFor(user)) : send(res, 400, { code: 'bad_code', msg: 'invalid flow state' });
    }
    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(json().refresh_token ?? '').replace(/^r-/, '');
      const user = (await db.query('select id, email from auth.users where id::text = $1', [id])).rows[0];
      return user ? send(res, 200, sessionFor(user)) : send(res, 400, { code: 'refresh_token_not_found' });
    }
    if (path === '/auth/v1/user') {
      const u = sub && (await db.query('select id, email from auth.users where id = $1', [sub])).rows[0];
      return u ? send(res, 200, userJson(u)) : send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' });
    }
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path.startsWith('/auth/v1/.well-known/jwks.json')) return send(res, 200, { keys: [] });

    if (path.startsWith('/storage/v1/object/sign/') && req.method === 'POST') {
      const objectPath = decodeURIComponent(path.slice('/storage/v1/object/sign/receipts/'.length));
      const r = await asUser(sub, `select name from storage.objects where bucket_id = 'receipts' and name = $1`, [objectPath]);
      if (!r.rows.length) return send(res, 400, { statusCode: '404', error: 'not_found', message: 'Object not found' });
      return send(res, 200, { signedURL: `/object/sign/receipts/${objectPath}?token=mock` });
    }
    if (path.startsWith('/storage/v1/object/sign/') && req.method === 'GET') {
      const objectPath = decodeURIComponent(path.slice('/storage/v1/object/sign/receipts/'.length));
      const f = files.get(objectPath);
      return f ? send(res, 200, f.bytes, { 'content-type': f.type }) : send(res, 404, { message: 'not found' });
    }
    if (path === '/storage/v1/object/receipts' && req.method === 'DELETE') {
      const names = json().prefixes ?? [];
      const r = await asUser(sub, `delete from storage.objects where bucket_id = 'receipts' and name = any($1::text[]) returning name`, [names]);
      for (const row of r.rows) files.delete(row.name);
      return send(res, 200, r.rows.map((x) => ({ name: x.name })));
    }
    if (path.startsWith('/storage/v1/object/receipts/') && req.method === 'POST') {
      const objectPath = decodeURIComponent(path.slice('/storage/v1/object/receipts/'.length));
      let bytes = raw;
      let type = ctype;
      if (ctype.startsWith('multipart/form-data')) {
        const form = await new Request('http://x', { method: 'POST', headers: { 'content-type': ctype }, body: raw }).formData();
        const blob = [...form.values()].find((v) => typeof v !== 'string');
        bytes = Buffer.from(await blob.arrayBuffer());
        type = blob.type;
      }
      await asUser(sub, `insert into storage.objects (bucket_id, name, content_type) values ('receipts', $1, $2)`, [objectPath, type]);
      files.set(objectPath, { bytes, type });
      return send(res, 200, { Key: `receipts/${objectPath}`, Id: objectPath });
    }

    if (path.startsWith('/rest/v1/rpc/') && req.method === 'POST') {
      const fn = ident(path.slice('/rest/v1/rpc/'.length));
      const r = await asUser(sub, `select public.${fn}($1::jsonb) as v`, [JSON.stringify(json().payload)]);
      return send(res, 200, JSON.stringify(r.rows[0].v));
    }

    if (path.startsWith('/rest/v1/')) {
      const table = ident(path.slice('/rest/v1/'.length));
      const params = url.searchParams;
      const values = [];
      const returning = prefer.includes('return=representation') ? ` returning ${columns(params.get('select'))}` : '';
      const one = (req.headers.accept ?? '').includes('vnd.pgrst.object');
      let rows;

      if (req.method === 'GET') {
        const limit = params.get('limit') ? ` limit ${Number(params.get('limit'))}` : '';
        rows = (await asUser(sub, `select ${columns(params.get('select'))} from public.${table}${where(params, values)}${orderBy(params)}${limit}`, values)).rows;
      } else if (req.method === 'POST') {
        const body = json();
        const list = Array.isArray(body) ? body : [body];
        if (!list.length) return send(res, 201, []);
        const cols = [...new Set(list.flatMap((o) => Object.keys(o)))].map(ident);
        const tuples = list.map((o) => `(${cols.map((c) => { values.push(o[c] ?? null); return `$${values.length}`; }).join(', ')})`);
        let conflict = '';
        if (params.get('on_conflict')) {
          const keys = params.get('on_conflict').split(',').map(ident);
          conflict = prefer.includes('ignore-duplicates')
            ? ` on conflict (${keys.join(', ')}) do nothing`
            : ` on conflict (${keys.join(', ')}) do update set ${cols.filter((c) => !keys.includes(c)).map((c) => `${c} = excluded.${c}`).join(', ')}`;
        }
        rows = (await asUser(sub, `insert into public.${table} (${cols.join(', ')}) values ${tuples.join(', ')}${conflict}${returning}`, values)).rows;
        if (!returning) return send(res, 201, '');
      } else if (req.method === 'PATCH') {
        const body = json();
        const sets = Object.keys(body).map((c) => { values.push(body[c]); return `${ident(c)} = $${values.length}`; });
        rows = (await asUser(sub, `update public.${table} set ${sets.join(', ')}${where(params, values)}${returning}`, values)).rows;
        if (!returning) return send(res, 204, '');
      } else if (req.method === 'DELETE') {
        rows = (await asUser(sub, `delete from public.${table}${where(params, values)}${returning}`, values)).rows;
        if (!returning) return send(res, 204, '');
      }

      if (one) {
        if (rows.length !== 1) {
          return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
        }
        return send(res, 200, rows[0]);
      }
      return send(res, req.method === 'POST' ? 201 : 200, rows);
    }
    return send(res, 404, { message: `mock: ${req.method} ${path} not implemented` });
  } catch (err) {
    process.stdout.write(`  error: ${err.message}\n`);
    const status = /violates row-level security/.test(err.message) ? 403 : /duplicate key/.test(err.message) ? 409 : 400;
    return send(res, status, pgError(err));
  }
});

server.listen(PORT, '127.0.0.1', () => process.stdout.write(`mock supabase on ${PORT}\n`));
