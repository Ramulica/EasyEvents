import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';

import { BrandMark, Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { colors, fonts, spacing } from '@/lib/theme';

export default function GuestJoinScreen() {
  const router = useRouter();
  const { findEventByCode, listJoinParticipants } = useApp();
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BrandMark size="sm" />
        <Title>Join an event</Title>
        <Text style={styles.note}>
          Enter the shared event code. Works across browsers once Supabase is connected.
        </Text>
        <Label>Event code</Label>
        <Field
          autoCapitalize="characters"
          value={code}
          onChangeText={setCode}
          placeholder="e.g. CAMP26"
        />
        <Label>Event password (if required)</Label>
        <Field
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Leave blank if none"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Continue"
          loading={loading}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              const event = await findEventByCode(code);
              if (!event) throw new Error('Event not found. Check the code and try again.');
              // Validates event password server-side
              await listJoinParticipants(event.code, password);
              router.push({
                pathname: '/guest/select-user',
                params: {
                  code: event.code,
                  eventPassword: password,
                  eventName: event.name,
                },
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not join');
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
  note: {
    fontFamily: fonts.body,
    color: colors.inkSoft,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
});
