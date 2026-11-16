import { createChatId, createId, hashSecret } from './crypto';
import type { AppData } from './types';

export async function createDemoSeed(): Promise<AppData> {
  const hostId = createId('acc');
  const eventId = createId('evt');
  const hostPassword = await hashSecret('host123');
  const eventPassword = await hashSecret('camp2026');

  const participants = [
    { name: 'Maya Host', password: null as string | null, role: 'admin' as const },
    { name: 'Alex Rivera', password: 'alex123', role: 'host' as const },
    { name: 'Jordan Lee', password: null, role: 'member' as const },
    { name: 'Sam Patel', password: 'sam123', role: 'member' as const },
    { name: 'Casey Kim', password: null, role: 'member' as const },
  ];

  const participantRecords = await Promise.all(
    participants.map(async (p) => ({
      id: createId('part'),
      eventId,
      displayName: p.name,
      passwordHash: p.password ? await hashSecret(p.password) : null,
      chatId: createChatId(),
      role: p.role,
      avatarUri: null,
      createdAt: new Date().toISOString(),
    }))
  );

  const day = new Date();
  day.setHours(9, 0, 0, 0);
  const activities = [
    {
      title: 'Morning Kickoff',
      description: 'Welcome circle and team assignments.',
      location: 'Main Lawn',
      hour: 9,
      duration: 1,
      capacity: 40,
    },
    {
      title: 'Kayak Adventure',
      description: 'Guided paddle around the cove.',
      location: 'Boat Dock',
      hour: 11,
      duration: 2,
      capacity: 12,
    },
    {
      title: 'Campfire Stories',
      description: 'Songs, snacks, and storytelling.',
      location: 'Fire Pit',
      hour: 19,
      duration: 2,
      capacity: 30,
    },
  ].map((a) => {
    const starts = new Date(day);
    starts.setHours(a.hour, 0, 0, 0);
    const ends = new Date(starts);
    ends.setHours(starts.getHours() + a.duration);
    return {
      id: createId('act'),
      eventId,
      title: a.title,
      description: a.description,
      location: a.location,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      capacity: a.capacity,
      createdAt: new Date().toISOString(),
    };
  });

  const groupConversation = {
    id: createId('conv'),
    eventId,
    isGroup: true,
    title: 'Camp chat',
    createdByParticipantId: null,
    participantIds: participantRecords.map((p) => p.id),
    myLastReadAt: null,
    createdAt: new Date().toISOString(),
  };

  const tenantId = createId('tenant');

  return {
    accounts: [
      {
        id: hostId,
        email: 'host@easyevents.app',
        name: 'Maya Host',
        passwordHash: hostPassword,
        avatarUri: null,
        tenantId,
        createdAt: new Date().toISOString(),
      },
    ],
    tenants: [
      {
        id: tenantId,
        name: "Maya Host's workspace",
        slug: 'maya-host',
        ownerUserId: hostId,
        plan: 'free' as const,
        createdAt: new Date().toISOString(),
      },
    ],
    events: [
      {
        id: eventId,
        code: 'CAMP26',
        name: 'Summer Trail Camp',
        description: 'Three days of outdoor activities, meals, and evening hangouts.',
        hostId,
        tenantId,
        passwordHash: eventPassword,
        chatMode: 'open',
        startsAt: day.toISOString(),
        endsAt: new Date(day.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date().toISOString(),
      },
    ],
    participants: participantRecords,
    activities,
    bookings: [
      {
        id: createId('book'),
        activityId: activities[0].id,
        participantId: participantRecords[1].id,
        createdAt: new Date().toISOString(),
      },
      {
        id: createId('book'),
        activityId: activities[1].id,
        participantId: participantRecords[2].id,
        createdAt: new Date().toISOString(),
      },
    ],
    announcements: [
      {
        id: createId('news'),
        eventId,
        title: 'Welcome to camp!',
        body: 'Check the calendar to book Kayak Adventure. Dinner is at 6:30 by the dining hall.',
        createdAt: new Date().toISOString(),
        createdByHostId: hostId,
      },
    ],
    conversations: [groupConversation],
    invites: [],
    notifications: [],
    messages: [
      {
        id: createId('msg'),
        conversationId: groupConversation.id,
        senderParticipantId: participantRecords[1].id,
        body: 'Who is joining kayaking later?',
        createdAt: new Date().toISOString(),
      },
    ],
  };
}
