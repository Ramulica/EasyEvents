import type {
  Activity,
  Announcement,
  AppNotification,
  ChatInvite,
  Conversation,
  EventRecord,
  MembershipAccount,
  Message,
  Participant,
  ParticipantRole,
  ChatMode,
  Tenant,
  TenantPlan,
} from './types';

export function mapTenant(row: any): Tenant {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerUserId: row.owner_user_id,
    plan: (row.plan ?? 'free') as TenantPlan,
    createdAt: row.created_at,
  };
}

export function mapProfile(row: any): MembershipAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    passwordHash: '',
    avatarUri: row.avatar_uri ?? null,
    tenantId: row.tenant_id ?? null,
    createdAt: row.created_at,
  };
}

export function mapEvent(row: any): EventRecord {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description ?? '',
    hostId: row.host_id,
    tenantId: row.tenant_id ?? null,
    passwordHash: row.password_hash ?? null,
    chatMode: (row.chat_mode ?? 'open') as ChatMode,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function mapParticipant(row: any): Participant {
  return {
    id: row.id,
    eventId: row.event_id,
    displayName: row.display_name,
    passwordHash: row.password_hash ?? (row.requires_password ? 'set' : null),
    chatId: row.chat_id,
    role: (row.role ?? 'member') as ParticipantRole,
    avatarUri: row.avatar_uri ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
  };
}

export function mapActivity(row: any): Activity {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    description: row.description ?? '',
    location: row.location ?? '',
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: row.capacity ?? null,
    createdAt: row.created_at,
  };
}

export function mapBooking(row: any) {
  return {
    id: row.id,
    activityId: row.activity_id,
    participantId: row.participant_id,
    createdAt: row.created_at,
  };
}

export function mapAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    eventId: row.event_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    createdByHostId: row.created_by_host_id,
  };
}

export function mapConversation(
  row: any,
  participantIds: string[] = [],
  myLastReadAt: string | null = null
): Conversation {
  return {
    id: row.id,
    eventId: row.event_id,
    isGroup: row.is_group,
    title: row.title ?? null,
    createdByParticipantId: row.created_by_participant_id ?? null,
    participantIds,
    myLastReadAt,
    createdAt: row.created_at,
  };
}

export function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    eventId: row.event_id,
    participantId: row.participant_id,
    kind: row.kind,
    title: row.title,
    body: row.body ?? '',
    refId: row.ref_id ?? null,
    readAt: row.read_at ?? null,
    createdAt: row.created_at,
  };
}

export function mapInvite(row: any): ChatInvite {
  return {
    id: row.id,
    eventId: row.event_id,
    fromParticipantId: row.from_participant_id,
    toParticipantId: row.to_participant_id,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderParticipantId: row.sender_participant_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export function rpcError(error: { message?: string } | null, fallback: string) {
  const message = error?.message ?? fallback;
  return new Error(message.replace(/^.*error:\\s*/i, '').split('\n')[0]);
}
