import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import type { Participant } from '@/lib/types';
import { colors, fonts, radii, spacing } from '@/lib/theme';

export default function SelectUserScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; eventPassword?: string; eventName?: string }>();
  const { listJoinParticipants, joinAsGuest } = useApp();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setBooting(true);
        const rows = await listJoinParticipants(params.code, params.eventPassword);
        if (!cancelled) setParticipants(rows);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load participants');
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listJoinParticipants, params.code, params.eventPassword]);

  const selected = participants.find((p) => p.id === selectedId);

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.ocean} size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <Title>Who are you?</Title>
      <Text style={styles.meta}>{params.eventName ?? 'Event'}</Text>

      <View style={styles.list}>
        {participants.map((p) => {
          const active = p.id === selectedId;
          return (
            <Pressable
              key={p.id}
              onPress={() => setSelectedId(p.id)}
              style={[styles.person, active && styles.personActive]}>
              <Text style={[styles.personName, active && styles.personNameActive]}>{p.displayName}</Text>
              <Text style={[styles.personHint, active && styles.personHintActive]}>
                {p.role} · {p.passwordHash ? 'Password required' : 'No password'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selected?.passwordHash ? (
        <>
          <Label>Your password</Label>
          <Field secureTextEntry value={password} onChangeText={setPassword} placeholder="User password" />
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>
      <Button
        label="Enter event"
        loading={loading}
        disabled={!selectedId}
        onPress={async () => {
          if (!selectedId) return;
          try {
            setLoading(true);
            setError(null);
            const joined = await joinAsGuest({
              code: params.code,
              eventPassword: params.eventPassword,
              participantId: selectedId,
              participantPassword: password,
            });
            router.replace(`/event/${joined.eventId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not enter event');
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
  root: { flex: 1, backgroundColor: colors.mist },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mist,
  },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
  meta: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    marginBottom: spacing.lg,
  },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  person: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  personActive: {
    backgroundColor: colors.ocean,
    borderColor: colors.ocean,
  },
  personName: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    color: colors.ink,
  },
  personNameActive: { color: colors.white },
  personHint: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.inkSoft,
  },
  personHintActive: { color: colors.aquaSoft },
});
