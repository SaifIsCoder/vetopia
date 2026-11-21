#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."

# Disposable PostgreSQL with the Supabase database roles and schema contracts needed by the migrations.
db=$(docker run --rm -d --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17 -c wal_level=logical)
trap 'docker stop "$db" >/dev/null' EXIT
for attempt in {1..60}; do
  if docker exec "$db" pg_isready -U postgres -h 127.0.0.1 >/dev/null 2>&1; then break; fi
  sleep 1
done

sql() {
  docker exec -i "$db" psql -X -q -U postgres -v ON_ERROR_STOP=1 "$@"
}
sql <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
create schema storage;
create table storage.objects (id uuid, bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$
  select regexp_split_to_array($1, '/')
$$;
create publication supabase_realtime;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
SQL

for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  sql --single-transaction < "$migration"
done
sql < tests/database/phase1.sql

# Start two real sessions booking distinct, overlapping published slots. The first
# holds its transaction to ensure the second must wait for the exclusion constraint.
results=$(mktemp -d)
trap 'docker stop "$db" >/dev/null; rm -r "$results"' EXIT
book() {
  sql -v minute="$1" -v hold="$2" <<'SQL'
\set VERBOSITY verbose
begin;
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
select public.book_appointment(
  '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
  ((current_date + 3 + time '10:00') at time zone 'UTC') + make_interval(mins => :minute),
  'video', 'Concurrency fixture'
);
select pg_sleep(:hold);
commit;
SQL
}

book 0 2 > "$results/first" 2>&1 & first=$!
book 15 2 > "$results/second" 2>&1 & second=$!
first_status=0
second_status=0
wait "$first" || first_status=$?
wait "$second" || second_status=$?
if [[ $first_status == 0 && $second_status != 0 ]]; then
  conflict="$results/second"
elif [[ $second_status == 0 && $first_status != 0 ]]; then
  conflict="$results/first"
else
  cat "$results/first" "$results/second"
  exit 1
fi
grep -q '23505: Slot just taken' "$conflict"
count=$(sql -Atc "select count(*) from public.appointments where symptoms = 'Concurrency fixture'")
[[ $count == 1 ]]
echo "Phase 1 database and simultaneous overlapping booking tests passed."
