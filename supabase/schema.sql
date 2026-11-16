-- EasyEvents shared database (testing + production)
-- Run this in Supabase SQL Editor, then enable Anonymous Sign-Ins:
-- Authentication → Providers → Anonymous → Enable

create extension if not exists "pgcrypto" with schema extensions;

create type public.chat_mode as enum ('open', 'private', 'off');
create type public.participant_role as enum ('host', 'organizer', 'member');

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  avatar_uri text,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text not null default '',
  host_id uuid not null references public.profiles(id) on delete cascade,
  password_hash text,
  chat_mode public.chat_mode not null default 'open',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  display_name text not null,
  password_hash text,
  chat_id text not null,
  role public.participant_role not null default 'member',
  avatar_uri text,
  created_at timestamptz not null default now()
);

create table if not exists public.guest_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  description text not null default '',
  location text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity int,
  created_at timestamptz not null default now()
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (activity_id, participant_id)
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text not null,
  created_by_host_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  is_group boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  primary key (conversation_id, participant_id)
);

create table if not exists public.chat_invites (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  from_participant_id uuid not null references public.participants(id) on delete cascade,
  to_participant_id uuid not null references public.participants(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_participant_id uuid not null references public.participants(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_code_idx on public.events(code);
create index if not exists participants_event_idx on public.participants(event_id);
create index if not exists activities_event_idx on public.activities(event_id);
create index if not exists bookings_activity_idx on public.bookings(activity_id);
create index if not exists messages_conversation_idx on public.messages(conversation_id);
create index if not exists guest_links_event_idx on public.guest_links(event_id);

-- Helpers
create or replace function public.current_guest_participant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select participant_id from public.guest_links where user_id = auth.uid();
$$;

create or replace function public.current_guest_event_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select event_id from public.guest_links where user_id = auth.uid();
$$;

create or replace function public.is_event_host(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.events e
    where e.id = p_event_id and e.host_id = auth.uid()
  );
$$;

create or replace function public.can_manage_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_event_host(p_event_id)
    or exists(
      select 1
      from public.guest_links gl
      join public.participants p on p.id = gl.participant_id
      where gl.user_id = auth.uid()
        and gl.event_id = p_event_id
        and p.role in ('host', 'organizer')
    );
$$;

create or replace function public.is_event_member(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_event_host(p_event_id)
    or exists(
      select 1 from public.guest_links gl
      where gl.user_id = auth.uid() and gl.event_id = p_event_id
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@guest.local'),
    coalesce(new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'Guest'), '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.make_event_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.make_chat_id()
returns text
language sql
as $$
  select lpad((100000 + floor(random() * 900000))::int::text, 6, '0');
$$;

-- Auth profile bootstrap for email signup metadata
create or replace function public.update_own_profile(p_name text, p_avatar_uri text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  update public.profiles
  set
    name = coalesce(nullif(trim(p_name), ''), name),
    avatar_uri = p_avatar_uri
  where id = auth.uid()
  returning * into row;
  return row;
end;
$$;

-- Create event (member/host)
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
set search_path = public
as $$
declare
  v_event public.events;
  v_participant public.participants;
  v_conversation public.conversations;
  v_profile public.profiles;
  v_code text;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'Profile missing';
  end if;

  loop
    v_code := public.make_event_code();
    exit when not exists(select 1 from public.events where code = v_code);
  end loop;

  insert into public.events (
    code, name, description, host_id, password_hash, chat_mode, starts_at, ends_at
  ) values (
    v_code,
    trim(p_name),
    coalesce(p_description, ''),
    auth.uid(),
    case when p_password is null or length(trim(p_password)) = 0 then null
         else extensions.crypt(p_password, extensions.gen_salt('bf')) end,
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
    'host',
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

create or replace function public.add_participant(
  p_event_id uuid,
  p_display_name text,
  p_password text default null,
  p_role public.participant_role default 'member'
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants;
  v_role public.participant_role;
  v_group uuid;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed';
  end if;

  v_role := case when p_role = 'host' then 'organizer'::public.participant_role else p_role end;

  insert into public.participants (
    event_id, display_name, password_hash, chat_id, role
  ) values (
    p_event_id,
    trim(p_display_name),
    case when p_password is null or length(trim(p_password)) = 0 then null
         else extensions.crypt(p_password, extensions.gen_salt('bf')) end,
    public.make_chat_id(),
    v_role
  ) returning * into v_participant;

  select id into v_group
  from public.conversations
  where event_id = p_event_id and is_group = true
  limit 1;

  if v_group is not null then
    insert into public.conversation_members (conversation_id, participant_id)
    values (v_group, v_participant.id)
    on conflict do nothing;
  end if;

  return v_participant;
end;
$$;

create or replace function public.update_participant_role(
  p_participant_id uuid,
  p_role public.participant_role
)
returns public.participants
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants;
begin
  select * into v_participant from public.participants where id = p_participant_id;
  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;
  if not public.is_event_host(v_participant.event_id) then
    raise exception 'Only the host can change roles';
  end if;
  if v_participant.role = 'host' then
    raise exception 'The main host role cannot be changed';
  end if;

  update public.participants
  set role = case when p_role = 'host' then 'organizer'::public.participant_role else p_role end
  where id = p_participant_id
  returning * into v_participant;

  return v_participant;
end;
$$;

create or replace function public.remove_participant(p_participant_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant public.participants;
begin
  select * into v_participant
  from public.participants
  where id = p_participant_id;

  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;

  if not public.can_manage_event(v_participant.event_id) then
    raise exception 'Not allowed';
  end if;

  if v_participant.role = 'host' then
    raise exception 'You cannot remove the host';
  end if;

  delete from public.guest_links where participant_id = p_participant_id;
  delete from public.bookings where participant_id = p_participant_id;
  delete from public.chat_invites
  where from_participant_id = p_participant_id
     or to_participant_id = p_participant_id;
  delete from public.messages where sender_participant_id = p_participant_id;
  delete from public.conversation_members where participant_id = p_participant_id;

  delete from public.conversations c
  where c.is_group = false
    and c.event_id = v_participant.event_id
    and not exists (
      select 1 from public.conversation_members m where m.conversation_id = c.id
    );

  delete from public.participants where id = p_participant_id;
  return true;
end;
$$;

-- Guest lookup (no secrets leaked)
create or replace function public.find_event_by_code(p_code text)
returns table (
  id uuid,
  code text,
  name text,
  description text,
  requires_password boolean,
  chat_mode public.chat_mode,
  starts_at timestamptz,
  ends_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    e.id,
    e.code,
    e.name,
    e.description,
    e.password_hash is not null as requires_password,
    e.chat_mode,
    e.starts_at,
    e.ends_at
  from public.events e
  where upper(e.code) = upper(trim(p_code))
  limit 1;
$$;

create or replace function public.list_event_participants(
  p_code text,
  p_event_password text default null
)
returns table (
  id uuid,
  display_name text,
  requires_password boolean,
  role public.participant_role,
  chat_id text,
  avatar_uri text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where upper(code) = upper(trim(p_code));
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.password_hash is not null
     and not (v_event.password_hash = extensions.crypt(coalesce(p_event_password, ''), v_event.password_hash)) then
    raise exception 'Incorrect event password';
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.password_hash is not null as requires_password,
    p.role,
    p.chat_id,
    p.avatar_uri
  from public.participants p
  where p.event_id = v_event.id
  order by p.display_name;
end;
$$;

create or replace function public.guest_join(
  p_code text,
  p_event_password text default null,
  p_participant_id uuid default null,
  p_participant_password text default null
)
returns table (
  event_id uuid,
  participant_id uuid,
  host_account_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_participant public.participants;
begin
  if auth.uid() is null then
    raise exception 'Auth session required';
  end if;

  select * into v_event from public.events where upper(code) = upper(trim(p_code));
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.password_hash is not null
     and not (v_event.password_hash = extensions.crypt(coalesce(p_event_password, ''), v_event.password_hash)) then
    raise exception 'Incorrect event password';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id and event_id = v_event.id;

  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;
  if v_participant.password_hash is not null
     and not (v_participant.password_hash = extensions.crypt(coalesce(p_participant_password, ''), v_participant.password_hash)) then
    raise exception 'Incorrect user password';
  end if;

  insert into public.guest_links (user_id, participant_id, event_id)
  values (auth.uid(), v_participant.id, v_event.id)
  on conflict (user_id) do update
    set participant_id = excluded.participant_id,
        event_id = excluded.event_id;

  return query
  select
    v_event.id,
    v_participant.id,
    case when v_participant.role = 'host' then v_event.host_id else null end;
end;
$$;

create or replace function public.host_enter_event(p_event_id uuid)
returns table (
  event_id uuid,
  participant_id uuid,
  host_account_id uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_event public.events;
  v_participant public.participants;
  v_profile public.profiles;
  v_out_event_id uuid;
  v_out_participant_id uuid;
  v_out_host_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_event
  from public.events e
  where e.id = p_event_id and e.host_id = auth.uid();
  if v_event.id is null then
    raise exception 'Event not found';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();

  select * into v_participant
  from public.participants p
  where p.event_id = p_event_id and p.role = 'host'
  limit 1;

  if v_participant.id is null then
    insert into public.participants (
      event_id, display_name, chat_id, role, avatar_uri
    ) values (
      p_event_id, v_profile.name, public.make_chat_id(), 'host', v_profile.avatar_uri
    ) returning * into v_participant;
  end if;

  insert into public.guest_links (user_id, participant_id, event_id)
  values (auth.uid(), v_participant.id, v_event.id)
  on conflict (user_id) do update
    set participant_id = excluded.participant_id,
        event_id = excluded.event_id;

  v_out_event_id := v_event.id;
  v_out_participant_id := v_participant.id;
  v_out_host_id := v_event.host_id;

  return query
  select v_out_event_id, v_out_participant_id, v_out_host_id;
end;
$$;

-- Activity / booking / news / chat helpers
create or replace function public.add_activity(
  p_event_id uuid,
  p_title text,
  p_description text,
  p_location text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_capacity int default null
)
returns public.activities
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.activities;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  insert into public.activities (
    event_id, title, description, location, starts_at, ends_at, capacity
  ) values (
    p_event_id, trim(p_title), coalesce(p_description, ''), coalesce(p_location, 'TBA'),
    p_starts_at, p_ends_at, p_capacity
  ) returning * into row;
  return row;
end;
$$;

create or replace function public.toggle_booking(p_activity_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_activity public.activities;
  v_participant_id uuid := public.current_guest_participant_id();
  v_existing uuid;
  v_count int;
begin
  if v_participant_id is null then
    raise exception 'Join an event first';
  end if;

  select * into v_activity from public.activities where id = p_activity_id;
  if v_activity.id is null then
    raise exception 'Activity not found';
  end if;
  if not public.is_event_member(v_activity.event_id) then
    raise exception 'Not allowed';
  end if;

  select id into v_existing
  from public.bookings
  where activity_id = p_activity_id and participant_id = v_participant_id;

  if v_existing is not null then
    delete from public.bookings where id = v_existing;
    return false;
  end if;

  select count(*) into v_count from public.bookings where activity_id = p_activity_id;
  if v_activity.capacity is not null and v_count >= v_activity.capacity then
    raise exception 'This activity is full';
  end if;

  insert into public.bookings (activity_id, participant_id)
  values (p_activity_id, v_participant_id);
  return true;
end;
$$;

create or replace function public.add_announcement(
  p_event_id uuid,
  p_title text,
  p_body text
)
returns public.announcements
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.announcements;
  v_host uuid;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  select host_id into v_host from public.events where id = p_event_id;
  insert into public.announcements (event_id, title, body, created_by_host_id)
  values (p_event_id, trim(p_title), trim(p_body), coalesce(auth.uid(), v_host))
  returning * into row;
  return row;
end;
$$;

create or replace function public.set_chat_mode(
  p_event_id uuid,
  p_chat_mode public.chat_mode
)
returns public.events
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.events;
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  update public.events set chat_mode = p_chat_mode where id = p_event_id returning * into row;
  return row;
end;
$$;

create or replace function public.ensure_group_conversation(p_event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_event_member(p_event_id) then
    raise exception 'Not allowed';
  end if;
  select id into v_id from public.conversations where event_id = p_event_id and is_group limit 1;
  if v_id is null then
    insert into public.conversations (event_id, is_group) values (p_event_id, true) returning id into v_id;
    insert into public.conversation_members (conversation_id, participant_id)
    select v_id, p.id from public.participants p where p.event_id = p_event_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.send_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participant_id uuid := public.current_guest_participant_id();
  v_conversation public.conversations;
  row public.messages;
begin
  if v_participant_id is null then
    raise exception 'Join an event first';
  end if;
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if v_conversation.id is null then
    raise exception 'Conversation not found';
  end if;
  if not public.is_event_member(v_conversation.event_id) then
    raise exception 'Not allowed';
  end if;
  insert into public.messages (conversation_id, sender_participant_id, body)
  values (p_conversation_id, v_participant_id, trim(p_body))
  returning * into row;
  return row;
end;
$$;

create or replace function public.send_chat_invite(p_to_participant_id uuid)
returns public.chat_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from uuid := public.current_guest_participant_id();
  v_event_id uuid := public.current_guest_event_id();
  v_event public.events;
  v_to public.participants;
  row public.chat_invites;
begin
  if v_from is null or v_event_id is null then
    raise exception 'Join an event first';
  end if;
  select * into v_event from public.events where id = v_event_id;
  if v_event.chat_mode <> 'private' then
    raise exception 'Invites are only used in private chat mode';
  end if;
  select * into v_to from public.participants where id = p_to_participant_id and event_id = v_event_id;
  if v_to.id is null then
    raise exception 'Participant not found';
  end if;
  insert into public.chat_invites (event_id, from_participant_id, to_participant_id, status)
  values (v_event_id, v_from, p_to_participant_id, 'pending')
  returning * into row;
  return row;
end;
$$;

create or replace function public.respond_to_invite(p_invite_id uuid, p_accept boolean)
returns public.chat_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_guest_participant_id();
  v_invite public.chat_invites;
  v_conversation_id uuid;
begin
  select * into v_invite from public.chat_invites where id = p_invite_id;
  if v_invite.id is null or v_invite.to_participant_id <> v_me then
    raise exception 'Invite not found';
  end if;

  update public.chat_invites
  set status = case when p_accept then 'accepted' else 'declined' end
  where id = p_invite_id
  returning * into v_invite;

  if p_accept then
    select c.id into v_conversation_id
    from public.conversations c
    join public.conversation_members m1 on m1.conversation_id = c.id and m1.participant_id = v_invite.from_participant_id
    join public.conversation_members m2 on m2.conversation_id = c.id and m2.participant_id = v_invite.to_participant_id
    where c.event_id = v_invite.event_id and c.is_group = false
    limit 1;

    if v_conversation_id is null then
      insert into public.conversations (event_id, is_group)
      values (v_invite.event_id, false)
      returning id into v_conversation_id;
      insert into public.conversation_members (conversation_id, participant_id) values
        (v_conversation_id, v_invite.from_participant_id),
        (v_conversation_id, v_invite.to_participant_id);
    end if;
  end if;

  return v_invite;
end;
$$;

create or replace function public.get_or_create_direct_conversation(p_other_participant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_guest_participant_id();
  v_event_id uuid := public.current_guest_event_id();
  v_id uuid;
begin
  if v_me is null or v_event_id is null then
    raise exception 'Join an event first';
  end if;

  select c.id into v_id
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.participant_id = v_me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.participant_id = p_other_participant_id
  where c.event_id = v_event_id and c.is_group = false
  limit 1;

  if v_id is null then
    insert into public.conversations (event_id, is_group) values (v_event_id, false) returning id into v_id;
    insert into public.conversation_members (conversation_id, participant_id) values
      (v_id, v_me),
      (v_id, p_other_participant_id);
  end if;
  return v_id;
end;
$$;

-- RLS
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.participants enable row level security;
alter table public.guest_links enable row level security;
alter table public.activities enable row level security;
alter table public.bookings enable row level security;
alter table public.announcements enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.chat_invites enable row level security;
alter table public.messages enable row level security;

create policy profiles_select on public.profiles for select using (true);
create policy profiles_insert on public.profiles for insert with check (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid());

-- Realtime for live calendar/chat/news updates (ignore if already added)
do $$
begin
  begin
    alter publication supabase_realtime add table public.messages;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.bookings;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.activities;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.announcements;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.participants;
  exception when duplicate_object then null;
  end;
end $$;

create policy events_select on public.events for select using (
  host_id = auth.uid() or public.is_event_member(id)
);
create policy events_insert on public.events for insert with check (host_id = auth.uid());
create policy events_update on public.events for update using (public.can_manage_event(id));

create policy participants_select on public.participants for select using (
  public.is_event_member(event_id) or public.is_event_host(event_id)
);

create policy guest_links_select on public.guest_links for select using (user_id = auth.uid());
create policy guest_links_delete on public.guest_links for delete using (user_id = auth.uid());

create policy activities_select on public.activities for select using (public.is_event_member(event_id));
create policy bookings_select on public.bookings for select using (
  exists(
    select 1 from public.activities a
    where a.id = activity_id and public.is_event_member(a.event_id)
  )
);
create policy announcements_select on public.announcements for select using (public.is_event_member(event_id));
create policy conversations_select on public.conversations for select using (public.is_event_member(event_id));
create policy conversation_members_select on public.conversation_members for select using (
  exists(
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_event_member(c.event_id)
  )
);
create policy chat_invites_select on public.chat_invites for select using (public.is_event_member(event_id));
create policy messages_select on public.messages for select using (
  exists(
    select 1 from public.conversations c
    where c.id = conversation_id and public.is_event_member(c.event_id)
  )
);

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;
grant execute on all functions in schema public to anon, authenticated;
