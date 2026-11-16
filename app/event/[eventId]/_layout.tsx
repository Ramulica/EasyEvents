import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useEventId } from '@/lib/useEventId';

export default function EventStackLayout() {
  const eventId = useEventId();
  const { session, data, reloadEventPeople } = useApp();
  const { colors } = useTheme();

  const event = data.events.find((e) => e.id === eventId);
  const guestEventId = session?.kind === 'guest' ? session.eventId : null;

  // Only reload people — never call full refresh here (that was demoting the session)
  useEffect(() => {
    if (!guestEventId || guestEventId !== eventId) return;
    reloadEventPeople(eventId).catch(() => undefined);
  }, [eventId, guestEventId, reloadEventPeople]);

  if (!session || session.kind !== 'guest') {
    return <Redirect href="/" />;
  }

  if (session.eventId !== eventId) {
    return <Redirect href={`/event/${session.eventId}`} />;
  }

  if (!event) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.mist,
        }}>
        <ActivityIndicator color={colors.ocean} size="large" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="add-activity" options={{ presentation: 'card' }} />
      <Stack.Screen name="add-news" options={{ presentation: 'card' }} />
      <Stack.Screen name="contacts" options={{ presentation: 'card' }} />
      <Stack.Screen name="new-group" options={{ presentation: 'card' }} />
      <Stack.Screen name="conversation/[conversationId]" options={{ presentation: 'card' }} />
    </Stack>
  );
}
