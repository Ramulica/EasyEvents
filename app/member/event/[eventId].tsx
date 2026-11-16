import { format } from 'date-fns';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Avatar,
  Button,
  Chip,
  EmptyState,
  ErrorText,
  Field,
  Label,
  ModalSheet,
  Title,
} from '@/components/ui';
import { useApp } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { assignableRoles } from '@/lib/roles';
import { paramId } from '@/lib/routeParams';
import type { ChatMode, ParticipantRole } from '@/lib/types';
import { fonts, radii, spacing } from '@/lib/theme';

export default function ManageEventScreen() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ eventId: string }>();
  const eventId = paramId(raw.eventId);
  const { colors } = useTheme();
  const {
    session,
    currentAccount,
    data,
    participantsForEvent,
    addParticipant,
    updateParticipantRole,
    removeParticipant,
    setChatMode,
    enterEventAsHost,
    reloadEventPeople,
    refresh,
  } = useApp();

  const [showAdd, setShowAdd] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ParticipantRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [opening, setOpening] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ParticipantRole>('all');
  const roleOptions = assignableRoles('admin');

  const event = useMemo(() => data.events.find((e) => e.id === eventId), [data.events, eventId]);

  useEffect(() => {
    if (!eventId) return;
    reloadEventPeople(eventId).catch(() => undefined);
    refresh().catch(() => undefined);
  }, [eventId, reloadEventPeople, refresh]);

  const participants = participantsForEvent(eventId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.chatId.toLowerCase().includes(q)
      );
    });
  }, [participants, roleFilter, search]);

  if (!session || session.kind !== 'member' || !currentAccount) {
    return <Redirect href="/" />;
  }

  if (!event || event.hostId !== currentAccount.id) {
    return <Redirect href="/member" />;
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>{event.name}</Title>
      <Text style={[styles.code, { color: colors.aqua }]}>Code · {event.code}</Text>
      <Text style={[styles.dates, { color: colors.inkSoft }]}>
        {format(new Date(event.startsAt), 'MMM d, yyyy')} –{' '}
        {format(new Date(event.endsAt), 'MMM d, yyyy')}
      </Text>
      <Text style={[styles.body, { color: colors.inkSoft }]}>{event.description}</Text>

      <Label>Chat mode</Label>
      <View style={styles.row}>
        {(
          [
            ['open', 'Allowed'],
            ['private', 'Private'],
            ['off', 'Not allowed'],
          ] as [ChatMode, string][]
        ).map(([id, label]) => (
          <Chip
            key={id}
            label={label}
            active={event.chatMode === id}
            onPress={() => setChatMode(event.id, id)}
          />
        ))}
      </View>

      <View style={styles.sectionRow}>
        <Text style={[styles.section, { color: colors.ink }]}>People & roles</Text>
        <Pressable onPress={() => setShowAdd(true)} style={styles.addLink}>
          <Text style={[styles.addLinkText, { color: colors.aqua }]}>+ Add person</Text>
        </Pressable>
      </View>

      <Field value={search} onChangeText={setSearch} placeholder="Search by name or chat ID" />
      <View style={styles.row}>
        {(['all', 'admin', 'host', 'organizer', 'member'] as const).map((option) => (
          <Chip
            key={option}
            label={option === 'all' ? 'All roles' : option}
            active={roleFilter === option}
            onPress={() => setRoleFilter(option)}
          />
        ))}
      </View>

      {participants.length === 0 ? (
        <EmptyState
          title="No participants yet"
          body="Add people by name so guests can join as themselves."
        />
      ) : filtered.length === 0 ? (
        <EmptyState title="No matches" body="Try another name or role filter." />
      ) : (
        filtered.map((p) => (
          <View
            key={p.id}
            style={[styles.person, { backgroundColor: colors.white, borderColor: colors.line }]}>
            <Avatar name={p.displayName} uri={p.avatarUri} size={40} />
            <View style={{ flex: 1 }}>
              <View style={styles.personHeader}>
                <Text style={[styles.personName, { color: colors.ink }]}>{p.displayName}</Text>
                {p.role !== 'admin' ? (
                  <Pressable
                    onPress={async () => {
                      try {
                        setError(null);
                        await removeParticipant(p.id);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'Could not remove person');
                      }
                    }}>
                    <Text style={[styles.removeText, { color: colors.danger }]}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={[styles.personMeta, { color: colors.inkSoft }]}>
                {p.role} · Chat ID {p.chatId}
                {p.passwordHash ? ' · password on' : ''}
              </Text>
              {p.role !== 'admin' ? (
                <View style={styles.row}>
                  {roleOptions.map((option) => (
                    <Chip
                      key={option}
                      label={option}
                      active={p.role === option}
                      onPress={() => updateParticipantRole(p.id, option)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        ))
      )}

      <Button
        label="Open event app"
        loading={opening}
        onPress={async () => {
          try {
            setOpening(true);
            await enterEventAsHost(event.id);
            router.push(`/event/${event.id}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not open event');
          } finally {
            setOpening(false);
          }
        }}
      />
      <ErrorText>{error}</ErrorText>
      <Button label="Back to my events" variant="ghost" onPress={() => router.replace('/member')} />

      <ModalSheet
        visible={showAdd}
        title="Add participant"
        onClose={() => {
          setShowAdd(false);
          setError(null);
        }}>
        <Label>Name</Label>
        <Field value={displayName} onChangeText={setDisplayName} placeholder="Name" />
        <Label>{role === 'host' ? 'Password (required for hosts)' : 'Optional password'}</Label>
        <Field
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder={role === 'host' ? 'Required' : 'Leave blank for parties'}
        />
        <Label>Role</Label>
        <View style={styles.row}>
          {roleOptions.map((option) => (
            <Chip
              key={option}
              label={option}
              active={role === option}
              onPress={() => setRole(option)}
            />
          ))}
        </View>
        <ErrorText>{error}</ErrorText>
        <Button
          label="Add participant"
          loading={loading}
          onPress={async () => {
            try {
              setLoading(true);
              setError(null);
              if (!displayName.trim()) throw new Error('Enter a name.');
              if (role === 'host' && !password.trim()) {
                throw new Error('Hosts must have a password.');
              }
              await addParticipant({
                eventId: event.id,
                displayName,
                password: password || undefined,
                role,
              });
              setDisplayName('');
              setPassword('');
              setRole('member');
              setShowAdd(false);
              await reloadEventPeople(event.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Could not add participant');
            } finally {
              setLoading(false);
            }
          }}
        />
      </ModalSheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { padding: spacing.lg, paddingTop: 64, paddingBottom: 40 },
  code: {
    fontFamily: fonts.bodyBold,
    marginBottom: 4,
  },
  dates: {
    fontFamily: fonts.bodyMedium,
    marginBottom: spacing.sm,
  },
  body: {
    fontFamily: fonts.body,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: 6 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  section: {
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  addLink: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  addLinkText: {
    fontFamily: fonts.bodyBold,
    fontSize: 15,
  },
  person: {
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  personName: {
    fontFamily: fonts.bodyBold,
    flex: 1,
  },
  removeText: {
    fontFamily: fonts.bodyBold,
    fontSize: 13,
  },
  personMeta: {
    marginTop: 4,
    fontFamily: fonts.body,
    fontSize: 13,
  },
});
