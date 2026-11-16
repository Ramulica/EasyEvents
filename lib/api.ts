import {
  mapActivity,
  mapAnnouncement,
  mapBooking,
  mapConversation,
  mapEvent,
  mapInvite,
  mapMessage,
  mapNotification,
  mapParticipant,
  mapProfile,
  mapTenant,
  rpcError,
} from './mappers';
import { requireSupabase } from './supabase';
import { emptyData } from './storage';
import type {
  Activity,
  Announcement,
  AppData,
  ChatMode,
  EventRecord,
  Message,
  Participant,
  ParticipantRole,
  Tenant,
} from './types';

export async function fetchProfile(userId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw rpcError(error, 'Could not load profile');
  return data ? mapProfile(data) : null;
}

export async function ensureTenantForUser(userId: string): Promise<Tenant | null> {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('ensure_tenant_for_user', { p_user_id: userId });
  if (error) {
    // Migration not applied yet — app still works without explicit tenants
    console.warn('Tenant ensure skipped', error.message);
    return null;
  }
  return data ? mapTenant(data) : null;
}

export async function fetchTenant(tenantId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.from('tenants').select('*').eq('id', tenantId).maybeSingle();
  if (error) throw rpcError(error, 'Could not load workspace');
  return data ? mapTenant(data) : null;
}

export async function signUpMember(input: { name: string; email: string; password: string }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: { data: { name: input.name.trim() } },
  });
  if (error) throw rpcError(error, 'Could not create account');
  if (!data.user) throw new Error('Could not create account');

  // Ensure profile name is set (trigger may use email prefix)
  await supabase.from('profiles').upsert({
    id: data.user.id,
    email: input.email.trim().toLowerCase(),
    name: input.name.trim(),
  });

  await ensureTenantForUser(data.user.id);

  return data.user;
}

export async function signInMember(input: { email: string; password: string }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });
  if (error) throw rpcError(error, 'Invalid email or password');
  return data.user;
}

export async function signOutAll() {
  const supabase = requireSupabase();
  await supabase.auth.signOut();
}

export async function updateProfile(input: { name?: string; avatarUri?: string | null }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('update_own_profile', {
    p_name: input.name ?? null,
    p_avatar_uri: input.avatarUri ?? null,
  });
  if (error) throw rpcError(error, 'Could not update profile');
  return mapProfile(data);
}

export async function createEvent(input: {
  name: string;
  description: string;
  password?: string;
  chatMode: ChatMode;
  startsAt: string;
  endsAt: string;
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('create_event', {
    p_name: input.name,
    p_description: input.description,
    p_password: input.password ?? null,
    p_chat_mode: input.chatMode,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
  });
  if (error) throw rpcError(error, 'Could not create event');
  return mapEvent(data);
}

export async function addParticipant(input: {
  eventId: string;
  displayName: string;
  password?: string;
  role?: ParticipantRole;
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('add_participant', {
    p_event_id: input.eventId,
    p_display_name: input.displayName,
    p_password: input.password ?? null,
    p_role: input.role ?? 'member',
  });
  if (error) throw rpcError(error, 'Could not add participant');
  return mapParticipant(data);
}

export async function updateParticipantRole(participantId: string, role: ParticipantRole) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('update_participant_role', {
    p_participant_id: participantId,
    p_role: role,
  });
  if (error) throw rpcError(error, 'Could not update role');
  return mapParticipant(data);
}

export async function removeParticipant(participantId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('remove_participant', {
    p_participant_id: participantId,
  });
  if (error) throw rpcError(error, 'Could not remove participant');
}

export async function findEventByCode(code: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('find_event_by_code', { p_code: code });
  if (error) throw rpcError(error, 'Could not find event');
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return undefined;
  return {
    ...mapEvent({
      ...row,
      host_id: '',
      password_hash: row.requires_password ? 'set' : null,
      created_at: new Date().toISOString(),
    }),
    requiresPassword: Boolean(row.requires_password),
  } as EventRecord & { requiresPassword: boolean };
}

export async function listJoinParticipants(code: string, eventPassword?: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('list_event_participants', {
    p_code: code,
    p_event_password: eventPassword ?? null,
  });
  if (error) throw rpcError(error, 'Could not load participants');
  return (data ?? []).map(mapParticipant);
}

export async function guestJoin(input: {
  code: string;
  eventPassword?: string;
  participantId: string;
  participantPassword?: string;
}) {
  const supabase = requireSupabase();

  // Fresh anonymous session for guest identity
  await supabase.auth.signOut();
  const anon = await supabase.auth.signInAnonymously();
  if (anon.error) {
    throw rpcError(
      anon.error,
      'Anonymous sign-in is disabled. Enable it in Supabase → Authentication → Providers → Anonymous.'
    );
  }

  const { data, error } = await supabase.rpc('guest_join', {
    p_code: input.code,
    p_event_password: input.eventPassword ?? null,
    p_participant_id: input.participantId,
    p_participant_password: input.participantPassword ?? null,
  });
  if (error) throw rpcError(error, 'Could not join event');
  const row = Array.isArray(data) ? data[0] : data;
  return {
    eventId: row.event_id as string,
    participantId: row.participant_id as string,
    hostAccountId: (row.host_account_id as string | null) ?? undefined,
  };
}

export async function hostEnterEvent(eventId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('host_enter_event', { p_event_id: eventId });
  if (error) throw rpcError(error, 'Could not open event');
  const row = Array.isArray(data) ? data[0] : data;
  return {
    eventId: row.event_id as string,
    participantId: row.participant_id as string,
    hostAccountId: row.host_account_id as string,
  };
}

export async function addActivity(input: Omit<Activity, 'id' | 'createdAt'>) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('add_activity', {
    p_event_id: input.eventId,
    p_title: input.title,
    p_description: input.description,
    p_location: input.location,
    p_starts_at: input.startsAt,
    p_ends_at: input.endsAt,
    p_capacity: input.capacity,
  });
  if (error) throw rpcError(error, 'Could not add activity');
  return mapActivity(data);
}

