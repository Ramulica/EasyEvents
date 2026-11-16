export type ChatMode = 'open' | 'private' | 'off';

export type ParticipantRole = 'admin' | 'host' | 'organizer' | 'member';

export type TenantPlan = 'free' | 'pro' | 'enterprise';

export type Tenant = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  plan: TenantPlan;
  createdAt: string;
};

export type MembershipAccount = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  avatarUri: string | null;
  tenantId: string | null;
  createdAt: string;
};

export type EventRecord = {
  id: string;
  code: string;
  name: string;
  description: string;
  hostId: string;
  tenantId: string | null;
  passwordHash: string | null;
  chatMode: ChatMode;
  startsAt: string;
  endsAt: string;
  createdAt: string;
};

export type Participant = {
  id: string;
  eventId: string;
  displayName: string;
  passwordHash: string | null;
  chatId: string;
  role: ParticipantRole;
  avatarUri: string | null;
  createdAt: string;
};

export type Activity = {
  id: string;
  eventId: string;
  title: string;
  description: string;
  location: string;
  startsAt: string;
  endsAt: string;
  capacity: number | null;
  createdAt: string;
};

export type Booking = {
  id: string;
  activityId: string;
  participantId: string;
  createdAt: string;
};

export type Announcement = {
  id: string;
  eventId: string;
  title: string;
  body: string;
  createdAt: string;
  createdByHostId: string;
};

export type Conversation = {
  id: string;
  eventId: string;
  isGroup: boolean;
  title: string | null;
  createdByParticipantId: string | null;
  participantIds: string[];
  myLastReadAt: string | null;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  eventId: string;
  participantId: string;
  kind: 'message' | 'invite' | 'group_add' | 'news' | 'activity' | string;
  title: string;
  body: string;
  refId: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ChatInvite = {
  id: string;
  eventId: string;
  fromParticipantId: string;
  toParticipantId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
};

export type Message = {
  id: string;
  conversationId: string;
  senderParticipantId: string;
  body: string;
  createdAt: string;
};

export type MemberSession = {
  kind: 'member';
  accountId: string;
};

export type GuestSession = {
  kind: 'guest';
  eventId: string;
  participantId: string;
  /** Present when a membership host opens their own event */
  hostAccountId?: string;
};

export type Session = MemberSession | GuestSession;

export type AppData = {
  accounts: MembershipAccount[];
  tenants: Tenant[];
  events: EventRecord[];
  participants: Participant[];
  activities: Activity[];
  bookings: Booking[];
  announcements: Announcement[];
  conversations: Conversation[];
  invites: ChatInvite[];
  messages: Message[];
  notifications: AppNotification[];
};
