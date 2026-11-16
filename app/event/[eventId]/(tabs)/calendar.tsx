import {
  addDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isWithinInterval,
  startOfDay,
} from 'date-fns';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, EmptyState, ModalSheet } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function CalendarScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const {
    currentEvent,
    activitiesForEvent,
    bookingsForActivity,
    participantsForEvent,
    currentParticipant,
    toggleBooking,
    canOrganizeCurrentEvent,
  } = useApp();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const rangeStart = startOfDay(new Date(currentEvent?.startsAt ?? Date.now()));
  const rangeEnd = startOfDay(new Date(currentEvent?.endsAt ?? Date.now()));
  const [selectedDay, setSelectedDay] = useState(() => {
    const today = startOfDay(new Date());
    if (isWithinInterval(today, { start: rangeStart, end: rangeEnd })) return today;
    return rangeStart;
  });

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart.getTime(), rangeEnd.getTime()]
  );

  const activities = activitiesForEvent(eventId).filter((activity) =>
    isSameDay(new Date(activity.startsAt), selectedDay)
  );
  const participants = participantsForEvent(eventId);

  const canGoPrev = selectedDay > rangeStart;
  const canGoNext = selectedDay < rangeEnd;

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.oceanDeep }]}>Calendar</Text>
        {canOrganizeCurrentEvent ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/event/[eventId]/add-activity', params: { eventId } })
            }>
            <Text style={[styles.addLink, { color: colors.coral }]}>+ Add activity</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.dayNav}>
        <Pressable
          disabled={!canGoPrev}
          onPress={() => setSelectedDay((d) => addDays(d, -1))}
          style={[
            styles.navBtn,
            {
              backgroundColor: canGoPrev ? colors.ocean : colors.white,
              borderColor: colors.ocean,
              opacity: canGoPrev ? 1 : 0.4,
            },
          ]}>
          <Ionicons name="chevron-back" size={22} color={canGoPrev ? '#fff' : colors.inkSoft} />
        </Pressable>

        <View style={styles.dayCenter}>
          <Text style={[styles.dayLabel, { color: colors.ink }]}>
            {format(selectedDay, 'EEEE')}
          </Text>
          <Text style={[styles.dayDate, { color: colors.aqua }]}>
            {format(selectedDay, 'MMM d, yyyy')}
          </Text>
        </View>

        <Pressable
          onPress={() => setPickerOpen(true)}
          style={[styles.navBtn, { borderColor: colors.line, backgroundColor: colors.white }]}>
          <Ionicons name="calendar" size={20} color={colors.ink} />
        </Pressable>

        <Pressable
          disabled={!canGoNext}
          onPress={() => setSelectedDay((d) => addDays(d, 1))}
          style={[
            styles.navBtn,
            {
              backgroundColor: canGoNext ? colors.ocean : colors.white,
              borderColor: colors.ocean,
              opacity: canGoNext ? 1 : 0.4,
            },
          ]}>
          <Ionicons name="chevron-forward" size={22} color={canGoNext ? '#fff' : colors.inkSoft} />
        </Pressable>
      </View>

      <Text style={[styles.sub, { color: colors.inkSoft }]}>
        {activities.length === 0
          ? 'No activities on this day.'
          : `${activities.length} activit${activities.length === 1 ? 'y' : 'ies'} today`}
      </Text>

      {activities.length === 0 ? (
        <EmptyState
          title="Nothing on this day"
          body="Swipe days with the arrows, or tap the calendar to jump to another date."
        />
      ) : (
        activities.map((activity) => {
          const bookings = bookingsForActivity(activity.id);
          const mine = bookings.some((b) => b.participantId === currentParticipant?.id);
          const names = bookings
            .map((b) => participants.find((p) => p.id === b.participantId)?.displayName)
            .filter(Boolean);

          return (
            <View
              key={activity.id}
              style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
              <Text style={[styles.cardTitle, { color: colors.ink }]}>{activity.title}</Text>
              <Text style={[styles.meta, { color: colors.inkSoft }]}>
                {format(new Date(activity.startsAt), 'h:mm a')}
                {' – '}
                {format(new Date(activity.endsAt), 'h:mm a')}
              </Text>
              <Text style={[styles.meta, { color: colors.inkSoft }]}>{activity.location}</Text>
              {activity.description ? (
                <Text style={[styles.body, { color: colors.ink }]}>{activity.description}</Text>
              ) : null}
              <Text style={[styles.going, { color: colors.coral }]}>
                {bookings.length}
                {activity.capacity != null ? ` / ${activity.capacity}` : ''} going
                {names.length ? `: ${names.join(', ')}` : ''}
              </Text>
              <Button
                label={mine ? 'Cancel booking' : 'Book this'}
                variant={mine ? 'secondary' : 'primary'}
                loading={busyId === activity.id}
                onPress={async () => {
                  try {
                    setBusyId(activity.id);
                    await toggleBooking(activity.id);
                  } catch (e) {
                    Alert.alert('Booking', e instanceof Error ? e.message : 'Could not update booking');
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            </View>
          );
        })
      )}

      <ModalSheet visible={pickerOpen} title="Pick a day" onClose={() => setPickerOpen(false)}>
        <ScrollView style={{ maxHeight: 360 }}>
          {days.map((day) => {
            const active = isSameDay(day, selectedDay);
            return (
              <Pressable
                key={day.toISOString()}
                onPress={() => {
                  setSelectedDay(day);
                  setPickerOpen(false);
                }}
                style={[
                  styles.pickRow,
                  {
                    backgroundColor: active ? colors.ocean : colors.white,
                    borderColor: colors.line,
                  },
                ]}>
                <Text style={{ color: active ? '#fff' : colors.ink, fontFamily: fonts.bodyBold }}>
                  {format(day, 'EEE, MMM d')}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </ModalSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    fontFamily: fonts.displayMedium,
    fontSize: 30,
  },
  addLink: { fontFamily: fonts.bodyBold, fontSize: 15 },
  dayNav: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  navBtn: {
    width: 46,
    height: 46,
    borderRadius: radii.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCenter: { flex: 1, alignItems: 'center' },
  dayLabel: { fontFamily: fonts.bodyBold, fontSize: 16 },
  dayDate: { fontFamily: fonts.bodyMedium, marginTop: 2 },
  sub: {
    fontFamily: fonts.body,
    marginVertical: spacing.md,
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  meta: {
    marginTop: 4,
    fontFamily: fonts.body,
  },
  body: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  going: {
    marginTop: spacing.sm,
    fontFamily: fonts.bodyMedium,
  },
  pickRow: {
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
});
