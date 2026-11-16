import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import * as api from '@/lib/api';
import { mergeSnapshotPeople, stickGuestSession } from '@/lib/sessionSticky';
import { emptyData, loadSession, saveSession } from '@/lib/storage';
import { isSupabaseConfigured, requireSupabase } from '@/lib/supabase';
import type {
  Activity,
  Announcement,
  AppData,
  ChatMode,
  EventRecord,
  MembershipAccount,
  Message,
  Participant,
  ParticipantRole,
  Session,
  Tenant,
} from '@/lib/types';

type AppContextValue = {
  ready: boolean;
  configured: boolean;
  data: AppData;
  session: Session | null;
  currentAccount: MembershipAccount | null;
  currentTenant: Tenant | null;
  currentParticipant: Participant | null;
  currentEvent: EventRecord | null;
  canManageCurrentEvent: boolean;
  canOrganizeCurrentEvent: boolean;
  refresh: () => Promise<void>;
  signUpMember: (input: { name: string; email: string; password: string }) => Promise<void>;
  signInMember: (input: { email: string; password: string }) => Promise<void>;
  signOut: () => Promise<void>;
  leaveEvent: () => Promise<'member' | 'welcome'>;
  updateProfile: (input: { name?: string; avatarUri?: string | null }) => Promise<void>;
  loadDemo: () => Promise<{ code: string; eventPassword: string }>;
  createEvent: (input: {
    name: string;
    description: string;
    password?: string;
    chatMode: ChatMode;
    startsAt: string;
    endsAt: string;
  }) => Promise<EventRecord>;
  addParticipant: (input: {
    eventId: string;
    displayName: string;
    password?: string;
    role?: ParticipantRole;
  }) => Promise<Participant>;
  updateParticipantRole: (participantId: string, role: ParticipantRole) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;
  findEventByCode: (code: string) => Promise<(EventRecord & { requiresPassword?: boolean }) | undefined>;
  listJoinParticipants: (code: string, eventPassword?: string) => Promise<Participant[]>;
  joinAsGuest: (input: {
    code: string;
    eventPassword?: string;
    participantId: string;
    participantPassword?: string;
  }) => Promise<{ eventId: string }>;
  enterEventAsHost: (eventId: string) => Promise<void>;
  addActivity: (input: Omit<Activity, 'id' | 'createdAt'>) => Promise<Activity>;
  toggleBooking: (activityId: string) => Promise<void>;
  addAnnouncement: (input: { eventId: string; title: string; body: string }) => Promise<Announcement>;
  setChatMode: (eventId: string, chatMode: ChatMode) => Promise<void>;
  sendMessage: (conversationId: string, body: string) => Promise<Message>;
  ensureGroupConversation: (eventId: string) => Promise<string>;
  sendChatInvite: (toParticipantId: string) => Promise<void>;
  sendChatInviteByCode: (chatId: string) => Promise<void>;
  respondToInvite: (inviteId: string, accept: boolean) => Promise<void>;
  getOrCreateDirectConversation: (otherParticipantId: string) => Promise<string>;
  createGroupChat: (title: string, memberIds: string[]) => Promise<string>;
  markConversationRead: (conversationId: string) => Promise<void>;
  markNotificationRead: (notificationId: string) => Promise<void>;
  reloadEventPeople: (eventId: string) => Promise<void>;
  bookingsForActivity: (activityId: string) => AppData['bookings'];
  participantsForEvent: (eventId: string) => Participant[];
  activitiesForEvent: (eventId: string) => Activity[];
  announcementsForEvent: (eventId: string) => Announcement[];
  eventsForHost: (hostId: string) => EventRecord[];
  unreadMessageCount: number;
  unreadInviteCount: number;
  unreadNotificationCount: number;
  conversationUnreadCount: (conversationId: string) => number;
};

const AppContext = createContext<AppContextValue | null>(null);

