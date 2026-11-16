import * as ImagePicker from 'expo-image-picker';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, Chip, ErrorText, Field, Label, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, spacing } from '@/lib/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const { session, currentAccount, updateProfile, signOut } = useApp();
  const { colors, mode, setMode } = useTheme();
  const [name, setName] = useState(currentAccount?.name ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(currentAccount?.avatarUri ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!session || session.kind !== 'member' || !currentAccount) {
    return <Redirect href="/" />;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>Account</Title>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>Profile & settings</Text>

      <View style={styles.avatarBlock}>
        <Avatar name={name || currentAccount.name} uri={avatarUri} size={96} />
        <Button
          label="Choose profile photo"
          variant="secondary"
          onPress={async () => {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
              setError('Photo permission is needed to set a profile image.');
              return;
            }
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.8,
              allowsEditing: true,
              aspect: [1, 1],
            });
            if (!result.canceled && result.assets[0]?.uri) {
              setAvatarUri(result.assets[0].uri);
            }
          }}
        />
        {avatarUri ? (
          <Button label="Remove photo" variant="ghost" onPress={() => setAvatarUri(null)} />
        ) : null}
      </View>

      <Label>Display name</Label>
      <Field value={name} onChangeText={setName} placeholder="Your name" />
      <Label>Email</Label>
      <Field value={currentAccount.email} editable={false} />

      <Label>Theme</Label>
      <View style={styles.row}>
        <Chip label="Light" active={mode === 'light'} onPress={() => setMode('light')} />
        <Chip label="Dark" active={mode === 'dark'} onPress={() => setMode('dark')} />
      </View>

      <ErrorText>{error}</ErrorText>
      <Button
        label="Save changes"
        loading={loading}
        onPress={async () => {
          try {
            setLoading(true);
            setError(null);
            await updateProfile({ name, avatarUri });
            router.back();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not save profile');
          } finally {
            setLoading(false);
          }
        }}
      />
      <Button label="Back" variant="ghost" onPress={() => router.back()} />
      <Button
        label="Sign out"
        variant="danger"
        onPress={async () => {
          await signOut();
          router.replace('/');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
  sub: {
    fontFamily: fonts.body,
    marginBottom: spacing.lg,
  },
  avatarBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.xs },
});
