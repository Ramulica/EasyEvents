import { useLocalSearchParams } from 'expo-router';

import { useApp } from '@/contexts/AppContext';
import { paramId } from '@/lib/routeParams';

/** Prefer route param; fall back to guest session (soft nav often omits [eventId] in tabs). */
export function useEventId() {
  const raw = useLocalSearchParams<{ eventId: string }>();
  const { session, currentEvent } = useApp();
  const fromRoute = paramId(raw.eventId);
  if (fromRoute) return fromRoute;
  if (session?.kind === 'guest' && session.eventId) return session.eventId;
  return currentEvent?.id ?? '';
}
