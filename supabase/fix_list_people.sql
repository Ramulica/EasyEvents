-- Guaranteed people list for Manage + Chat (created users, joined or not)
-- Run in Supabase SQL Editor

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
    exists (
      select 1 from public.events e
      where e.id = p_event_id and e.host_id = auth.uid()
    )
    or exists (
      select 1 from public.guest_links gl
      where gl.user_id = auth.uid() and gl.event_id = p_event_id
    )
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

grant execute on function public.list_event_people(uuid) to anon, authenticated;

drop policy if exists participants_select on public.participants;
create policy participants_select on public.participants for select using (
  exists (
    select 1 from public.events e
    where e.id = event_id and e.host_id = auth.uid()
  )
  or exists (
    select 1 from public.guest_links gl
    where gl.user_id = auth.uid() and gl.event_id = participants.event_id
  )
);

notify pgrst, 'reload schema';
