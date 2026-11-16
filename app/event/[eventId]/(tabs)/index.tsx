import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function EventHomeScreen() {
  const eventId = useEventId();
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const {
    currentEvent,
    currentParticipant,
    activitiesForEvent,
    announcementsForEvent,
    bookingsForActivity,
    leaveEvent,
  } = useApp();

  const activities = activitiesForEvent(eventId).slice(0, 3);
  const news = announcementsForEvent(eventId).slice(0, 2);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Text style={[styles.kicker, { color: colors.aqua }]}>{currentEvent?.name}</Text>
      <Text style={[styles.hello, { color: colors.oceanDeep }]}>
        Hey, {currentParticipant?.displayName}
      </Text>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>Here is what is happening today.</Text>

      <View style={styles.themeRow}>
        <Chip label="Light" active={mode === 'light'} onPress={() => setMode('light')} />
        <Chip label="Dark" active={mode === 'dark'} onPress={() => setMode('dark')} />
      </View>

      <Text style={[styles.section, { color: colors.ink }]}>Up next</Text>
      {activities.length === 0 ? (
        <Text style={[styles.empty, { color: colors.inkSoft }]}>No activities yet. Check back soon.</Text>
      ) : (
        activities.map((activity) => {
          const going = bookingsForActivity(activity.id).length;
          return (
            <Pressable
              key={activity.id}
              style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}
              onPress={() => router.push(`/event/${eventId}/calendar`)}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{activity.title}</Text>
              <Text style={[styles.cardMeta, { color: colors.inkSoft }]}>
                {format(new Date(activity.startsAt), 'EEE · h:mm a')} · {activity.location}
              </Text>
              <Text style={[styles.cardGoing, { color: colors.coral }]}>{going} going</Text>
            </Pressable>
          );
        })
      )}

      <Text style={[styles.section, { color: colors.ink }]}>Announcements</Text>
      {news.length === 0 ? (
        <Text style={[styles.empty, { color: colors.inkSoft }]}>No news yet.</Text>
      ) : (
        news.map((item) => (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{item.title}</Text>
            <Text style={[styles.cardBody, { color: colors.inkSoft }]}>{item.body}</Text>
          </View>
        ))
      )}

      <Pressable
        onPress={async () => {
          const dest = await leaveEvent();
          router.replace(dest === 'member' ? '/member' : '/');
        }}>
        <Text style={[styles.leave, { color: colors.inkSoft }]}>Leave event</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  kicker: {
    fontFamily: fonts.bodyMedium,
    marginBottom: spacing.xs,
  },
  hello: {
    fontFamily: fonts.display,
    fontSize: 34,
    letterSpacing: -0.8,
  },
  sub: {
    marginTop: spacing.xs,
    marginBottom: spacing.md,
    fontFamily: fonts.body,
  },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm },
  section: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  empty: {
    fontFamily: fonts.body,
    marginBottom: spacing.md,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 17,
  },
  cardMeta: {
    marginTop: 4,
    fontFamily: fonts.body,
  },
  cardGoing: {
    marginTop: spacing.sm,
    fontFamily: fonts.bodyMedium,
  },
  cardBody: {
    marginTop: 6,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  leave: {
    marginTop: spacing.xl,
    textAlign: 'center',
    fontFamily: fonts.bodyMedium,
  },
});
