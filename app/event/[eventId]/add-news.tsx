import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function AddNewsScreen() {
  const eventId = useEventId();
  const router = useRouter();
  const { colors } = useTheme();
  const { canOrganizeCurrentEvent, addAnnouncement, currentEvent } = useApp();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!canOrganizeCurrentEvent) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.mist }]}
        contentContainerStyle={styles.scroll}>
        <Title>Post announcement</Title>
        <Text style={[styles.hint, { color: colors.inkSoft }]}>
          Only admins, hosts, and organizers can post news.
        </Text>
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>Post announcement</Title>
      <Text style={[styles.hint, { color: colors.inkSoft }]}>
        {currentEvent?.name
          ? `Share news with everyone in ${currentEvent.name}`
          : 'Share news with everyone in the event.'}
      </Text>
      <Label>Title</Label>
      <Field value={title} onChangeText={setTitle} placeholder="Dinner update" />
      <Label>Message</Label>
      <Field multiline value={body} onChangeText={setBody} placeholder="Share news with everyone" />
      <ErrorText>{error}</ErrorText>
      <Button
        label="Publish"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            setError(null);
            if (!title.trim() || !body.trim()) throw new Error('Title and message required.');
            await addAnnouncement({ eventId, title, body });
            router.replace(`/event/${eventId}/news`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not post news');
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