export async function toggleBooking(activityId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('toggle_booking', { p_activity_id: activityId });
  if (error) throw rpcError(error, 'Could not update booking');
}

export async function addAnnouncement(input: { eventId: string; title: string; body: string }) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('add_announcement', {
    p_event_id: input.eventId,
    p_title: input.title,
    p_body: input.body,
  });
  if (error) throw rpcError(error, 'Could not post announcement');
  return mapAnnouncement(data);
}

export async function setChatMode(eventId: string, chatMode: ChatMode) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('set_chat_mode', {
    p_event_id: eventId,
    p_chat_mode: chatMode,
  });
  if (error) throw rpcError(error, 'Could not update chat mode');
  return mapEvent(data);
}

export async function listEventPeople(eventId: string) {
  const supabase = requireSupabase();
  const byId = new Map<string, Participant>();

  const addRows = (rows: any[] | null | undefined) => {
    for (const row of rows ?? []) {
      const person = mapParticipant(row);
      if (person.id) byId.set(person.id, person);
    }
  };

  const rpc = await supabase.rpc('list_event_people', { p_event_id: eventId });
  if (!rpc.error) addRows(rpc.data as any[]);

  const table = await supabase
    .from('participants')
    .select('id, event_id, display_name, chat_id, role, avatar_uri, created_at, password_hash')
    .eq('event_id', eventId)
    .order('display_name');
  if (!table.error) addRows(table.data);

  if (byId.size === 0 && (rpc.error || table.error)) {
    throw rpcError(rpc.error ?? table.error, 'Could not load people');
  }

  return [...byId.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function ensureGroupConversation(eventId: string) {
  if (!eventId) throw new Error('Missing event id');
  const supabase = requireSupabase();

  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', eventId)
    .eq('is_group', true)
    .limit(1)
    .maybeSingle();
  if (findError) throw rpcError(findError, 'Could not open chat');
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase.rpc('open_group_chat', { event_id: eventId });
  if (error) throw rpcError(error, 'Could not open chat');
  return data as string;
}

export async function sendMessage(conversationId: string, body: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('send_message', {
    p_conversation_id: conversationId,
    p_body: body,
  });
  if (error) throw rpcError(error, 'Could not send message');
  return mapMessage(data);
}

export async function sendChatInvite(toParticipantId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('send_chat_invite', {
    p_to_participant_id: toParticipantId,
  });
  if (error) throw rpcError(error, 'Could not send invite');
}

export async function sendChatInviteByCode(chatId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('send_chat_invite_by_code', {
    p_chat_id: chatId,
  });
  if (error) throw rpcError(error, 'Could not send invite');
}

export async function respondToInvite(inviteId: string, accept: boolean) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('respond_to_invite', {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  if (error) throw rpcError(error, 'Could not respond to invite');
}

export async function getOrCreateDirectConversation(otherParticipantId: string) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('open_direct_chat', {
    p_other_participant_id: otherParticipantId,
  });
  if (error) {
    // Fallback to older RPC name if migration not applied yet
    const fallback = await supabase.rpc('get_or_create_direct_conversation', {
      p_other_participant_id: otherParticipantId,
    });
    if (fallback.error) throw rpcError(error, 'Could not open chat');
    return fallback.data as string;
  }
  return data as string;
}

export async function createGroupChat(title: string, memberIds: string[]) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.rpc('create_group_chat', {
    p_title: title,
    p_member_ids: memberIds,
  });
  if (error) throw rpcError(error, 'Could not create group');
  return data as string;
}

export async function markConversationRead(conversationId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });
  if (error) throw rpcError(error, 'Could not mark read');
}

