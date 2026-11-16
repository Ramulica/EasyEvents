import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

function toLocalInput(date: Date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  const hh = `${date.getHours()}`.padStart(2, '0');
  const mm = `${date.getMinutes()}`.padStart(2, '0');
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function parseLocalInput(value: string) {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0,
    0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function AddActivityScreen() {
  const eventId = useEventId();
  const router = useRouter();
  const { colors } = useTheme();
  const { canOrganizeCurrentEvent, addActivity, currentEvent } = useApp();

  const defaults = useMemo(() => {
    const start = new Date();
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() + 1);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    return { start, end };
  }, []);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState('');
  const [startsAt, setStartsAt] = useState(toLocalInput(defaults.start));
  const [endsAt, setEndsAt] = useState(toLocalInput(defaults.end));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!canOrganizeCurrentEvent) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.mist }]}
        contentContainerStyle={styles.scroll}>
        <Title>Add activity</Title>
        <Text style={[styles.hint, { color: colors.inkSoft }]}>
          Only admins, hosts, and organizers can add activities.
        </Text>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>Add activity</Title>
      <Text style={[styles.hint, { color: colors.inkSoft }]}>
        {currentEvent?.name ? `For ${currentEvent.name}` : 'Create a calendar item people can book.'}
      </Text>

      <Label>Title</Label>
      <Field value={title} onChangeText={setTitle} placeholder="Kayak Adventure" />
      <Label>Location</Label>
      <Field value={location} onChangeText={setLocation} placeholder="Boat Dock" />
      <Label>Description</Label>
      <Field
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="What happens here?"
      />
      <Label>Starts (YYYY-MM-DD HH:mm)</Label>
      <Field value={startsAt} onChangeText={setStartsAt} placeholder="2026-11-09 10:00" />
      <Label>Ends (YYYY-MM-DD HH:mm)</Label>
      <Field value={endsAt} onChangeText={setEndsAt} placeholder="2026-11-09 11:00" />
      <Label>Capacity (optional)</Label>
      <Field keyboardType="number-pad" value={capacity} onChangeText={setCapacity} placeholder="12" />
      <ErrorText>{error}</ErrorText>
      <Button
        label="Publish activity"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            setError(null);
            if (!title.trim()) throw new Error('Activity needs a title.');
            const starts = parseLocalInput(startsAt);
            const ends = parseLocalInput(endsAt);
            if (!starts || !ends) throw new Error('Use times like 2026-11-09 10:00');
            if (ends <= starts) throw new Error('End time must be after start time.');
            await addActivity({
              eventId,
              title,
              description,
              location: location || 'TBA',
              startsAt: starts.toISOString(),
              endsAt: ends.toISOString(),
              capacity: capacity ? Number(capacity) : null,
            });
            router.replace(`/event/${eventId}/calendar`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not add activity');
          } finally {
            setLoading(false);
          }
        }}
      />
      <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  hint: { fontFamily: fonts.body, marginBottom: spacing.md },
});
