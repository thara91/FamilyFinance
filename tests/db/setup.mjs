// Minimal stand-ins for the Supabase-managed schemas (auth, storage) so the real migrations run in PGlite.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';

export async function createDatabase() {
  // Dates come back as 'YYYY-MM-DD' text, the way PostgREST returns them.
  const db = new PGlite({ parsers: { 1082: (value) => value } });
  await db.exec(`
    create schema auth;
    create table auth.users (id uuid primary key, email text unique);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create role anon nologin;
    create role authenticated nologin;

    create schema storage;
    create table storage.buckets (
      id text primary key, name text not null, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]
    );
    create table storage.objects (
      id uuid primary key default gen_random_uuid(),
      bucket_id text references storage.buckets (id),
      name text not null,
      content bytea,
      content_type text,
      unique (bucket_id, name)
    );
    alter table storage.objects enable row level security;
  `);

  const dir = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of readdirSync(dir).sort()) {
    await db.exec(readFileSync(new URL(file, dir), 'utf8'));
  }

  await db.exec(`
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on all tables in schema public to authenticated;
    grant select, insert, delete on storage.objects to authenticated;
    grant select on storage.buckets to authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `);
  return db;
}
