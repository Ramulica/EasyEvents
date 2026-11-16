-- Remove participants + keep names unique
-- Run in Supabase SQL Editor

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

  -- Remove empty direct conversations left behind
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

grant execute on function public.remove_participant(uuid) to anon, authenticated;
