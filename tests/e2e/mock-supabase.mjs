// A small stand-in for Supabase Auth + PostgREST, backed by PGlite running the real migrations.
// Only the endpoints this app calls are implemented. For local end-to-end tests, never for production.
import { createServer } from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

const PORT = Number(process.env.MOCK_PORT ?? 54321);
const db = new PGlite();
await db.exec(`
  create schema auth;
  create table auth.users (id uuid primary key, email text unique);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
`);
const dir = new URL('../../supabase/migrations/', import.meta.url);
for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(new URL(f, dir), 'utf8'));
await db.exec(`
  grant usage on schema public, auth to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`);

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const pendingCodes = new Map();

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
    return p.role === 'authenticated' ? p : null;
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

function buildSelect(table, params) {
  if (!IDENT.test(table)) throw new Error('bad table');
  const cols = (params.get('select') ?? '*').split(',').map((c) => c.trim());
  if (!cols.every((c) => c === '*' || IDENT.test(c))) throw new Error('bad select');
  const where = [];
  const values = [];
  let order = '';
  let limit = '';
  for (const [k, v] of params) {
    if (k === 'select') continue;
    if (k === 'order') {
      const [col, dir] = v.split('.');
      if (!IDENT.test(col)) throw new Error('bad order');
      order = ` order by ${col} ${dir === 'desc' ? 'desc' : 'asc'}`;
    } else if (k === 'limit') {
      limit = ` limit ${Number(v)}`;
    } else if (IDENT.test(k) && v.startsWith('eq.')) {
      values.push(v.slice(3));
      where.push(`${k}::text = $${values.length}`);
    }
  }
  const sql = `select ${cols.join(', ')} from public.${table}${where.length ? ` where ${where.join(' and ')}` : ''}${order}${limit}`;
  return { sql, values };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let raw = '';
  for await (const chunk of req) raw += chunk;
  const body = raw ? JSON.parse(raw) : {};
  const path = url.pathname;
  process.stdout.write(`${req.method} ${path}${url.search}\n`);

  try {
    if (req.method === 'OPTIONS') return send(res, 204, undefined, { 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' });

    if (path === '/auth/v1/otp' && req.method === 'POST') {
      const email = body.email;
      let row = (await db.query('select id, email from auth.users where email = $1', [email])).rows[0];
      if (!row) row = (await db.query('insert into auth.users (id, email) values (gen_random_uuid(), $1) returning id, email', [email])).rows[0];
      pendingCodes.set(`code-${email}`, row);
      return send(res, 200, {});
    }
    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      const user = pendingCodes.get(body.auth_code);
      if (!user) return send(res, 400, { code: 'bad_code', msg: 'invalid flow state' });
      return send(res, 200, sessionFor(user));
    }
    if (path === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token') {
      const id = String(body.refresh_token ?? '').replace(/^r-/, '');
      const user = (await db.query('select id, email from auth.users where id::text = $1', [id])).rows[0];
      return user ? send(res, 200, sessionFor(user)) : send(res, 400, { code: 'refresh_token_not_found' });
    }
    if (path === '/auth/v1/user') {
      const claims = subFrom(req);
      return claims ? send(res, 200, userJson({ id: claims.sub, email: claims.email })) : send(res, 401, { code: 'bad_jwt', msg: 'invalid JWT' });
    }
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path.startsWith('/auth/v1/.well-known/jwks.json')) return send(res, 200, { keys: [] });

    if (path === '/rest/v1/rpc/save_baseline' && req.method === 'POST') {
      const claims = subFrom(req);
      const r = await asUser(claims?.sub, 'select public.save_baseline($1::jsonb) as id', [JSON.stringify(body.payload)]);
      return send(res, 200, r.rows[0].id);
    }
    if (path.startsWith('/rest/v1/') && req.method === 'GET') {
      const claims = subFrom(req);
      const { sql, values } = buildSelect(path.slice('/rest/v1/'.length), url.searchParams);
      const rows = (await asUser(claims?.sub, sql, values)).rows;
      const accept = req.headers.accept ?? '';
      if (accept.includes('vnd.pgrst.object')) {
        if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' });
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows);
    }
    return send(res, 404, { message: `mock: ${req.method} ${path} not implemented` });
  } catch (err) {
    return send(res, 400, { code: 'P0001', message: err.message, details: null, hint: null });
  }
});

server.listen(PORT, '127.0.0.1', () => process.stdout.write(`mock supabase on ${PORT}\n`));
