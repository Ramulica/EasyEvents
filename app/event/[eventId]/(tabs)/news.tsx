import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { EmptyState } from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

export default function NewsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const eventId = useEventId();
  const { announcementsForEvent, canOrganizeCurrentEvent } = useApp();
  const news = announcementsForEvent(eventId);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: colors.oceanDeep }]}>News</Text>
        {canOrganizeCurrentEvent ? (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/event/[eventId]/add-news', params: { eventId } })
            }>
            <Text style={[styles.addLink, { color: colors.coral }]}>+ Add announcement</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.sub, { color: colors.inkSoft }]}>Announcements from the host.</Text>

      {news.length === 0 ? (
        <EmptyState title="No announcements" body="When the host posts news, it will show up here." />
      ) : (
        news.map((item) => (
          <View
            key={item.id}
            style={[styles.card, { backgroundColor: colors.white, borderColor: colors.line }]}>
            <Text style={[styles.cardTitle, { color: colors.ink }]}>{item.title}</Text>
            <Text style={[styles.meta, { color: colors.inkSoft }]}>
              {format(new Date(item.createdAt), 'MMM d · h:mm a')}
            </Text>
            <Text style={[styles.body, { color: colors.ink }]}>{item.body}</Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: { fontFamily: fonts.displayMedium, fontSize: 30 },
  addLink: { fontFamily: fonts.bodyBold, fontSize: 15 },
  sub: { fontFamily: fonts.body, marginBottom: spacing.lg, marginTop: 4 },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  cardTitle: { fontFamily: fonts.bodyBold, fontSize: 18 },
  meta: { marginTop: 4, fontFamily: fonts.body, fontSize: 13 },
  body: { marginTop: spacing.sm, fontFamily: fonts.body, lineHeight: 22 },
});
