import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { BrandMark, Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { colors, spacing } from '@/lib/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signInMember } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BrandMark size="sm" />
        <Title>Welcome back</Title>
        <Label>Email</Label>
        <Field
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@email.com"
        />
        <Label>Password</Label>
        <Field
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="Your password"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Sign in"
          loading={loading}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              await signInMember({ email, password });
              router.replace('/member');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not sign in');
            } finally {
              setLoading(false);
            }
          }}
        />
        <Button label="Create account" variant="ghost" onPress={() => router.push('/(auth)/signup')} />
        <Button label="Back" variant="ghost" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.mist },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
});