async function resolveSession(previous: Session | null): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = requireSupabase();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) {
    await saveSession(null);
    return null;
  }

  const { data: link, error: linkError } = await supabase
    .from('guest_links')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  if (link) {
    const guest: Session = {
      kind: 'guest',
      eventId: link.event_id,
      participantId: link.participant_id,
      hostAccountId: user.is_anonymous ? undefined : user.id,
    };
    await saveSession(guest);
    return guest;
  }

  const cached =
    previous?.kind === 'guest' ? previous : await loadSession();

  // Link query flaked — keep the in-event session
  if (linkError && cached?.kind === 'guest') {
    return cached;
  }

  // Host still inside an event but guest_link row missing — re-bind
  if (
    cached?.kind === 'guest' &&
    !user.is_anonymous &&
    cached.hostAccountId === user.id
  ) {
    try {
      const entered = await api.hostEnterEvent(cached.eventId);
      const guest: Session = {
        kind: 'guest',
        eventId: entered.eventId,
        participantId: entered.participantId,
        hostAccountId: entered.hostAccountId,
      };
      await saveSession(guest);
      return guest;
    } catch (error) {
      console.warn('Could not restore host guest link', error);
      return cached;
    }
  }

  if (cached?.kind === 'guest' && user.is_anonymous) {
    // Keep guest identity through transient link misses
    return cached;
  }

  if (user.is_anonymous) {
    await saveSession(null);
    return null;
  }

  const member: Session = { kind: 'member', accountId: user.id };
  await saveSession(member);
  return member;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData>(emptyData());
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const leavingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setData(emptyData());
      setSession(null);
      sessionRef.current = null;
      return;
    }

    const resolved = await resolveSession(sessionRef.current);
    const nextSession = leavingRef.current
      ? resolved
      : stickGuestSession(sessionRef.current, resolved);
    sessionRef.current = nextSession;
    setSession(nextSession);
    if (nextSession) await saveSession(nextSession);

    const accountId =
      nextSession?.kind === 'member'
        ? nextSession.accountId
        : nextSession?.hostAccountId ?? null;
    const eventId = nextSession?.kind === 'guest' ? nextSession.eventId : null;

    let hostId = accountId;
    if (!hostId && nextSession?.kind === 'guest' && nextSession.hostAccountId) {
      hostId = nextSession.hostAccountId;
    }
    if (!hostId && nextSession === null) {
      const supabase = requireSupabase();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user && !auth.user.is_anonymous) hostId = auth.user.id;
    }

    const snapshot = await api.loadAppSnapshot({
      accountId: hostId,
      eventId,
    });
    setData((prev) => mergeSnapshotPeople(prev, snapshot, eventId));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (isSupabaseConfigured) {
          await refresh();
        }
      } catch (error) {
        console.warn('Failed to restore session', error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    if (!isSupabaseConfigured) return;

    const supabase = requireSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      // Avoid races that wipe in-event people on soft navigation
      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return;
      refresh().catch(console.warn);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [refresh]);

  // Live updates while inside an event
  useEffect(() => {
    if (!isSupabaseConfigured || session?.kind !== 'guest') return;
    const supabase = requireSupabase();
    const channel = supabase
      .channel(`event-${session.eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_invites' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants' },
        () => {
          refresh().catch(console.warn);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, session]);

  const currentAccount = useMemo(() => {
    if (!session) return null;
    if (session.kind === 'member') {
      return data.accounts.find((a) => a.id === session.accountId) ?? null;
    }
    if (session.hostAccountId) {
      return data.accounts.find((a) => a.id === session.hostAccountId) ?? null;
    }
    return null;
  }, [data.accounts, session]);

  const currentTenant = useMemo(() => {
    if (!currentAccount?.tenantId) {
      return data.tenants.find((t) => t.ownerUserId === currentAccount?.id) ?? null;
    }
    return data.tenants.find((t) => t.id === currentAccount.tenantId) ?? null;
  }, [currentAccount, data.tenants]);

  const currentParticipant = useMemo(() => {
    if (!session || session.kind !== 'guest') return null;
    const found = data.participants.find((p) => p.id === session.participantId);
    if (found) return found;
    // Keep manage/chat usable even if roster is still loading
    return {
      id: session.participantId,
      eventId: session.eventId,
      displayName: 'You',
      passwordHash: null,
      chatId: '',
      role: session.hostAccountId ? ('admin' as const) : ('member' as const),
      avatarUri: null,
      createdAt: new Date().toISOString(),
    };
  }, [data.participants, session]);

  const currentEvent = useMemo(() => {
    if (!session || session.kind !== 'guest') return null;
    return data.events.find((e) => e.id === session.eventId) ?? null;
  }, [data.events, session]);

  const canManageCurrentEvent = useMemo(() => {
    if (!currentEvent) return false;
    if (session?.kind === 'guest' && session.hostAccountId) return true;
    if (!currentParticipant) return false;
    return currentParticipant.role === 'admin' || currentParticipant.role === 'host';
  }, [currentEvent, currentParticipant, session]);

  const canOrganizeCurrentEvent = useMemo(() => {
    if (!currentEvent) return false;
    if (session?.kind === 'guest' && session.hostAccountId) return true;
    if (!currentParticipant) return false;
    return (
      currentParticipant.role === 'admin' ||
      currentParticipant.role === 'host' ||
      currentParticipant.role === 'organizer'
    );
  }, [currentEvent, currentParticipant, session]);

  const signUpMember = useCallback(
    async (input: { name: string; email: string; password: string }) => {
      await api.signUpMember(input);
      await refresh();
    },
    [refresh]
  );

  const signInMember = useCallback(
    async (input: { email: string; password: string }) => {
      await api.signInMember(input);
      await refresh();
    },
    [refresh]
  );

  const signOut = useCallback(async () => {
    leavingRef.current = true;
    await saveSession(null);
    await api.signOutAll();
    sessionRef.current = null;
    setSession(null);
    setData(emptyData());
    leavingRef.current = false;
  }, []);

  const leaveEvent = useCallback(async () => {
    if (!isSupabaseConfigured) return 'welcome' as const;
    leavingRef.current = true;
    await saveSession(null);
    const supabase = requireSupabase();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from('guest_links').delete().eq('user_id', auth.user.id);
      if (auth.user.is_anonymous) {
        await api.signOutAll();
        sessionRef.current = null;
        setSession(null);
        setData(emptyData());
        leavingRef.current = false;
        return 'welcome' as const;
      }
    }
    const memberSession: Session | null = auth.user
      ? { kind: 'member', accountId: auth.user.id }
      : null;
    sessionRef.current = memberSession;
    setSession(memberSession);
    if (memberSession) await saveSession(memberSession);
    await refresh();
    leavingRef.current = false;
    return 'member' as const;
  }, [refresh]);

  const updateProfile = useCallback(
    async (input: { name?: string; avatarUri?: string | null }) => {
      await api.updateProfile(input);
      await refresh();
    },
    [refresh]
  );

  const loadDemo = useCallback(async () => {
    if (!session || session.kind !== 'member') {
      throw new Error('Sign in as a member first, then load the demo camp.');
    }
    const demo = await api.seedDemoForCurrentHost();
    await refresh();
    return { code: demo.code, eventPassword: demo.eventPassword };
  }, [refresh, session]);

  const createEvent = useCallback(
    async (input: {
      name: string;
      description: string;
      password?: string;
      chatMode: ChatMode;
      startsAt: string;
      endsAt: string;
    }) => {
      const event = await api.createEvent(input);
      await refresh();
      return event;
    },
    [refresh]
  );

  const addParticipant = useCallback(
    async (input: {
      eventId: string;
      displayName: string;
      password?: string;
      role?: ParticipantRole;
    }) => {
      const participant = await api.addParticipant(input);
      await refresh();
      return participant;
    },
    [refresh]
  );

  const updateParticipantRole = useCallback(
    async (participantId: string, role: ParticipantRole) => {
      await api.updateParticipantRole(participantId, role);
      await refresh();
    },
    [refresh]
  );

  const removeParticipant = useCallback(
    async (participantId: string) => {
      await api.removeParticipant(participantId);
      await refresh();
    },
    [refresh]
  );

  const findEventByCode = useCallback(async (code: string) => api.findEventByCode(code), []);

  const listJoinParticipants = useCallback(
    async (code: string, eventPassword?: string) => api.listJoinParticipants(code, eventPassword),
    []
  );

  const joinAsGuest = useCallback(
    async (input: {
      code: string;
      eventPassword?: string;
      participantId: string;
      participantPassword?: string;
    }) => {
      const joined = await api.guestJoin(input);
      const guestSession: Session = {
        kind: 'guest',
        eventId: joined.eventId,
        participantId: joined.participantId,
        hostAccountId: joined.hostAccountId,
      };
      sessionRef.current = guestSession;
      setSession(guestSession);
      await saveSession(guestSession);
      await refresh();
      try {
        const people = await api.listEventPeople(joined.eventId);
        if (people.length) {
          setData((prev) => ({
            ...prev,
            participants: [
              ...prev.participants.filter((p) => p.eventId !== joined.eventId),
              ...people,
            ],
          }));
        }
      } catch (error) {
        console.warn('Could not preload people', error);
      }
      return { eventId: joined.eventId };
    },
    [refresh]
  );

  const enterEventAsHost = useCallback(
    async (eventId: string) => {
      const entered = await api.hostEnterEvent(eventId);
      const guestSession: Session = {
        kind: 'guest',
        eventId: entered.eventId,
        participantId: entered.participantId,
        hostAccountId: entered.hostAccountId,
      };
      sessionRef.current = guestSession;
      setSession(guestSession);
      await saveSession(guestSession);
      // Load roster before refresh so tabs never mount on an empty list
      let people: Participant[] = [];
      try {
        people = await api.listEventPeople(entered.eventId);
        if (people.length) {
          setData((prev) => ({
            ...prev,
            participants: [
              ...prev.participants.filter((p) => p.eventId !== entered.eventId),
              ...people,
            ],
          }));
        }
      } catch (error) {
        console.warn('Could not preload people', error);
      }
      await refresh();
      if (people.length) {
        setData((prev) => {
          const current = prev.participants.filter((p) => p.eventId === entered.eventId);
          if (current.length >= people.length) return prev;
          return {
            ...prev,
            participants: [
              ...prev.participants.filter((p) => p.eventId !== entered.eventId),
              ...people,
            ],
          };
        });
      }
    },
    [refresh]
  );

  const addActivity = useCallback(
    async (input: Omit<Activity, 'id' | 'createdAt'>) => {
      const activity = await api.addActivity(input);
      await refresh();
      return activity;
    },
    [refresh]
  );

  const toggleBooking = useCallback(
    async (activityId: string) => {
      await api.toggleBooking(activityId);
      await refresh();
    },
    [refresh]
  );

  const addAnnouncement = useCallback(
    async (input: { eventId: string; title: string; body: string }) => {
      const announcement = await api.addAnnouncement(input);
      await refresh();
      return announcement;
    },
    [refresh]
  );

  const setChatMode = useCallback(
    async (eventId: string, chatMode: ChatMode) => {
      await api.setChatMode(eventId, chatMode);
      await refresh();
    },
    [refresh]
  );

  const ensureGroupConversation = useCallback(
    async (eventId: string) => api.ensureGroupConversation(eventId),
    []
  );

  const sendMessage = useCallback(
    async (conversationId: string, body: string) => {
      const message = await api.sendMessage(conversationId, body);
      await refresh();
      return message;
    },
    [refresh]
  );

  const sendChatInvite = useCallback(
    async (toParticipantId: string) => {
      await api.sendChatInvite(toParticipantId);
      await refresh();
    },
    [refresh]
  );

  const sendChatInviteByCode = useCallback(
    async (chatId: string) => {
      await api.sendChatInviteByCode(chatId);
      await refresh();
    },
    [refresh]
  );

  const respondToInvite = useCallback(
    async (inviteId: string, accept: boolean) => {
      await api.respondToInvite(inviteId, accept);
      await refresh();
    },
    [refresh]
  );

  const getOrCreateDirectConversation = useCallback(
    async (otherParticipantId: string) => {
      const id = await api.getOrCreateDirectConversation(otherParticipantId);
      setData((prev) => {
        if (prev.conversations.some((c) => c.id === id)) return prev;
        const meId =
          session?.kind === 'guest' ? session.participantId : undefined;
        const eventId = session?.kind === 'guest' ? session.eventId : undefined;
        if (!meId || !eventId) return prev;
        return {
          ...prev,
          conversations: [
            ...prev.conversations,
            {
              id,
              eventId,
              isGroup: false,
              title: null,
              createdByParticipantId: meId,
              participantIds: [meId, otherParticipantId],
              myLastReadAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
      refresh().catch(console.warn);
      return id;
    },
    [refresh, session]
  );

  const createGroupChat = useCallback(
    async (title: string, memberIds: string[]) => {
      const id = await api.createGroupChat(title, memberIds);
      setData((prev) => {
        if (prev.conversations.some((c) => c.id === id)) return prev;
        const meId =
          session?.kind === 'guest' ? session.participantId : undefined;
        const eventId = session?.kind === 'guest' ? session.eventId : undefined;
        if (!meId || !eventId) return prev;
        return {
          ...prev,
          conversations: [
            ...prev.conversations,
            {
              id,
              eventId,
              isGroup: true,
              title,
              createdByParticipantId: meId,
              participantIds: [meId, ...memberIds],
              myLastReadAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
            },
          ],
        };
      });
      refresh().catch(console.warn);
      return id;
    },
    [refresh, session]
  );

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      await api.markConversationRead(conversationId);
      await refresh();
    },
    [refresh]
  );

  const markNotificationRead = useCallback(
    async (notificationId: string) => {
      await api.markNotificationRead(notificationId);
      await refresh();
    },
    [refresh]
  );

  const reloadEventPeople = useCallback(async (eventId: string) => {
    try {
      const people = await api.listEventPeople(eventId);
      if (!people.length) return;
      setData((prev) => ({
        ...prev,
        participants: [
          ...prev.participants.filter((p) => p.eventId !== eventId),
          ...people,
        ],
      }));
    } catch (error) {
      console.warn('Could not reload people', error);
    }
  }, []);

  const conversationUnreadCount = useCallback(
    (conversationId: string) => {
      if (!currentParticipant) return 0;
      const conversation = data.conversations.find((c) => c.id === conversationId);
      if (!conversation) return 0;
      const lastRead = conversation.myLastReadAt
        ? new Date(conversation.myLastReadAt).getTime()
        : 0;
      return data.messages.filter(
        (m) =>
          m.conversationId === conversationId &&
          m.senderParticipantId !== currentParticipant.id &&
          new Date(m.createdAt).getTime() > lastRead
      ).length;
    },
    [currentParticipant, data.conversations, data.messages]
  );

  const unreadMessageCount = useMemo(() => {
    if (!currentParticipant || !currentEvent) return 0;
    return data.conversations
      .filter((c) => c.eventId === currentEvent.id && c.participantIds.includes(currentParticipant.id))
      .reduce((sum, c) => sum + conversationUnreadCount(c.id), 0);
  }, [conversationUnreadCount, currentEvent, currentParticipant, data.conversations]);

  const unreadInviteCount = useMemo(() => {
    if (!currentParticipant || !currentEvent) return 0;
    return data.invites.filter(
      (i) =>
        i.eventId === currentEvent.id &&
        i.toParticipantId === currentParticipant.id &&
        i.status === 'pending'
    ).length;
  }, [currentEvent, currentParticipant, data.invites]);

  const unreadNotificationCount = useMemo(() => {
    if (!currentParticipant || !currentEvent) return 0;
    return data.notifications.filter(
      (n) =>
        n.eventId === currentEvent.id &&
        n.participantId === currentParticipant.id &&
        !n.readAt
    ).length;
  }, [currentEvent, currentParticipant, data.notifications]);

  const value = useMemo<AppContextValue>(
    () => ({
      ready,
      configured: isSupabaseConfigured,
      data,
      session,
      currentAccount,
      currentTenant,
      currentParticipant,
      currentEvent,
      canManageCurrentEvent,
      canOrganizeCurrentEvent,
      refresh,
      signUpMember,
      signInMember,
      signOut,
      leaveEvent,
      updateProfile,
      loadDemo,
      createEvent,
      addParticipant,
      updateParticipantRole,
      removeParticipant,
      findEventByCode,
      listJoinParticipants,
      joinAsGuest,
      enterEventAsHost,
      addActivity,
      toggleBooking,
      addAnnouncement,
      setChatMode,
      sendMessage,
      ensureGroupConversation,
      sendChatInvite,
      sendChatInviteByCode,
      respondToInvite,
      getOrCreateDirectConversation,
      createGroupChat,
      markConversationRead,
      markNotificationRead,
      reloadEventPeople,
      bookingsForActivity: (activityId) => data.bookings.filter((b) => b.activityId === activityId),
      participantsForEvent: (eventId) => {
        const id = Array.isArray(eventId) ? eventId[0] : eventId;
        return data.participants
          .filter((p) => p.eventId === id)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
      },
      activitiesForEvent: (eventId) => {
        const id = Array.isArray(eventId) ? eventId[0] : eventId;
        return data.activities
          .filter((a) => a.eventId === id)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
      },
      announcementsForEvent: (eventId) => {
        const id = Array.isArray(eventId) ? eventId[0] : eventId;
        return data.announcements
          .filter((a) => a.eventId === id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      },
      eventsForHost: (hostId) =>
        data.events
          .filter((e) => e.hostId === hostId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      unreadMessageCount,
      unreadInviteCount,
      unreadNotificationCount,
      conversationUnreadCount,
    }),
    [
      ready,
      data,
      session,
      currentAccount,
      currentTenant,
      currentParticipant,
      currentEvent,
      canManageCurrentEvent,
      canOrganizeCurrentEvent,
      refresh,
      signUpMember,
      signInMember,
      signOut,
      leaveEvent,
      updateProfile,
      loadDemo,
      createEvent,
      addParticipant,
      updateParticipantRole,
      removeParticipant,
      findEventByCode,
      listJoinParticipants,
      joinAsGuest,
      enterEventAsHost,
      addActivity,
      toggleBooking,
      addAnnouncement,
      setChatMode,
      sendMessage,
      ensureGroupConversation,
      sendChatInvite,
      sendChatInviteByCode,
      respondToInvite,
      getOrCreateDirectConversation,
      createGroupChat,
      markConversationRead,
      markNotificationRead,
      reloadEventPeople,
      unreadMessageCount,
      unreadInviteCount,
      unreadNotificationCount,
      conversationUnreadCount,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
