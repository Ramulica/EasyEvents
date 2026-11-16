import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  ActionRow,
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
import type { ChatMode, ParticipantRole } from '@/lib/types';
import { fonts, radii, spacing } from '@/lib/theme';
import { useEventId } from '@/lib/useEventId';

const ROLE_FILTERS: Array<'all' | ParticipantRole> = [
  'all',
  'admin',
  'host',
  'organizer',
  'member',
];

export default function HostScreen() {
  const eventId = useEventId();
  const router = useRouter();
  const { colors, mode, setMode } = useTheme();
  const {
    canManageCurrentEvent,
    canOrganizeCurrentEvent,
    currentEvent,
    participantsForEvent,
    setChatMode,
    addParticipant,
    updateParticipantRole,
    removeParticipant,
    currentParticipant,
    reloadEventPeople,
    refresh,
  } = useApp();

  const [showAddMember, setShowAddMember] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const roleOptions = assignableRoles(currentParticipant?.role);
  const [role, setRole] = useState<ParticipantRole>('member');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | ParticipantRole>('all');

  useEffect(() => {
    if (!eventId || !canManageCurrentEvent) return;
    reloadEventPeople(eventId).catch(() => undefined);
    refresh().catch(() => undefined);
  }, [canManageCurrentEvent, eventId, reloadEventPeople, refresh]);

  const participants = participantsForEvent(eventId);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return participants.filter((p) => {
      if (roleFilter !== 'all' && p.role !== roleFilter) return false;
      if (!q) return true;
      return (
        p.displayName.toLowerCase().includes(q) ||
        p.chatId.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q)
      );
    });
  }, [participants, roleFilter, search]);

  const chatModes = useMemo(
    () =>
      [
        ['open', 'Allowed'],
        ['private', 'Private'],
        ['off', 'Not allowed'],
      ] as [ChatMode, string][],
    []
  );

  if (!currentEvent) {
    return null;
  }

  if (!canOrganizeCurrentEvent) {
    return (
      <ScrollView
        style={[styles.root, { backgroundColor: colors.mist }]}
        contentContainerStyle={styles.scroll}>
        <Title>Manage</Title>
        <Text style={[styles.hint, { color: colors.inkSoft }]}>
          You need admin, host, or organizer access for this tab.
        </Text>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.mist }]}
      contentContainerStyle={styles.scroll}>
      <Title>Manage</Title>
      <Text style={[styles.code, { color: colors.aqua }]}>Code · {currentEvent.code}</Text>
      <Text style={[styles.hint, { color: colors.inkSoft }]}>
        Admin created this event. Hosts can manage people (except promoting hosts). Organizers can
        add activities and news.
      </Text>

      <Text style={[styles.section, { color: colors.ink }]}>Theme</Text>
      <View style={styles.row}>
        <Chip label="Light" active={mode === 'light'} onPress={() => setMode('light')} />
        <Chip label="Dark" active={mode === 'dark'} onPress={() => setMode('dark')} />
      </View>

      <Text style={[styles.section, { color: colors.ink }]}>Quick actions</Text>
      <ActionRow
        title="Add activity"
        subtitle="Create a calendar item people can book"
        onPress={() =>
          router.push({ pathname: '/event/[eventId]/add-activity', params: { eventId } })
        }
      />
      <ActionRow
        title="Post announcement"
        subtitle="Share news with everyone in the event"
        onPress={() =>
          router.push({ pathname: '/event/[eventId]/add-news', params: { eventId } })
        }
      />

      {canManageCurrentEvent ? (
        <>
          <Text style={[styles.section, { color: colors.ink }]}>Chat</Text>
          <View style={styles.row}>
            {chatModes.map(([id, label]) => (
              <Chip
                key={id}
                label={label}
                active={currentEvent.chatMode === id}
                onPress={() => setChatMode(currentEvent.id, id)}
              />
            ))}
          </View>

          <View style={styles.sectionRow}>
            <Text style={[styles.section, { color: colors.ink, marginTop: 0 }]}>People & roles</Text>
            <Pressable onPress={() => setShowAddMember(true)}>
              <Text style={[styles.addLink, { color: colors.aqua }]}>+ Add person</Text>
            </Pressable>
          </View>
          <Text style={[styles.peopleHint, { color: colors.inkSoft }]}>
            Everyone you created for this event — whether they have joined yet or not.
          </Text>

          <Field
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name or chat ID"
          />
          <View style={styles.row}>
            {ROLE_FILTERS.map((option) => (
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
              title="No people loaded"
              body="Tap Refresh people below. If still empty, run supabase/fix_list_people.sql in the Supabase SQL Editor."
            />
          ) : filtered.length === 0 ? (
            <EmptyState title="No matches" body="Try another name or role filter." />
          ) : (
            filtered.map((p) => (
              <View
                key={p.id}
                style={[styles.person, { backgroundColor: colors.white, borderColor: colors.line }]}>
                <Avatar name={p.displayName} uri={p.avatarUri} size={42} />
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
                    <View style={styles.roleRow}>
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
            label="Refresh people"
            variant="secondary"
            onPress={async () => {
              try {
                setError(null);
                await reloadEventPeople(eventId);
                await refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Could not refresh');
              }
            }}
          />
        </>
      ) : null}

      <ErrorText>{error}</ErrorText>

      <ModalSheet
        visible={showAddMember}
        title="Add participant"
        onClose={() => {
          setShowAddMember(false);
          setError(null);
        }}>
        <Label>Name</Label>
        <Field value={displayName} onChangeText={setDisplayName} placeholder="Name" />
        <Label>{role === 'host' ? 'Password (required for hosts)' : 'Optional password'}</Label>
        <Field
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder={role === 'host' ? 'Required' : 'Leave blank if not needed'}
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
          label="Add person"
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
                eventId,
                displayName,
                password: password || undefined,
                role,
              });
              setDisplayName('');
              setPassword('');
              setRole('member');
              setShowAddMember(false);
              await reloadEventPeople(eventId);
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
  scroll: { padding: spacing.lg, paddingTop: 56, paddingBottom: 40 },
  code: { fontFamily: fonts.bodyBold },
  hint: {
    marginTop: 6,
    marginBottom: spacing.md,
    fontFamily: fonts.body,
    lineHeight: 20,
  },
  section: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    fontFamily: fonts.bodyBold,
    fontSize: 18,
  },
  sectionRow: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addLink: { fontFamily: fonts.bodyBold, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: spacing.sm, gap: 6 },
  person: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  personHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  personName: { fontFamily: fonts.bodyBold, flex: 1 },
  removeText: { fontFamily: fonts.bodyBold, fontSize: 13 },
  personMeta: { marginTop: 4, fontFamily: fonts.body, fontSize: 13 },
  peopleHint: { fontFamily: fonts.body, fontSize: 13, marginBottom: spacing.sm, lineHeight: 18 },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm, gap: 6 },
});
