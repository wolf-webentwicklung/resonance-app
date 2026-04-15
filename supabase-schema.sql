-- ══════════════════════════════════════════════════
-- RESONANCE — Complete Clean Reset (fixed)
-- ══════════════════════════════════════════════════

drop function if exists dissolve_pair();
drop function if exists join_pair(text);
drop function if exists create_pair();
drop function if exists can_send_trace(uuid);
drop function if exists generate_invite_code();
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists handle_new_user() cascade;
drop table if exists public.artwork_contributions cascade;
drop table if exists public.resonance_events cascade;
drop table if exists public.traces cascade;
drop table if exists public.pairs cascade;
drop table if exists public.users cascade;

create extension if not exists "uuid-ossp";

create table public.users (
  id uuid primary key default uuid_generate_v4(),
  created_at timestamptz default now(),
  pair_id uuid,
  push_token text
);

create table public.pairs (
  id uuid primary key default uuid_generate_v4(),
  user_a_id uuid references public.users(id),
  user_b_id uuid references public.users(id),
  invite_code text unique,
  invite_expires_at timestamptz,
  created_at timestamptz default now(),
  status text default 'pending' check (status in ('pending', 'active', 'dissolved'))
);

alter table public.users add constraint fk_user_pair foreign key (pair_id) references public.pairs(id);

create table public.traces (
  id uuid primary key default uuid_generate_v4(),
  pair_id uuid not null references public.pairs(id),
  sender_id uuid not null references public.users(id),
  receiver_id uuid not null references public.users(id),
  gesture_data jsonb not null,
  emotional_tone text not null check (emotional_tone in ('nearness','longing','tension','warmth','playfulness')),
  signal_type text not null check (signal_type in ('shimmer','pulse','drift','flicker','density','wave')),
  reveal_position jsonb not null,
  search_radius float default 0.08,
  passive_reveal boolean default false,
  created_at timestamptz default now(),
  discovered_at timestamptz,
  day_sequence int default 1
);

create table public.resonance_events (
  id uuid primary key default uuid_generate_v4(),
  pair_id uuid not null references public.pairs(id),
  type text not null check (type in ('twin_connection', 'trace_convergence', 'amplified_reveal')),
  triggered_at timestamptz default now(),
  trigger_traces uuid[],
  tone text,
  seen_by_a boolean default false,
  seen_by_b boolean default false,
  extra_data jsonb
);

create table public.artwork_contributions (
  id uuid primary key default uuid_generate_v4(),
  pair_id uuid not null references public.pairs(id),
  trace_id uuid references public.traces(id),
  sender_id uuid not null references public.users(id),
  path_data jsonb not null,
  tone text not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.users enable row level security;
alter table public.pairs enable row level security;
alter table public.traces enable row level security;
alter table public.resonance_events enable row level security;
alter table public.artwork_contributions enable row level security;

create policy "users_select" on public.users for select using (id = auth.uid());
create policy "users_insert" on public.users for insert with check (id = auth.uid());
create policy "users_update" on public.users for update using (id = auth.uid());

create policy "pairs_select" on public.pairs for select using (
  user_a_id = auth.uid() or user_b_id = auth.uid() or status = 'pending'
);
create policy "pairs_insert" on public.pairs for insert with check (user_a_id = auth.uid());
create policy "pairs_update" on public.pairs for update using (
  user_a_id = auth.uid() or user_b_id = auth.uid()
);

create policy "traces_select" on public.traces for select using (
  traces.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);
create policy "traces_insert" on public.traces for insert with check (
  traces.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);
create policy "traces_update" on public.traces for update using (
  traces.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);

create policy "events_select" on public.resonance_events for select using (
  resonance_events.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);
create policy "events_insert" on public.resonance_events for insert with check (
  resonance_events.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);
create policy "events_update" on public.resonance_events for update using (
  resonance_events.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);

create policy "artwork_select" on public.artwork_contributions for select using (
  artwork_contributions.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);
create policy "artwork_insert" on public.artwork_contributions for insert with check (
  artwork_contributions.pair_id in (select p.id from public.pairs p where p.user_a_id = auth.uid() or p.user_b_id = auth.uid())
);

-- Auto-create user row on auth signup (bypasses RLS)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, created_at)
  values (new.id, now())
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill existing auth users
insert into public.users (id, created_at)
select au.id, au.created_at
from auth.users au
where not exists (select 1 from public.users pu where pu.id = au.id)
on conflict (id) do nothing;

-- Functions (NO aliases in UPDATE SET)

create or replace function generate_invite_code()
returns text as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := upper(substr(md5(random()::text), 1, 6));
    select exists(select 1 from public.pairs p2 where p2.invite_code = v_code) into v_exists;
    exit when not v_exists;
  end loop;
  return v_code;
end;
$$ language plpgsql;

create or replace function can_send_trace(p_user_id uuid)
returns boolean as $$
declare
  v_has_open boolean;
  v_daily_count int;
begin
  select exists(
    select 1 from public.traces t where t.sender_id = p_user_id and t.discovered_at is null
  ) into v_has_open;
  if v_has_open then return false; end if;
  select count(*) from public.traces t
  where t.sender_id = p_user_id and t.created_at > now() - interval '24 hours'
  into v_daily_count;
  return v_daily_count < 5;
end;
$$ language plpgsql security definer;

create or replace function create_pair()
returns jsonb as $$
declare
  v_code text;
  v_pair_id uuid;
begin
  v_code := generate_invite_code();
  insert into public.pairs (user_a_id, invite_code, invite_expires_at, status)
  values (auth.uid(), v_code, now() + interval '24 hours', 'pending')
  returning id into v_pair_id;
  update public.users set pair_id = v_pair_id where id = auth.uid();
  return jsonb_build_object('pair_id', v_pair_id, 'invite_code', v_code);
end;
$$ language plpgsql security definer;

create or replace function join_pair(p_code text)
returns jsonb as $$
declare
  v_pair record;
begin
  select * into v_pair from public.pairs
  where invite_code = upper(p_code)
    and status = 'pending'
    and invite_expires_at > now()
  limit 1;
  if v_pair is null then
    return jsonb_build_object('error', 'Invalid or expired code');
  end if;
  if v_pair.user_a_id = auth.uid() then
    return jsonb_build_object('error', 'Cannot join your own pair');
  end if;
  update public.pairs set user_b_id = auth.uid(), status = 'active' where id = v_pair.id;
  update public.users set pair_id = v_pair.id where id = auth.uid();
  return jsonb_build_object('pair_id', v_pair.id, 'status', 'active');
end;
$$ language plpgsql security definer;

create or replace function dissolve_pair()
returns void as $$
declare
  v_pair_id uuid;
begin
  select pair_id into v_pair_id from public.users where id = auth.uid();
  if v_pair_id is null then return; end if;
  update public.pairs set status = 'dissolved' where id = v_pair_id;
  update public.users set pair_id = null where pair_id = v_pair_id;
end;
$$ language plpgsql security definer;

-- Realtime
do $$
begin
  begin alter publication supabase_realtime add table public.traces; exception when others then null; end;
  begin alter publication supabase_realtime add table public.resonance_events; exception when others then null; end;
  begin alter publication supabase_realtime add table public.pairs; exception when others then null; end;
end $$;
