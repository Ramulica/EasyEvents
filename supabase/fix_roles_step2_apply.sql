-- STEP 2: run AFTER step 1 succeeded
-- Chat fix + role permissions (admin/host/organizer/member)
-- 2) Migrate previous "host" (creator) rows to "admin"
update public.participants p
set role = 'admin'
where p.role = 'host'
  and exists (
    select 1
    from public.events e
    join public.profiles pr on pr.id = e.host_id
    where e.id = p.event_id
      and lower(pr.name) = lower(p.display_name)
  );

-- Any remaining creator-marked hosts tied to event host participant slot
update public.participants p
set role = 'admin'
where p.role = 'host'
  and p.id = (
    select p2.id
    from public.participants p2
    where p2.event_id = p.event_id
    order by p2.created_at asc
    limit 1
  );

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
        and p.role in ('admin', 'host')
    );
$$;

create or replace function public.can_organize_event(p_event_id uuid)
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
        and p.role in ('admin', 'host', 'organizer')
    );
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
  v_actor public.participants;
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

  if p_role = 'admin' then
    raise exception 'Only the event creator is admin';
  end if;

  -- host/admin-level people must have a password
  if p_role = 'host' and (p_password is null or length(trim(p_password)) = 0) then
    raise exception 'Hosts must have a password';
  end if;

  select p.* into v_actor
  from public.guest_links gl
  join public.participants p on p.id = gl.participant_id
  where gl.user_id = auth.uid() and gl.event_id = p_event_id
  limit 1;

  if p_role = 'host' and not (
    public.is_event_host(p_event_id)
    or (v_actor.role = 'admin')
  ) then
    raise exception 'Only the admin can add hosts';
  end if;

  v_role := p_role;

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
  v_actor public.participants;
begin
  select * into v_participant from public.participants where id = p_participant_id;
  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;

  if not public.can_manage_event(v_participant.event_id) then
    raise exception 'Not allowed';
  end if;

  if v_participant.role = 'admin' then
    raise exception 'The admin role cannot be changed';
  end if;

  if p_role = 'admin' then
    raise exception 'Cannot assign admin role';
  end if;

  select p.* into v_actor
  from public.guest_links gl
  join public.participants p on p.id = gl.participant_id
  where gl.user_id = auth.uid() and gl.event_id = v_participant.event_id
  limit 1;

  if p_role = 'host' and not (
    public.is_event_host(v_participant.event_id)
    or coalesce(v_actor.role, 'member') = 'admin'
  ) then
    raise exception 'Only the admin can make someone a host';
  end if;

  if coalesce(v_actor.role, 'member') = 'host' and p_role = 'host' then
    raise exception 'Hosts cannot make other people hosts';
  end if;

  update public.participants
  set role = p_role
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
  select * into v_participant from public.participants where id = p_participant_id;
  if v_participant.id is null then
    raise exception 'Participant not found';
  end if;
  if not public.can_manage_event(v_participant.event_id) then
    raise exception 'Not allowed';
  end if;
  if v_participant.role = 'admin' then
    raise exception 'You cannot remove the admin';
  end if;

  delete from public.guest_links where participant_id = p_participant_id;
  delete from public.bookings where participant_id = p_participant_id;
  delete from public.chat_invites
  where from_participant_id = p_participant_id or to_participant_id = p_participant_id;
  delete from public.messages where sender_participant_id = p_participant_id;
  delete from public.conversation_members where participant_id = p_participant_id;
  delete from public.conversations c
  where c.is_group = false
    and c.event_id = v_participant.event_id
    and not exists (select 1 from public.conversation_members m where m.conversation_id = c.id);
  delete from public.participants where id = p_participant_id;
  return true;
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
  where p.event_id = p_event_id and p.role = 'admin'
  limit 1;

  if v_participant.id is null then
    insert into public.participants (
      event_id, display_name, chat_id, role, avatar_uri
    ) values (
      p_event_id, v_profile.name, public.make_chat_id(), 'admin', v_profile.avatar_uri
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

  return query select v_out_event_id, v_out_participant_id, v_out_host_id;
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
  return row;
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
  if not public.can_organize_event(p_event_id) then
    raise exception 'Not allowed';
  end if;
  select host_id into v_host from public.events where id = p_event_id;
  insert into public.announcements (event_id, title, body, created_by_host_id)
  values (p_event_id, trim(p_title), trim(p_body), coalesce(auth.uid(), v_host))
  returning * into row;
  return row;
end;
$$;

-- Chat fix: return a row so PostgREST finds the function reliably
drop function if exists public.ensure_group_conversation(uuid);

create or replace function public.ensure_group_conversation(p_event_id uuid)
returns table (conversation_id uuid)
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

  select c.id into v_id
  from public.conversations c
  where c.event_id = p_event_id and c.is_group
  limit 1;

  if v_id is null then
    insert into public.conversations (event_id, is_group)
    values (p_event_id, true)
    returning id into v_id;

    insert into public.conversation_members (conversation_id, participant_id)
    select v_id, p.id from public.participants p where p.event_id = p_event_id;
  end if;

  return query select v_id;
end;
$$;

-- Keep guest_join host_account_id aligned with admin role
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
  v_out_host_id := case when v_participant.role = 'admin' then v_event.host_id else null end;

  return query select v_out_event_id, v_out_participant_id, v_out_host_id;
end;
$$;

notify pgrst, 'reload schema';

grant execute on function public.ensure_group_conversation(uuid) to anon, authenticated;
grant execute on function public.can_organize_event(uuid) to anon, authenticated;

