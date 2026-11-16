import { format } from 'date-fns';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, EmptyState } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function PeopleScreen() {
  const { colors } = useTheme();
  const eventId = useEventId();
  const { activitiesForEvent, bookingsForActivity, participantsForEvent } = useApp();

  const activities = activitiesForEvent(eventId);
  const participants = participantsForEvent(eventId);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Text style={[styles.title, { color: colors.oceanDeep }]}>Who’s going</Text>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>See who booked each activity.</Text>

      <Text style={[styles.section, { color: colors.ink }]}>Everyone</Text>
      {participants.map((p) => (
        <View key={p.id} style={styles.personRow}>
          <Avatar name={p.displayName} uri={p.avatarUri} size={36} />
          <View>
            <Text style={[styles.person, { color: colors.oceanDeep }]}>{p.displayName}</Text>
            <Text style={[styles.role, { color: colors.inkSoft }]}>{p.role}</Text>
          </View>
        </View>
      ))}

      {activities.length === 0 ? (
        <EmptyState title="No activities yet" body="Once activities are added, bookings show up here." />
      ) : (
        activities.map((activity) => {
          const bookings = bookingsForActivity(activity.id);
          const names = bookings
            .map((b) => participants.find((p) => p.id === b.participantId)?.displayName ?? 'Guest')
            .sort();

          return (
            <View
              key={activity.id}
              style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{activity.title}</Text>
              <Text style={[styles.meta, { color: colors.inkSoft }]}>
                {format(new Date(activity.startsAt), 'EEE · h:mm a')}
              </Text>
              {names.length === 0 ? (
                <Text style={[styles.empty, { color: colors.inkSoft }]}>Nobody booked yet</Text>
              ) : (
                names.map((name) => (
                  <Text key={name} style={[styles.person, { color: colors.oceanDeep }]}>
                    {name}
                  </Text>
                ))
              )}
            </View>
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
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 17 },
  meta: { marginTop: 4, marginBottom: spacing.sm, fontFamily: fonts.body },
  empty: { fontFamily: fonts.body },
  section: { fontFamily: fonts.bodyBold, fontSize: 18, marginBottom: spacing.sm },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  person: { fontFamily: fonts.bodyMedium },
  role: { fontFamily: fonts.body, fontSize: 12, textTransform: 'capitalize' },
});
