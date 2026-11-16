import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, EmptyState, Field } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { Conversation, Participant } from '@/lib/types';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

type ChatRow =
  | { kind: 'conversation'; conversation: Conversation; title: string; subtitle: string; unread: number }
  | { kind: 'person'; person: Participant };

export default function ChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const {
    currentEvent,
    currentParticipant,
    data,
    participantsForEvent,
    canOrganizeCurrentEvent,
    getOrCreateDirectConversation,
    conversationUnreadCount,
    unreadInviteCount,
    reloadEventPeople,
  } = useApp();

  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) return;
    reloadEventPeople(eventId).catch(() => undefined);
  }, [eventId, reloadEventPeople]);

  const mode = currentEvent?.chatMode ?? 'off';
  const me = currentParticipant;
  const people = participantsForEvent(eventId);

  const connectedIds = useMemo(() => {
    if (!me) return new Set<string>();
    const set = new Set<string>();
    for (const invite of data.invites) {
      if (invite.eventId !== eventId || invite.status !== 'accepted') continue;
      if (invite.fromParticipantId === me.id) set.add(invite.toParticipantId);
      if (invite.toParticipantId === me.id) set.add(invite.fromParticipantId);
    }
    return set;
  }, [data.invites, eventId, me]);

  const myConversations = useMemo(() => {
    if (!me) return [];
    return data.conversations.filter(
      (c) => c.eventId === eventId && c.participantIds.includes(me.id)
    );
  }, [data.conversations, eventId, me]);

  const rows = useMemo(() => {
    if (!me) return [] as ChatRow[];
    const q = search.trim().toLowerCase();
    const result: ChatRow[] = [];
    const peopleInDm = new Set<string>();

    const sortedConversations = [...myConversations].sort((a, b) => {
      const lastA = data.messages
        .filter((m) => m.conversationId === a.id)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      const lastB = data.messages
        .filter((m) => m.conversationId === b.id)
        .sort((x, y) => y.createdAt.localeCompare(x.createdAt))[0];
      return (lastB?.createdAt ?? b.createdAt).localeCompare(lastA?.createdAt ?? a.createdAt);
    });

    for (const conversation of sortedConversations) {
      let title = conversation.title ?? 'Group';
      let other: Participant | undefined;
      if (!conversation.isGroup) {
        const otherId = conversation.participantIds.find((id) => id !== me.id);
        other = people.find((p) => p.id === otherId);
        if (otherId) peopleInDm.add(otherId);
        title = other?.displayName ?? 'Chat';
      }
      const last = data.messages
        .filter((m) => m.conversationId === conversation.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      const subtitle = last
        ? `${last.body.slice(0, 42)}${last.body.length > 42 ? '…' : ''}`
        : conversation.isGroup
          ? 'Group chat'
          : 'Tap to message';
      if (q && !title.toLowerCase().includes(q) && !subtitle.toLowerCase().includes(q)) continue;
      result.push({
        kind: 'conversation',
        conversation,
        title,
        subtitle,
        unread: conversationUnreadCount(conversation.id),
      });
    }

    const visiblePeople = people.filter((p) => {
      if (p.id === me.id) return false;
      if (peopleInDm.has(p.id)) return false;
      if (mode === 'private' && !connectedIds.has(p.id)) return false;
      if (q && !p.displayName.toLowerCase().includes(q) && !p.chatId.includes(q)) return false;
      return true;
    });

    for (const person of visiblePeople) {
      result.push({ kind: 'person', person });
    }

    return result;
  }, [
    connectedIds,
    conversationUnreadCount,
    data.messages,
    me,
    mode,
    myConversations,
    people,
    search,
  ]);

  if (mode === 'off') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.mist }]}>
        <EmptyState title="Chat is off" body="The host has disabled chat for this event." />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.mist }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.oceanDeep }]}>Chat</Text>
          <Text style={[styles.sub, { color: colors.inkSoft }]}>
            {mode === 'open'
              ? 'Message anyone, or open a group you are in.'
              : `Private · your ID ${me?.chatId ?? '—'}. Add people to chat.`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {canOrganizeCurrentEvent ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/event/[eventId]/new-group', params: { eventId } })
              }
              style={[styles.iconBtn, { backgroundColor: colors.ocean }]}>
              <Ionicons name="people" size={18} color="#fff" />
            </Pressable>
          ) : null}
          {mode === 'private' ? (
            <Pressable
              onPress={() =>
                router.push({ pathname: '/event/[eventId]/contacts', params: { eventId } })
              }
              style={[styles.iconBtn, { backgroundColor: colors.coral }]}>
              <Ionicons name="person-add" size={18} color="#fff" />
              {unreadInviteCount > 0 ? <View style={styles.dot} /> : null}
            </Pressable>
          ) : null}
        </View>
      </View>

      <Field value={search} onChangeText={setSearch} placeholder="Search chats or people" />
      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <ScrollView contentContainerStyle={styles.scroll}>
        {people.length <= 1 && mode === 'open' ? (
          <EmptyState
            title="No people yet"
            body="Add participants from Manage (People & roles). They show here even before they join."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title={mode === 'private' ? 'No contacts yet' : 'No chats yet'}
            body={
              mode === 'private'
                ? 'Tap the add-user icon, enter a chat ID, and wait for them to accept.'
                : 'Search for someone and tap to start a 1:1 chat.'
            }
          />
        ) : (
          rows.map((row) => {
            if (row.kind === 'conversation') {
              const { conversation, title, subtitle, unread } = row;
              return (
                <Pressable
                  key={conversation.id}
                  onPress={() =>
                    router.push({
                      pathname: '/event/[eventId]/conversation/[conversationId]',
                      params: { eventId, conversationId: conversation.id },
                    })
                  }
                  style={[styles.rowCard, { backgroundColor: colors.white, borderColor: colors.line }]}>
                  <Avatar name={title} size={46} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]}>{title}</Text>
                    <Text style={[styles.rowSub, { color: colors.inkSoft }]} numberOfLines={1}>
                      {subtitle}
                    </Text>
                  </View>
                  {unread > 0 ? (
                    <View style={[styles.badge, { backgroundColor: colors.coral }]}>
                      <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
                    </View>
                  ) : null}
                </Pressable>
              );
            }

            const { person } = row;
            return (
              <Pressable
                key={person.id}
                disabled={busyId === person.id}
                onPress={async () => {
                  try {
                    setError(null);
                    setBusyId(person.id);
                    const id = await getOrCreateDirectConversation(person.id);
                    router.push({
                      pathname: '/event/[eventId]/conversation/[conversationId]',
                      params: { eventId, conversationId: id },
                    });
                  } catch (e) {
                    setError(e instanceof Error ? e.message : 'Could not open chat');
                  } finally {
                    setBusyId(null);
                  }
                }}
                style={[styles.rowCard, { backgroundColor: colors.white, borderColor: colors.line }]}>
                <Avatar name={person.displayName} uri={person.avatarUri} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]}>{person.displayName}</Text>
                  <Text style={[styles.rowSub, { color: colors.inkSoft }]}>
                    {person.role} · tap to message
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.inkSoft} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: 56 },
  centered: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  title: { fontFamily: fonts.displayMedium, fontSize: 30 },
  sub: { fontFamily: fonts.body, marginTop: 4, marginBottom: spacing.sm },
  headerActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#E11D48',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  scroll: { paddingBottom: 40, paddingTop: spacing.sm },
  rowCard: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowTitle: { fontFamily: fonts.bodyBold, fontSize: 16 },
  rowSub: { fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: '#fff', fontFamily: fonts.bodyBold, fontSize: 11 },
  error: { fontFamily: fonts.body, marginBottom: spacing.sm },
});
