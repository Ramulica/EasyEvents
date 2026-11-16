import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, EmptyState, ErrorText, Field, Label } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

type Tab = 'add' | 'requests' | 'incoming';

export default function ContactsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const {
    currentEvent,
    currentParticipant,
    data,
    participantsForEvent,
    sendChatInviteByCode,
    respondToInvite,
  } = useApp();

  const [tab, setTab] = useState<Tab>('incoming');
  const [chatId, setChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = participantsForEvent(eventId);
  const me = currentParticipant;

  const outgoing = useMemo(
    () =>
      data.invites.filter(
        (i) =>
          i.eventId === eventId &&
          i.fromParticipantId === me?.id &&
          i.status === 'pending'
      ),
    [data.invites, eventId, me?.id]
  );

  const incoming = useMemo(
    () =>
      data.invites.filter(
        (i) =>
          i.eventId === eventId &&
          i.toParticipantId === me?.id &&
          i.status === 'pending'
      ),
    [data.invites, eventId, me?.id]
  );

  if (!currentEvent || currentEvent.chatMode !== 'private') {
    return <Redirect href={`/event/${eventId}/chat`} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.mist }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.line, backgroundColor: colors.white }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]}>Add users</Text>
        {incoming.length > 0 ? (
          <View style={[styles.dot, { backgroundColor: colors.coral }]} />
        ) : (
          <View style={{ width: 10 }} />
        )}
      </View>

      <View style={styles.tabs}>
        {(
          [
            ['incoming', 'Applications'],
            ['requests', 'Requests'],
            ['add', 'Add'],
          ] as [Tab, string][]
        ).map(([id, label]) => {
          const active = tab === id;
          const count = id === 'incoming' ? incoming.length : id === 'requests' ? outgoing.length : 0;
          return (
            <Pressable
              key={id}
              onPress={() => setTab(id)}
              style={[
                styles.tab,
                {
                  backgroundColor: active ? colors.ocean : colors.white,
                  borderColor: colors.line,
                },
              ]}>
              <Text style={{ color: active ? '#fff' : colors.ink, fontFamily: fonts.bodyBold }}>
                {label}
                {count ? ` (${count})` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {tab === 'add' ? (
          <View>
            <Text style={[styles.hint, { color: colors.inkSoft }]}>
              Your chat ID is {me?.chatId}. Ask someone for theirs, then invite them.
            </Text>
            <Label>Their chat ID</Label>
            <Field value={chatId} onChangeText={setChatId} placeholder="e.g. 587835" />
            <ErrorText>{error}</ErrorText>
            <Button
              label="Send invite"
              loading={loading}
              onPress={async () => {
                try {
                  setLoading(true);
                  setError(null);
                  if (!chatId.trim()) throw new Error('Enter a chat ID');
                  await sendChatInviteByCode(chatId.trim());
                  setChatId('');
                  setTab('requests');
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Could not invite');
                } finally {
                  setLoading(false);
                }
              }}
            />
          </View>
        ) : null}

        {tab === 'requests' ? (
          outgoing.length === 0 ? (
            <EmptyState title="No pending requests" body="Invites you sent will show here until accepted." />
          ) : (
            outgoing.map((invite) => {
              const person = people.find((p) => p.id === invite.toParticipantId);
              return (
                <View
                  key={invite.id}
                  style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
                  <Avatar name={person?.displayName ?? '?'} uri={person?.avatarUri} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.ink }]}>
                      {person?.displayName ?? 'Unknown'}
                    </Text>
                    <Text style={{ color: colors.inkSoft, fontFamily: fonts.body }}>Waiting…</Text>
                  </View>
                </View>
              );
            })
          )
        ) : null}

        {tab === 'incoming' ? (
          incoming.length === 0 ? (
            <EmptyState
              title="No applications"
              body="When someone invites you with your chat ID, they appear here."
            />
          ) : (
            incoming.map((invite) => {
              const person = people.find((p) => p.id === invite.fromParticipantId);
              return (
                <View
                  key={invite.id}
                  style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
                  <Avatar name={person?.displayName ?? '?'} uri={person?.avatarUri} size={40} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.ink }]}>
                      {person?.displayName ?? 'Unknown'}
                    </Text>
                    <Text style={{ color: colors.inkSoft, fontFamily: fonts.body }}>
                      wants to chat · ID {person?.chatId}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => respondToInvite(invite.id, true)}
                    style={[styles.accept, { backgroundColor: colors.ocean }]}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={() => respondToInvite(invite.id, false)}
                    style={[styles.decline, { borderColor: colors.danger }]}>
                    <Ionicons name="close" size={18} color={colors.danger} />
                  </Pressable>
                </View>
              );
            })
          )
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    paddingTop: 52,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backBtn: { padding: 4 },
  title: { fontFamily: fonts.bodyBold, fontSize: 18, flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: spacing.md,
  },
  tab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radii.md,
    paddingVertical: 10,
    alignItems: 'center',
  },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  hint: { fontFamily: fonts.body, marginBottom: spacing.md, lineHeight: 20 },
  card: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { fontFamily: fonts.bodyBold },
  accept: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decline: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
