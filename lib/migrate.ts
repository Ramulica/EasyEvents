import type { AppData, Participant, MembershipAccount } from './types';
import { emptyData } from './storage';

export function migrateData(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const data = { ...base, ...(raw as AppData) };

  data.accounts = (data.accounts ?? []).map((account: MembershipAccount) => ({
    ...account,
    avatarUri: account.avatarUri ?? null,
  }));

  data.participants = (data.participants ?? []).map((participant: Participant) => {
    const event = data.events.find((e) => e.id === participant.eventId);
    const inferredRole =
      participant.role ??
      (event && data.accounts.some((a) => a.id === event.hostId && a.name === participant.displayName)
        ? 'host'
        : 'member');
    return {
      ...participant,
      role: inferredRole,
      avatarUri: participant.avatarUri ?? null,
    };
  });

  return data;
}
