-- Run this in Supabase SQL Editor to fix: function gen_salt(unknown) does not exist

create extension if not exists "pgcrypto" with schema extensions;

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
set search_path = public, extensions
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
         else crypt(p_password, gen_salt('bf')) end,
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
set search_path = public, extensions
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where upper(code) = upper(trim(p_code));
  if v_event.id is null then
    raise exception 'Event not found';
  end if;
  if v_event.password_hash is not null
     and not (v_event.password_hash = crypt(coalesce(p_event_password, ''), v_event.password_hash)) then
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
set search_path = public, extensions
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
     and not (v_event.password_hash = crypt(coalesce(p_event_password, ''), v_event.password_hash)) then
    raise exception 'Incorrect event password';
  end if;

  select * into v_participant
  from public.participants
  where id = p_participant_id and event_id = v_event.id;

  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;
  if v_participant.password_hash is not null
     and not (v_participant.password_hash = crypt(coalesce(p_participant_password, ''), v_participant.password_hash)) then
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