export async function markNotificationRead(notificationId: string) {
  const supabase = requireSupabase();
  const { error } = await supabase.rpc('mark_notification_read', {
    p_notification_id: notificationId,
  });
  if (error) throw rpcError(error, 'Could not mark notification');
}

export async function loadAppSnapshot(options?: {
  accountId?: string | null;
  eventId?: string | null;
}): Promise<AppData> {
  const supabase = requireSupabase();
  const next = emptyData();

  if (options?.accountId) {
    const profile = await fetchProfile(options.accountId);
    if (profile) next.accounts = [profile];

    const tenant =
      (profile?.tenantId ? await fetchTenant(profile.tenantId).catch(() => null) : null) ??
      (await ensureTenantForUser(options.accountId));
    if (tenant) {
      next.tenants = [tenant];
      if (profile && !profile.tenantId) {
        next.accounts = [{ ...profile, tenantId: tenant.id }];
      }
    }

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('host_id', options.accountId)
      .order('created_at', { ascending: false });
    if (eventsError) throw rpcError(eventsError, 'Could not load events');
    next.events = (events ?? []).map(mapEvent);

    // Load participants for hosted events (manage screen needs this)
    const hostedIds = next.events.map((e) => e.id);
    if (hostedIds.length) {
      // Prefer RPC per event so we always get the full created roster
      const perEvent = await Promise.all(
        hostedIds.map(async (id) => {
          try {
            return await listEventPeople(id);
          } catch {
            return [] as Participant[];
          }
        })
      );
      const fromRpc = perEvent.flat();
      if (fromRpc.length) {
        next.participants = fromRpc;
      } else {
        const { data: hostedParticipants, error: hostedParticipantsError } = await supabase
          .from('participants')
          .select('id, event_id, display_name, chat_id, role, avatar_uri, created_at, password_hash')
          .in('event_id', hostedIds);
        if (hostedParticipantsError) {
          console.warn('Hosted participants load failed', hostedParticipantsError);
        } else {
          next.participants = (hostedParticipants ?? []).map(mapParticipant);
        }
      }
    }
  }

  if (options?.eventId) {
    const eventId = options.eventId;

    // People first — never let optional chat/news queries wipe the roster
    try {
      const people = await listEventPeople(eventId);
      if (people.length) {
        next.participants = [
          ...next.participants.filter((p) => p.eventId !== eventId),
          ...people,
        ];
      } else {
        const { data: rows } = await supabase
          .from('participants')
          .select('id, event_id, display_name, chat_id, role, avatar_uri, created_at, password_hash')
          .eq('event_id', eventId);
        if (rows?.length) {
          next.participants = [
            ...next.participants.filter((p) => p.eventId !== eventId),
            ...rows.map(mapParticipant),
          ];
        }
      }
    } catch (peopleError) {
      console.warn('People load failed', peopleError);
    }

    const [
      eventRes,
      activitiesRes,
      announcementsRes,
      conversationsRes,
      invitesRes,
      notificationsRes,
    ] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).maybeSingle(),
      supabase.from('activities').select('*').eq('event_id', eventId).order('starts_at'),
      supabase
        .from('announcements')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
      supabase.from('conversations').select('*').eq('event_id', eventId),
      supabase.from('chat_invites').select('*').eq('event_id', eventId),
      supabase
        .from('notifications')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false }),
    ]);

    if (eventRes.error) throw rpcError(eventRes.error, 'Could not load event');
    if (eventRes.data && !next.events.some((e) => e.id === eventRes.data.id)) {
      next.events = [...next.events, mapEvent(eventRes.data)];
    }

    if (!activitiesRes.error) {
      next.activities = (activitiesRes.data ?? []).map(mapActivity);
    }
    if (!announcementsRes.error) {
      next.announcements = (announcementsRes.data ?? []).map(mapAnnouncement);
    }
    if (!invitesRes.error) {
      next.invites = (invitesRes.data ?? []).map(mapInvite);
    }
    if (!notificationsRes.error) {
      next.notifications = (notificationsRes.data ?? []).map(mapNotification);
    }

    const activityIds = next.activities.map((a) => a.id);
    const conversationIds = !conversationsRes.error
      ? (conversationsRes.data ?? []).map((c) => c.id)
      : [];

    const [bookingsRes, messagesRes, membersRes] = await Promise.all([
      activityIds.length
        ? supabase.from('bookings').select('*').in('activity_id', activityIds)
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabase
            .from('messages')
            .select('*')
            .in('conversation_id', conversationIds)
            .order('created_at')
        : Promise.resolve({ data: [], error: null }),
      conversationIds.length
        ? supabase.from('conversation_members').select('*').in('conversation_id', conversationIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (!bookingsRes.error) next.bookings = (bookingsRes.data ?? []).map(mapBooking);
    if (!messagesRes.error) next.messages = (messagesRes.data ?? []).map(mapMessage);

    const { data: link } = await supabase.from('guest_links').select('participant_id').maybeSingle();
    const myParticipantId = link?.participant_id as string | undefined;

    const membersByConversation = new Map<string, string[]>();
    const readAtByConversation = new Map<string, string | null>();
    for (const row of membersRes.data ?? []) {
      const list = membersByConversation.get(row.conversation_id) ?? [];
      list.push(row.participant_id);
      membersByConversation.set(row.conversation_id, list);
      if (myParticipantId && row.participant_id === myParticipantId) {
        readAtByConversation.set(row.conversation_id, row.last_read_at ?? null);
      }
    }
    next.conversations = !conversationsRes.error
      ? (conversationsRes.data ?? []).map((row) =>
          mapConversation(
            row,
            membersByConversation.get(row.id) ?? [],
            readAtByConversation.get(row.id) ?? null
          )
        )
      : [];

    const hostId = eventRes.data?.host_id;
    if (hostId && !next.accounts.some((a) => a.id === hostId)) {
      const host = await fetchProfile(hostId);
      if (host) next.accounts = [...next.accounts, host];
    }
  }

  return next;
}

export async function seedDemoForCurrentHost() {
  const event = await createEvent({
    name: 'Summer Trail Camp',
    description: 'Three days of outdoor activities, meals, and evening hangouts.',
    password: 'camp2026',
    chatMode: 'open',
    startsAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  });

  const people = [
    { name: 'Alex Rivera', role: 'host' as const, password: 'alex123' },
    { name: 'Jordan Lee', role: 'organizer' as const, password: undefined },
    { name: 'Sam Patel', role: 'member' as const, password: 'sam123' },
    { name: 'Casey Kim', role: 'member' as const, password: undefined },
  ];

  for (const person of people) {
    await addParticipant({
      eventId: event.id,
      displayName: person.name,
      role: person.role,
      password: person.password,
    });
  }

  const kickoff = await addActivity({
    eventId: event.id,
    title: 'Morning Kickoff',
    description: 'Welcome circle and team assignments.',
    location: 'Main Lawn',
    startsAt: new Date(new Date().setHours(9, 0, 0, 0)).toISOString(),
    endsAt: new Date(new Date().setHours(10, 0, 0, 0)).toISOString(),
    capacity: 40,
  });
  void kickoff;

  await addActivity({
    eventId: event.id,
    title: 'Kayak Adventure',
    description: 'Guided paddle around the cove.',
    location: 'Boat Dock',
    startsAt: new Date(new Date().setHours(11, 0, 0, 0)).toISOString(),
    endsAt: new Date(new Date().setHours(13, 0, 0, 0)).toISOString(),
    capacity: 12,
  });

  await addAnnouncement({
    eventId: event.id,
    title: 'Welcome to camp!',
    body: 'Check the calendar to book Kayak Adventure. Dinner is at 6:30 by the dining hall.',
  });

  return { code: event.code, eventPassword: 'camp2026', eventId: event.id };
}
