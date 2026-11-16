import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';

import { BrandMark, Button, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { colors, spacing } from '@/lib/theme';

export default function SignupScreen() {
  const router = useRouter();
  const { signUpMember } = useApp();
  const [name, setName] = useState('');
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
        <Title>Create membership</Title>
        <Label>Name</Label>
        <Field value={name} onChangeText={setName} placeholder="Your name" />
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
          placeholder="Create a password"
        />
        <ErrorText>{error}</ErrorText>
        <Button
          label="Create account"
          loading={loading}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              await signUpMember({ name, email, password });
              router.replace('/member');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not create account');
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
});
