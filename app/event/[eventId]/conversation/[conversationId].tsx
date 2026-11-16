import { format } from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Button, Field } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { paramId } from '@/lib/routeParams';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function ConversationScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const raw = useLocalSearchParams<{ conversationId: string }>();
  const eventId = useEventId();
  const conversationId = paramId(raw.conversationId);
  const {
    currentParticipant,
    data,
    participantsForEvent,
    sendMessage,
    markConversationRead,
    refresh,
  } = useApp();

  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(true);

  const conversation = data.conversations.find((c) => c.id === conversationId);
  const people = participantsForEvent(eventId);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!conversation) await refresh();
      } finally {
        if (!cancelled) setWaiting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation, refresh]);

  const title = useMemo(() => {
    if (!conversation || !currentParticipant) return 'Chat';
    if (conversation.isGroup) return conversation.title || 'Group';
    const otherId = conversation.participantIds.find((id) => id !== currentParticipant.id);
    return people.find((p) => p.id === otherId)?.displayName ?? 'Chat';
  }, [conversation, currentParticipant, people]);

  const messages = useMemo(
    () =>
      data.messages
        .filter((m) => m.conversationId === conversationId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [conversationId, data.messages]
  );

  useEffect(() => {
    if (!conversationId || !conversation) return;
    markConversationRead(conversationId).catch(() => undefined);
  }, [conversation, conversationId, markConversationRead, messages.length]);

  if (waiting && !conversation) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.mist }]}>
        <ActivityIndicator color={colors.ocean} size="large" />
      </View>
    );
  }

  if (!conversation || !currentParticipant) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.mist }]}>
        <Text style={{ color: colors.ink, fontFamily: fonts.bodyBold, marginBottom: 12 }}>
          Could not open this chat
        </Text>
        <Button label="Back to chats" onPress={() => router.replace(`/event/${eventId}/chat`)} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.mist }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={24}>
      <View style={[styles.topBar, { borderBottomColor: colors.line, backgroundColor: colors.white }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {messages.map((message) => {
          const mine = message.senderParticipantId === currentParticipant.id;
          const sender = people.find((p) => p.id === message.senderParticipantId);
          return (
            <View
              key={message.id}
              style={[styles.bubbleWrap, mine ? styles.mineWrap : styles.theirsWrap]}>
              {!mine && conversation.isGroup ? (
                <Text style={[styles.sender, { color: colors.aqua }]}>
                  {sender?.displayName ?? 'Someone'}
                </Text>
              ) : null}
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: mine ? colors.ocean : colors.white,
                    borderColor: colors.line,
                  },
                ]}>
                <Text style={{ color: mine ? '#fff' : colors.ink, fontFamily: fonts.body }}>
                  {message.body}
                </Text>
                <Text
                  style={{
                    color: mine ? 'rgba(255,255,255,0.7)' : colors.inkSoft,
                    fontFamily: fonts.body,
                    fontSize: 11,
                    marginTop: 4,
                    alignSelf: 'flex-end',
                  }}>
                  {format(new Date(message.createdAt), 'h:mm a')}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <View style={[styles.composer, { borderTopColor: colors.line, backgroundColor: colors.white }]}>
        <View style={{ flex: 1 }}>
          <Field value={draft} onChangeText={setDraft} placeholder="Message" />
        </View>
        <Button
          label="Send"
          loading={loading}
          onPress={async () => {
            try {
              if (!draft.trim()) return;
              setLoading(true);
              setError(null);
              await sendMessage(conversationId, draft.trim());
              setDraft('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not send');
            } finally {
              setLoading(false);
            }
          }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
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
  scroll: { padding: spacing.md, paddingBottom: 24 },
  bubbleWrap: { marginBottom: spacing.sm, maxWidth: '82%' },
  mineWrap: { alignSelf: 'flex-end' },
  theirsWrap: { alignSelf: 'flex-start' },
  sender: { fontFamily: fonts.bodyMedium, fontSize: 12, marginBottom: 2, marginLeft: 4 },
  bubble: {
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  composer: {
    borderTopWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  error: { fontFamily: fonts.body, paddingHorizontal: spacing.md, marginBottom: 4 },
});
