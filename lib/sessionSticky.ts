import type { AppData, Session } from './types';

/** Prefer the fuller roster — never let a partial refresh shrink the people list. */
export function mergeSnapshotPeople(
  previous: AppData,
  snapshot: AppData,
  eventId: string | null | undefined
): AppData {
  if (!eventId) return snapshot;

  const incoming = snapshot.participants.filter((p) => p.eventId === eventId);
  const existing = previous.participants.filter((p) => p.eventId === eventId);

  if (incoming.length >= existing.length) {
    return snapshot;
  }

  return {
    ...snapshot,
    participants: [
      ...snapshot.participants.filter((p) => p.eventId !== eventId),
      ...existing,
    ],
  };
}

/** Never silently demote an in-event guest session to member/null. */
export function stickGuestSession(
  previous: Session | null,
  next: Session | null
): Session | null {
  if (previous?.kind === 'guest' && next?.kind !== 'guest') {
    return previous;
  }
  return next;
}
