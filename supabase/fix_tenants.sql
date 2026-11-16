-- Multi-tenant memberships: each paying member gets their own workspace/tenant
-- Run in Supabase SQL Editor

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'enterprise')),
  created_at timestamptz not null default now()
);

create table if not exists public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

alter table public.profiles
  add column if not exists tenant_id uuid references public.tenants(id) on delete set null;

alter table public.events
  add column if not exists tenant_id uuid references public.tenants(id) on delete cascade;

create index if not exists tenants_owner_idx on public.tenants(owner_user_id);
create index if not exists tenants_slug_idx on public.tenants(slug);
create index if not exists events_tenant_idx on public.events(tenant_id);
create index if not exists profiles_tenant_idx on public.profiles(tenant_id);

create or replace function public.make_tenant_slug(p_name text)
returns text
language plpgsql
as $$
declare
  base text;
  candidate text;
  n int := 0;
begin
  base := lower(regexp_replace(coalesce(nullif(trim(p_name), ''), 'workspace'), '[^a-z0-9]+', '-', 'g'));
  base := trim(both '-' from base);
  if length(base) < 2 then base := 'workspace'; end if;
  candidate := left(base, 40);
  while exists(select 1 from public.tenants t where t.slug = candidate) loop
    n := n + 1;
    candidate := left(base, 36) || '-' || n::text;
  end loop;
  return candidate;
end;
$$;

create or replace function public.ensure_tenant_for_user(p_user_id uuid)
returns public.tenants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_tenant public.tenants;
begin
  select * into v_profile from public.profiles where id = p_user_id;
  if v_profile.id is null then
    raise exception 'Profile missing';
  end if;

  if v_profile.tenant_id is not null then
    select * into v_tenant from public.tenants where id = v_profile.tenant_id;
    if v_tenant.id is not null then
      return v_tenant;
    end if;
  end if;

  select t.* into v_tenant
  from public.tenants t
  where t.owner_user_id = p_user_id
  order by t.created_at
  limit 1;

  if v_tenant.id is null then
    insert into public.tenants (name, slug, owner_user_id, plan)
    values (
      coalesce(nullif(trim(v_profile.name), ''), 'My workspace') || '''s workspace',
      public.make_tenant_slug(v_profile.name),
      p_user_id,
      'free'
    )
    returning * into v_tenant;

    insert into public.tenant_members (tenant_id, user_id, role)
    values (v_tenant.id, p_user_id, 'owner')
    on conflict do nothing;
  end if;

  update public.profiles
  set tenant_id = v_tenant.id
  where id = p_user_id and (tenant_id is distinct from v_tenant.id);

  return v_tenant;
end;
$$;

-- Backfill: one tenant per existing host/profile
do $$
declare
  r record;
begin
  for r in select id from public.profiles loop
    perform public.ensure_tenant_for_user(r.id);
  end loop;

  update public.events e
  set tenant_id = p.tenant_id
  from public.profiles p
  where e.host_id = p.id
    and e.tenant_id is null
    and p.tenant_id is not null;
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  v_name := coalesce(
    new.raw_user_meta_data->>'name',
    split_part(coalesce(new.email, 'Member'), '@', 1)
  );

  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@guest.local'),
    v_name
  )
  on conflict (id) do update
    set email = excluded.email,
        name = coalesce(nullif(public.profiles.name, ''), excluded.name);

  -- Guests (anonymous) do not get a membership workspace/tenant
  if new.email is not null
     and new.email not like '%@guest.local'
     and coalesce(new.raw_app_meta_data->>'provider', '') is distinct from 'anonymous' then
    perform public.ensure_tenant_for_user(new.id);
  end if;

  return new;
end;
$$;

create or replace function public.create_event(
  p_name text,
  p_description text,
  p_password text default null,
  p_chat_mode public.chat_mode default 'open',
  p_starts_at timestamptz default now(),
  p_ends_at timestamptz default now() + interval '3 days'
)
returns public.events
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events;
  v_participant public.participants;
  v_conversation public.conversations;
  v_profile public.profiles;
  v_tenant public.tenants;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Profile missing';
  end if;

  v_tenant := public.ensure_tenant_for_user(auth.uid());

  loop
    v_code := public.make_event_code();
    exit when not exists(select 1 from public.events where code = v_code);
  end loop;

  insert into public.events (
    code, name, description, host_id, tenant_id, password_hash, chat_mode, starts_at, ends_at
  ) values (
    v_code,
    trim(p_name),
    coalesce(p_description, ''),
    auth.uid(),
    v_tenant.id,
    case when p_password is null or length(trim(p_password)) = 0 then null
         else crypt(p_password, gen_salt('bf')) end,
    p_chat_mode,
    p_starts_at,
    p_ends_at
  ) returning * into v_event;

  insert into public.participants (
    event_id, display_name, password_hash, chat_id, role, avatar_uri
  ) values (
    v_event.id,
    v_profile.name,
    null,
    public.make_chat_id(),
    'admin',
    v_profile.avatar_uri
  ) returning * into v_participant;

  insert into public.conversations (event_id, is_group)
  values (v_event.id, true)
  returning * into v_conversation;

  insert into public.conversation_members (conversation_id, participant_id)
  values (v_conversation.id, v_participant.id);

  return v_event;
end;
$$;

create or replace function public.is_tenant_member(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.tenant_members tm
    where tm.tenant_id = p_tenant_id and tm.user_id = auth.uid()
  );
$$;

alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;

drop policy if exists tenants_select on public.tenants;
create policy tenants_select on public.tenants for select using (
  owner_user_id = auth.uid() or public.is_tenant_member(id)
);

drop policy if exists tenant_members_select on public.tenant_members;
create policy tenant_members_select on public.tenant_members for select using (
  user_id = auth.uid() or public.is_tenant_member(tenant_id)
);

-- Hosts only see/manage events in their tenant (guests still via membership helpers)
drop policy if exists events_select on public.events;
create policy events_select on public.events for select using (
  host_id = auth.uid()
  or public.is_tenant_member(tenant_id)
  or public.is_event_member(id)
);

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert with check (
  host_id = auth.uid()
  and (tenant_id is null or public.is_tenant_member(tenant_id))
);

grant select, insert, update on public.tenants to anon, authenticated;
grant select, insert, update on public.tenant_members to anon, authenticated;
grant execute on function public.ensure_tenant_for_user(uuid) to authenticated;
grant execute on function public.is_tenant_member(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
