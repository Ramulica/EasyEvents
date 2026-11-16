-- Fix: column reference "event_id" is ambiguous
-- Fix: duplicate participant names allowed
-- Run in Supabase SQL Editor

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
  v_out_event_id uuid;
  v_out_participant_id uuid;
  v_out_host_id uuid;
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
  from public.participants p
  where p.id = p_participant_id and p.event_id = v_event.id;

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

  v_out_event_id := v_event.id;
  v_out_participant_id := v_participant.id;
  v_out_host_id := case when v_participant.role = 'host' then v_event.host_id else null end;

  return query
  select v_out_event_id, v_out_participant_id, v_out_host_id;
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
  v_name text := trim(p_display_name);
begin
  if not public.can_manage_event(p_event_id) then
    raise exception 'Not allowed';
  end if;

  if v_name is null or length(v_name) = 0 then
    raise exception 'Enter a name';
  end if;

  if exists(
    select 1 from public.participants p
    where p.event_id = p_event_id
      and lower(p.display_name) = lower(v_name)
  ) then
    raise exception 'A participant with that name already exists';
  end if;

  v_role := case when p_role = 'host' then 'organizer'::public.participant_role else p_role end;

  insert into public.participants (
    event_id, display_name, password_hash, chat_id, role
  ) values (
    p_event_id,
    v_name,
    case when p_password is null or length(trim(p_password)) = 0 then null
         else crypt(p_password, gen_salt('bf')) end,
    public.make_chat_id(),
    v_role
  ) returning * into v_participant;

  select c.id into v_group
  from public.conversations c
  where c.event_id = p_event_id and c.is_group = true
  limit 1;

  if v_group is not null then
    insert into public.conversation_members (conversation_id, participant_id)
    values (v_group, v_participant.id)
    on conflict do nothing;
  end if;

  return v_participant;
end;
$$;
