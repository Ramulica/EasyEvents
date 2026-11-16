import AsyncStorage from '@react-native-async-storage/async-storage';

import type { AppData, Session } from './types';

const DATA_KEY = 'easyevents.data.v1';
const SESSION_KEY = 'easyevents.session.v1';

export const emptyData = (): AppData => ({
  accounts: [],
  tenants: [],
  events: [],
  participants: [],
  activities: [],
  bookings: [],
  announcements: [],
  conversations: [],
  invites: [],
  messages: [],
  notifications: [],
});

export async function loadData(): Promise<AppData> {
  const raw = await AsyncStorage.getItem(DATA_KEY);
  if (!raw) return emptyData();
  try {
    return { ...emptyData(), ...JSON.parse(raw) } as AppData;
  } catch {
    return emptyData();
  }
}

export async function saveData(data: AppData): Promise<void> {
  await AsyncStorage.setItem(DATA_KEY, JSON.stringify(data));
}

export async function loadSession(): Promise<Session | null> {
  const raw = await AsyncStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
