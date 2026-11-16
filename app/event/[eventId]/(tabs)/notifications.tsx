import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const { currentParticipant, data, markNotificationRead } = useApp();

  const items = useMemo(
    () =>
      data.notifications
        .filter(
          (n) => n.eventId === eventId && n.participantId === currentParticipant?.id
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [currentParticipant?.id, data.notifications, eventId]
  );

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: colors.oceanDeep }]}>Notifications</Text>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>
        Messages, invites, news, and new activities.
      </Text>

      {items.length === 0 ? (
        <EmptyState title="All caught up" body="New activity will show up here." />
      ) : (
        items.map((item) => {
          const unread = !item.readAt;
          return (
            <Pressable
              key={item.id}
              onPress={async () => {
                if (unread) await markNotificationRead(item.id).catch(() => undefined);
                if (item.kind === 'message' && item.refId) {
                  router.push(`/event/${eventId}/conversation/${item.refId}`);
                } else if (item.kind === 'invite') {
                  router.push(`/event/${eventId}/contacts`);
                } else if (item.kind === 'group_add' && item.refId) {
                  router.push(`/event/${eventId}/conversation/${item.refId}`);
                } else if (item.kind === 'news') {
                  router.push(`/event/${eventId}/news`);
                } else if (item.kind === 'activity') {
                  router.push(`/event/${eventId}/calendar`);
                }
              }}
              style={[
                styles.card,
                {
                  backgroundColor: unread ? colors.white : colors.mist,
                  borderColor: colors.line,
                },
              ]}>
              <View style={styles.row}>
                <Text style={[styles.cardTitle, { color: colors.ink }]}>{item.title}</Text>
                {unread ? <View style={[styles.dot, { backgroundColor: colors.coral }]} /> : null}
              </View>
              {item.body ? (
                <Text style={[styles.body, { color: colors.inkSoft }]}>{item.body}</Text>
              ) : null}
              <Text style={[styles.meta, { color: colors.inkSoft }]}>
                {format(new Date(item.createdAt), 'MMM d · h:mm a')}
              </Text>
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  title: { fontFamily: fonts.displayMedium, fontSize: 30 },
  sub: { fontFamily: fonts.body, marginBottom: spacing.lg },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 16, flex: 1 },
  body: { marginTop: 4, fontFamily: fonts.body },
  meta: { marginTop: 6, fontFamily: fonts.body, fontSize: 12 },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
