-- Pipeline CRM usage sync (Supabase free tier). Run in Supabase SQL editor.
create table if not exists devices (id text primary key, label text, created_at timestamptz default now(), last_seen timestamptz);
create table if not exists events (id bigint generated always as identity primary key, device_id text references devices(id),
  at timestamptz not null, kind text not null, -- search|enrich|import|move|call|text|lookup|feedback|error|session
  lead_id text, from_stage text, to_stage text, units int default 1, cost numeric default 0, meta jsonb default '{}');
create table if not exists leads (device_id text references devices(id), id text, company text, stage text, value numeric,
  source text, city text, created date, updated_at timestamptz default now(), primary key(device_id,id));
create index if not exists events_dev_at on events(device_id,at desc);
-- RLS: anon key may only INSERT/UPSERT (Abraham's app); reads only via service role / Danny's login.
alter table devices enable row level security; alter table events enable row level security; alter table leads enable row level security;
create policy dev_ins on devices for insert to anon with check (true);
create policy dev_upd on devices for update to anon using (true) with check (true);
create policy ev_ins on events for insert to anon with check (true);
create policy ld_ins on leads for insert to anon with check (true);
create policy ld_upd on leads for update to anon using (true) with check (true);
-- Danny reads: sign in as an authenticated user (Supabase Auth, email magic link) and allow select.
create policy dev_sel on devices for select to authenticated using (auth.jwt()->>'email' = 'dannyc1198@gmail.com');
create policy ev_sel on events for select to authenticated using (auth.jwt()->>'email' = 'dannyc1198@gmail.com');
create policy ld_sel on leads for select to authenticated using (auth.jwt()->>'email' = 'dannyc1198@gmail.com');
create or replace view daily_metrics as select device_id, date_trunc('day',at)::date d, kind, count(*) n, sum(cost) cost from events group by 1,2,3;
