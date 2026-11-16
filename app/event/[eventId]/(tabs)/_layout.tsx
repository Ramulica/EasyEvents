import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts } from '@/lib/theme';

function TabIcon({
  name,
  color,
  size,
  badge,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size: number;
  badge?: boolean;
}) {
  return (
    <View>
      <Ionicons name={name} size={size} color={color} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: -2,
            right: -4,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: '#E11D48',
            borderWidth: 1.5,
            borderColor: '#fff',
          }}
        />
      ) : null}
    </View>
  );
}

export default function EventTabsLayout() {
  const {
    canOrganizeCurrentEvent,
    unreadMessageCount,
    unreadNotificationCount,
  } = useApp();
  const { colors, mode } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: mode === 'dark' ? colors.aqua : colors.coral,
        tabBarInactiveTintColor: colors.inkSoft,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.bodyMedium,
          fontSize: 11,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="people"
        options={{
          title: 'Going',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name="chatbubbles-outline"
              color={color as string}
              size={size}
              badge={unreadMessageCount > 0}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="newspaper-outline" color={color as string} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size }) => (
            <TabIcon
              name="notifications-outline"
              color={color as string}
              size={size}
              badge={unreadNotificationCount > 0}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="host"
        options={{
          title: 'Manage',
          tabBarButton: canOrganizeCurrentEvent ? undefined : () => null,
          tabBarItemStyle: canOrganizeCurrentEvent ? undefined : { display: 'none' },
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="settings-outline" color={color as string} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
