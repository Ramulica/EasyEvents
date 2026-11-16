-- Fresh chat helper (avoids stale ensure_group_conversation cache issues)
-- Run in Supabase SQL Editor

create or replace function public.open_group_chat(event_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if event_id is null then
    raise exception 'Missing event';
  end if;

  if not public.is_event_member(event_id) then
    raise exception 'Not allowed';
  end if;

  select c.id into v_id
  from public.conversations c
  where c.event_id = open_group_chat.event_id and c.is_group = true
  limit 1;

  if v_id is null then
    insert into public.conversations (event_id, is_group)
    values (open_group_chat.event_id, true)
    returning id into v_id;

    insert into public.conversation_members (conversation_id, participant_id)
    select v_id, p.id
    from public.participants p
    where p.event_id = open_group_chat.event_id
    on conflict do nothing;
  end if;

  return v_id;
end;
$$;

grant execute on function public.open_group_chat(uuid) to anon, authenticated;
notify pgrst, 'reload schema';
