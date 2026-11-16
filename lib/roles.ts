import type { ParticipantRole } from './types';

export function roleLabel(role: ParticipantRole) {
  return role;
}

export function assignableRoles(actorRole: ParticipantRole | null | undefined): ParticipantRole[] {
  if (actorRole === 'admin') return ['host', 'organizer', 'member'];
  if (actorRole === 'host') return ['organizer', 'member'];
  return ['member', 'organizer'];
}

export function canRemoveParticipant(
  actorRole: ParticipantRole | null | undefined,
  targetRole: ParticipantRole
) {
  if (targetRole === 'admin') return false;
  return actorRole === 'admin' || actorRole === 'host';
}
