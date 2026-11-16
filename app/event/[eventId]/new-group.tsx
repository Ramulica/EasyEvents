import { Ionicons } from '@expo/vector-icons';
import { Redirect, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, ErrorText, Field, Label } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function NewGroupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const {
    canOrganizeCurrentEvent,
    currentParticipant,
    participantsForEvent,
    createGroupChat,
  } = useApp();

  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participantsForEvent(eventId).filter((p) => {
      if (p.id === currentParticipant?.id) return false;
      if (!q) return true;
      return p.displayName.toLowerCase().includes(q) || p.chatId.includes(q);
    });
  }, [currentParticipant?.id, eventId, participantsForEvent, search]);

  if (!canOrganizeCurrentEvent) {
    return <Redirect href={`/event/${eventId}/chat`} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.mist }]}>
      <View style={[styles.topBar, { borderBottomColor: colors.line, backgroundColor: colors.white }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={[styles.heading, { color: colors.ink }]}>New group</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Label>Group name</Label>
        <Field value={title} onChangeText={setTitle} placeholder="e.g. Cabin A" />
        <Label>Search people</Label>
        <Field value={search} onChangeText={setSearch} placeholder="Name or chat ID" />
        <Text style={[styles.meta, { color: colors.inkSoft }]}>
          {selected.length} selected
        </Text>

        {people.map((person) => {
          const active = selected.includes(person.id);
          return (
            <Pressable
              key={person.id}
              onPress={() =>
                setSelected((prev) =>
                  active ? prev.filter((id) => id !== person.id) : [...prev, person.id]
                )
              }
              style={[
                styles.row,
                {
                  backgroundColor: active ? colors.ocean : colors.white,
                  borderColor: colors.line,
                },
              ]}>
              <Avatar name={person.displayName} uri={person.avatarUri} size={40} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: active ? '#fff' : colors.ink, fontFamily: fonts.bodyBold }}>
                  {person.displayName}
                </Text>
                <Text style={{ color: active ? 'rgba(255,255,255,0.8)' : colors.inkSoft }}>
                  {person.role}
                </Text>
              </View>
              {active ? <Ionicons name="checkmark-circle" size={22} color="#fff" /> : null}
            </Pressable>
          );
        })}

        <ErrorText>{error}</ErrorText>
        <Button
          label="Create group"
          loading={loading}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              if (!title.trim()) throw new Error('Enter a group name');
              if (selected.length === 0) throw new Error('Select at least one person');
              const id = await createGroupChat(title.trim(), selected);
              router.replace({
                pathname: '/event/[eventId]/conversation/[conversationId]',
                params: { eventId, conversationId: id },
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not create group');
            } finally {
              setLoading(false);
            }
          }}
        />
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
  heading: { fontFamily: fonts.bodyBold, fontSize: 18, flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: 40 },
  meta: { fontFamily: fonts.body, marginBottom: spacing.sm },
  row: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
