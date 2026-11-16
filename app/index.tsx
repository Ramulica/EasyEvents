import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark, Button, Card, Subtitle } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { colors, fonts, spacing } from '@/lib/theme';

export default function WelcomeScreen() {
  const router = useRouter();
  const { session, currentAccount, configured } = useApp();

  if (session?.kind === 'guest') {
    return <Redirect href={`/event/${session.eventId}`} />;
  }

  if (session?.kind === 'member' && currentAccount) {
    return <Redirect href="/member" />;
  }

  return (
    <ScrollView contentContainerStyle={styles.scroll} style={styles.root}>
      <View style={styles.heroArt}>
        <LinearGradient
          colors={['#0B4F5C', '#1FA6A0', '#E85D4C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroOrbOne} />
        <View style={styles.heroOrbTwo} />
        <Text style={styles.heroCaption}>One event. Many plans. Everyone in sync.</Text>
      </View>
      <BrandMark />
      <Subtitle>
        Create an event, add participants, then let everyone book activities and see who is going where —
        like a cruise companion app for camps, parties, and weekends.
      </Subtitle>

      {!configured ? (
        <Card style={styles.setupCard}>
          <Text style={styles.cardTitle}>Connect Supabase</Text>
          <Text style={styles.cardBody}>
            Add your project URL and anon key to a `.env` file, run `supabase/schema.sql`, and enable
            Anonymous sign-ins. See README for steps.
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text style={styles.cardTitle}>I have a membership</Text>
        <Text style={styles.cardBody}>Create events, invite people, manage the schedule.</Text>
        <Button label="Sign in" onPress={() => router.push('/(auth)/login')} disabled={!configured} />
        <Button
          label="Create account"
          variant="secondary"
          disabled={!configured}
          onPress={() => router.push('/(auth)/signup')}
        />
      </Card>

      <Card>
        <Text style={styles.cardTitle}>I am a guest</Text>
        <Text style={styles.cardBody}>Enter an event code, pick your name, and join from any browser.</Text>
        <Button label="Join an event" disabled={!configured} onPress={() => router.push('/guest/join')} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.mist,
  },
  scroll: {
    padding: spacing.lg,
    paddingTop: 72,
    paddingBottom: 48,
  },
  heroArt: {
    height: 180,
    borderRadius: 28,
    marginBottom: spacing.lg,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  heroOrbOne: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -40,
    right: -20,
  },
  heroOrbTwo: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(232,93,76,0.35)',
    bottom: 24,
    left: 24,
  },
  heroCaption: {
    fontFamily: fonts.displayMedium,
    fontSize: 22,
    color: colors.white,
    maxWidth: 260,
    lineHeight: 28,
  },
  setupCard: {
    backgroundColor: colors.coralSoft,
  },
  cardTitle: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: 4,
  },
  cardBody: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.inkSoft,
    lineHeight: 20,
  },
});
