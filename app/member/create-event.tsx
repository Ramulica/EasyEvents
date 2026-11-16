import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, Chip, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import type { ChatMode } from '@/lib/types';
import { fonts, spacing } from '@/lib/theme';

const chatModes: { id: ChatMode; label: string; hint: string }[] = [
  { id: 'open', label: 'Allowed', hint: 'Everyone can message everyone' },
  { id: 'private', label: 'Private', hint: 'Invite by chat ID, then accept' },
  { id: 'off', label: 'Not allowed', hint: 'Chat is disabled' },
];

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string, endOfDay = false) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(
    year,
    month - 1,
    day,
    endOfDay ? 23 : 9,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export default function CreateEventScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, currentAccount, createEvent } = useApp();
  const today = useMemo(() => new Date(), []);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [startsOn, setStartsOn] = useState(toDateInputValue(today));
  const [endsOn, setEndsOn] = useState(
    toDateInputValue(new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000))
  );
  const [chatMode, setChatMode] = useState<ChatMode>('open');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session || session.kind !== 'member' || !currentAccount) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>Create event</Title>
      <Label>Event name</Label>
      <Field value={name} onChangeText={setName} placeholder="Summer Trail Camp" />
      <Label>Description</Label>
      <Field
        multiline
        value={description}
        onChangeText={setDescription}
        placeholder="What is this event about?"
      />
      <Label>Start date</Label>
      <Field value={startsOn} onChangeText={setStartsOn} placeholder="YYYY-MM-DD" />
      <Label>End date</Label>
      <Field value={endsOn} onChangeText={setEndsOn} placeholder="YYYY-MM-DD" />
      <Label>Event password (optional)</Label>
      <Field
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        placeholder="Leave blank for open entry"
      />

      <Label>Chat</Label>
      <View style={styles.row}>
        {chatModes.map((mode) => (
          <Chip
            key={mode.id}
            label={mode.label}
            active={chatMode === mode.id}
            onPress={() => setChatMode(mode.id)}
          />
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.inkSoft }]}>
        {chatModes.find((m) => m.id === chatMode)?.hint}
      </Text>

      <ErrorText>{error}</ErrorText>
      <Button
        label="Create event"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            setError(null);
            if (!name.trim()) throw new Error('Give your event a name.');
            const starts = parseDateInput(startsOn, false);
            const ends = parseDateInput(endsOn, true);
            if (!starts || !ends) throw new Error('Use dates like 2026-11-09.');
            if (ends < starts) throw new Error('End date must be after the start date.');
            const event = await createEvent({
              name,
              description,
              password: password || undefined,
              chatMode,
              startsAt: starts.toISOString(),
              endsAt: ends.toISOString(),
            });
            router.replace(`/member/event/${event.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not create event');
          } finally {
            setLoading(false);
          }
        }}
      />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
  hint: {
    fontFamily: fonts.body,
    marginBottom: spacing.sm,
  },
});
