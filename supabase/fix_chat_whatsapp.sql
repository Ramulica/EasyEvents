-- WhatsApp-style chat + people list + notifications
-- Run in Supabase SQL Editor

alter table public.conversations
  add column if not exists title text,
  add column if not exists created_by_participant_id uuid references public.participants(id) on delete set null;

alter table public.conversation_members
  add column if not exists last_read_at timestamptz default now();

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null default '',
  ref_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_participant_idx
  on public.notifications(participant_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications for select using (
  participant_id = public.current_guest_participant_id()
);

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications for update using (
  participant_id = public.current_guest_participant_id()
);

grant select, update, insert, delete on public.notifications to anon, authenticated;

drop function if exists public.list_event_people(uuid);

create or replace function public.list_event_people(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  display_name text,
  chat_id text,
  role public.participant_role,
  avatar_uri text,
  created_at timestamptz,
  requires_password boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if not (
    exists (select 1 from public.events e where e.id = p_event_id and e.host_id = auth.uid())
    or exists (select 1 from public.guest_links gl where gl.user_id = auth.uid() and gl.event_id = p_event_id)
  ) then
    raise exception 'Not allowed';
  end if;
  return query
  select
    p.id,
    p.event_id,
    p.display_name,
    p.chat_id,
    p.role,
    p.avatar_uri,
    p.created_at,
    (p.password_hash is not null) as requires_password
  from public.participants p
  where p.event_id = p_event_id
  order by lower(p.display_name);
end;
$$;

create or replace function public.open_direct_chat(p_other_participant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_guest_participant_id();
  v_event_id uuid := public.current_guest_event_id();
  v_event public.events;
  v_other public.participants;
  v_id uuid;
  v_connected boolean;
begin
  if v_me is null or v_event_id is null then
    raise exception 'Join an event first';
  end if;

  select * into v_event from public.events where id = v_event_id;
  select * into v_other from public.participants where id = p_other_participant_id and event_id = v_event_id;
  if v_other.id is null then
    raise exception 'User not found';
  end if;
  if p_other_participant_id = v_me then
    raise exception 'Cannot chat with yourself';
  end if;

  if v_event.chat_mode = 'off' then
    raise exception 'Chat is disabled';
  end if;

  if v_event.chat_mode = 'private' then
    select exists(
      select 1 from public.chat_invites i
      where i.event_id = v_event_id
        and i.status = 'accepted'
        and (
          (i.from_participant_id = v_me and i.to_participant_id = p_other_participant_id)
          or (i.from_participant_id = p_other_participant_id and i.to_participant_id = v_me)
        )
    ) into v_connected;
    if not v_connected then
      raise exception 'Add this user first and wait for them to accept';
    end if;
  end if;

  select c.id into v_id
  from public.conversations c
  join public.conversation_members m1 on m1.conversation_id = c.id and m1.participant_id = v_me
  join public.conversation_members m2 on m2.conversation_id = c.id and m2.participant_id = p_other_participant_id
  where c.event_id = v_event_id and c.is_group = false
  limit 1;

  if v_id is null then
    insert into public.conversations (event_id, is_group, created_by_participant_id)
    values (v_event_id, false, v_me)
    returning id into v_id;
    insert into public.conversation_members (conversation_id, participant_id, last_read_at) values
      (v_id, v_me, now()),
      (v_id, p_other_participant_id, now());
  end if;

  return v_id;
end;
$$;

create or replace function public.create_group_chat(p_title text, p_member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_guest_participant_id();
  v_event_id uuid := public.current_guest_event_id();
  v_id uuid;
  v_member uuid;
begin
  if v_me is null or v_event_id is null then
    raise exception 'Join an event first';
  end if;
  if not public.can_organize_event(v_event_id) then
    raise exception 'Only admin, host, or organizer can create groups';
  end if;
  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Group needs a name';
  end if;

  insert into public.conversations (event_id, is_group, title, created_by_participant_id)
  values (v_event_id, true, trim(p_title), v_me)
  returning id into v_id;

  insert into public.conversation_members (conversation_id, participant_id, last_read_at)
  values (v_id, v_me, now())
  on conflict do nothing;

  foreach v_member in array coalesce(p_member_ids, '{}') loop
    if v_member is distinct from v_me and exists(
      select 1 from public.participants p where p.id = v_member and p.event_id = v_event_id
    ) then
      insert into public.conversation_members (conversation_id, participant_id, last_read_at)
      values (v_id, v_member, now())
      on conflict do nothing;

      insert into public.notifications (event_id, participant_id, kind, title, body, ref_id)
      values (v_event_id, v_member, 'group_add', 'Added to group', 'You were added to "' || trim(p_title) || '"', v_id);
    end if;
  end loop;

  return v_id;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := public.current_guest_participant_id();
begin
  if v_me is null then
    raise exception 'Join an event first';
  end if;
  update public.conversation_members
  set last_read_at = now()
  where conversation_id = p_conversation_id and participant_id = v_me;
  return true;
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
  v_member record;
  v_sender_name text;
begin
  if v_participant_id is null then
    raise exception 'Join an event first';
  end if;
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if v_conversation.id is null then
    raise exception 'Conversation not found';
  end if;
  if not exists(
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id and participant_id = v_participant_id
  ) then
    raise exception 'Not allowed';
  end if;

  insert into public.messages (conversation_id, sender_participant_id, body)
  values (p_conversation_id, v_participant_id, trim(p_body))
  returning * into row;

  select display_name into v_sender_name from public.participants where id = v_participant_id;

  for v_member in
    select participant_id
    from public.conversation_members
    where conversation_id = p_conversation_id and participant_id <> v_participant_id
  loop
    insert into public.notifications (event_id, participant_id, kind, title, body, ref_id)
    values (
      v_conversation.event_id,
      v_member.participant_id,
      'message',
      coalesce(v_sender_name, 'New message'),
      left(trim(p_body), 80),
      p_conversation_id
    );
  end loop;

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
  v_from_name text;
begin
  if v_from is null or v_event_id is null then
    raise exception 'Join an event first';
  end if;
  select * into v_event from public.events where id = v_event_id;
  if v_event.chat_mode = 'off' then
    raise exception 'Chat is disabled';
  end if;
  select * into v_to from public.participants where id = p_to_participant_id and event_id = v_event_id;
  if v_to.id is null then
    raise exception 'Participant not found';
  end if;
  if p_to_participant_id = v_from then
    raise exception 'That is your own ID';
  end if;

  insert into public.chat_invites (event_id, from_participant_id, to_participant_id, status)
  values (v_event_id, v_from, p_to_participant_id, 'pending')
  returning * into row;

  select display_name into v_from_name from public.participants where id = v_from;
  insert into public.notifications (event_id, participant_id, kind, title, body, ref_id)
  values (v_event_id, p_to_participant_id, 'invite', 'Chat invite', coalesce(v_from_name, 'Someone') || ' wants to chat', row.id);

  return row;
end;
$$;

create or replace function public.send_chat_invite_by_code(p_chat_id text)
returns public.chat_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid := public.current_guest_event_id();
  v_to public.participants;
begin
  select * into v_to
  from public.participants
  where event_id = v_event_id and chat_id = trim(p_chat_id)
  limit 1;
  if v_to.id is null then
    raise exception 'No user with that chat ID';
  end if;
  return public.send_chat_invite(v_to.id);
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
  v_p record;
begin
  if not public.can_organize_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  select host_id into v_host from public.events where id = p_event_id;
  insert into public.announcements (event_id, title, body, created_by_host_id)
  values (p_event_id, trim(p_title), trim(p_body), coalesce(auth.uid(), v_host))
  returning * into row;

  for v_p in select id from public.participants where event_id = p_event_id loop
    insert into public.notifications (event_id, participant_id, kind, title, body, ref_id)
    values (p_event_id, v_p.id, 'news', 'New announcement', trim(p_title), row.id);
  end loop;

  return row;
end;
$$;

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
  v_p record;
begin
  if not public.can_organize_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  insert into public.activities (
    event_id, title, description, location, starts_at, ends_at, capacity
  ) values (
    p_event_id, trim(p_title), coalesce(p_description, ''), coalesce(p_location, 'TBA'),
    p_starts_at, p_ends_at, p_capacity
  ) returning * into row;

  for v_p in select id from public.participants where event_id = p_event_id loop
    insert into public.notifications (event_id, participant_id, kind, title, body, ref_id)
    values (p_event_id, v_p.id, 'activity', 'New activity', trim(p_title), row.id);
  end loop;

  return row;
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notifications
  set read_at = now()
  where id = p_notification_id
    and participant_id = public.current_guest_participant_id();
  return true;
end;
$$;

notify pgrst, 'reload schema';

grant execute on function public.list_event_people(uuid) to anon, authenticated;
grant execute on function public.open_direct_chat(uuid) to anon, authenticated;
grant execute on function public.create_group_chat(text, uuid[]) to anon, authenticated;
grant execute on function public.mark_conversation_read(uuid) to anon, authenticated;
grant execute on function public.send_chat_invite_by_code(text) to anon, authenticated;
grant execute on function public.mark_notification_read(uuid) to anon, authenticated;
