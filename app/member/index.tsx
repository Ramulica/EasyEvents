import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Button, EmptyState, Title } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';

export default function MemberHomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const {
    session,
    currentAccount,
    currentTenant,
    eventsForHost,
    signOut,
    enterEventAsHost,
    loadDemo,
  } = useApp();
  const [loadingDemo, setLoadingDemo] = useState(false);

  if (!session || session.kind !== 'member' || !currentAccount) {
    return <Redirect href="/" />;
  }

  const events = eventsForHost(currentAccount.id);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.hello, { color: colors.inkSoft }]}>Hi, {currentAccount.name}</Text>
          <Title>Your events</Title>
          <Text style={[styles.tenantLine, { color: colors.aqua }]}>
            {currentTenant?.name ?? 'Your workspace'}
            {currentTenant ? ` · ${currentTenant.plan}` : ''}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/member/settings')} style={styles.accountBtn}>
          <Avatar name={currentAccount.name} uri={currentAccount.avatarUri} size={52} />
          <Text style={[styles.accountLabel, { color: colors.inkSoft }]}>Account</Text>
        </Pressable>
      </View>

      <Button label="Create event" onPress={() => router.push('/member/create-event')} />
      <Button
        label={loadingDemo ? 'Creating demo…' : 'Create demo camp'}
        variant="secondary"
        loading={loadingDemo}
        onPress={async () => {
          try {
            setLoadingDemo(true);
            const demo = await loadDemo();
            Alert.alert(
              'Demo camp ready',
              `Code: ${demo.code}\nPassword: ${demo.eventPassword}\n\nShare this code — it works in any browser.`
            );
          } catch (e) {
            Alert.alert('Demo', e instanceof Error ? e.message : 'Could not create demo');
          } finally {
            setLoadingDemo(false);
          }
        }}
      />

      <View style={styles.list}>
        {events.length === 0 ? (
          <EmptyState
            title="No events yet"
            body="Create a camp, party, or weekend and add participants by name."
          />
        ) : (
          events.map((event) => (
            <View
              key={event.id}
              style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
              <Text style={[styles.cardTitle, { color: colors.oceanDeep }]}>{event.name}</Text>
              <Text style={[styles.cardMeta, { color: colors.aqua }]}>Code · {event.code}</Text>
              <Text style={[styles.cardMeta, { color: colors.aqua }]}>
                {new Date(event.startsAt).toLocaleDateString()} –{' '}
                {new Date(event.endsAt).toLocaleDateString()}
              </Text>
              <Text style={[styles.cardBody, { color: colors.inkSoft }]} numberOfLines={2}>
                {event.description || 'No description'}
              </Text>
              <Button
                label="Open event"
                onPress={async () => {
                  await enterEventAsHost(event.id);
                  router.replace({
                    pathname: '/event/[eventId]',
                    params: { eventId: event.id },
                  });
                }}
              />
              <Button
                label="Manage people & settings"
                variant="ghost"
                onPress={() => router.push(`/member/event/${event.id}`)}
              />
            </View>
          ))
        )}
      </View>

      <Button
        label="Sign out"
        variant="ghost"
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  hello: {
    fontFamily: fonts.bodyMedium,
    marginBottom: spacing.xs,
  },
  tenantLine: {
    fontFamily: fonts.bodyMedium,
    fontSize: 13,
    marginTop: 4,
  },
  accountBtn: {
    alignItems: 'center',
    gap: 4,
  },
  accountLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
  list: { marginTop: spacing.lg },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
  },
  cardMeta: {
    marginTop: 4,
    fontFamily: fonts.bodyMedium,
  },
  cardBody: {
    marginTop: spacing.sm,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
});
