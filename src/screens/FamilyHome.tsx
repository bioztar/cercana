import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Person, Session } from '../lib/types';
import { can, ROLE_LABEL, type Actor } from '../lib/permissions';
import { shareInvite, shareResultText } from '../lib/share';
import { inviteUrl } from '../lib/util';
import { ErrorText } from '../components/ui';
import { CalendarsTab } from './CalendarsTab';
import { MomentsTab } from './MomentsTab';
import { PeopleTab } from './PeopleTab';
import { PingTab } from './PingTab';
import { colors, fonts } from '../theme';

const TABS = ['People', 'Calendars', 'Moments', 'Ping'] as const;
type Tab = (typeof TABS)[number];

type Props = {
  session: Session;
  actor: Actor;
  people: Person[];
  error: string | null;
  version: number;
  reload: () => void;
  reloadEvents: () => void;
  onSettings: () => void;
};

export function FamilyHome({ session, actor, people, error, version, reload, reloadEvents, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>('People');
  const [note, setNote] = useState<string | null>(null);
  const me = actor.kind === 'member' ? people.find((p) => p.id === actor.id) : undefined;
  const canInvite = can(actor, { type: 'invite.share' });

  const share = async () => setNote(shareResultText(await shareInvite(inviteUrl(session.code), session.patientName)));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Family of {session.patientName}</Text>
          <Text style={s.sub}>
            Circle code {session.code} · you are {session.memberName}{me ? ` (${ROLE_LABEL[me.role]})` : ''}
          </Text>
        </View>
        <View style={s.topActions}>
          {canInvite ? (
            <Pressable onPress={share} accessibilityRole="button" style={s.settings}>
              <Text style={s.settingsText}>Share invite</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onSettings} accessibilityRole="button" style={s.settings}>
            <Text style={s.settingsText}>Settings</Text>
          </Pressable>
        </View>
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabText, tab === t && { color: colors.white }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText message={error} />
      {tab === 'People' && <PeopleTab circleId={session.circleId} patientName={session.patientName} actor={actor} people={people} onChanged={reload} />}
      {tab === 'Calendars' && (
        <CalendarsTab circleId={session.circleId} actor={actor} people={people} onSynced={reloadEvents} />
      )}
      {tab === 'Moments' && (
        <MomentsTab
          circleId={session.circleId}
          actor={actor}
          authorName={session.memberName}
          authorId={me?.id ?? null}
          people={people}
          version={version}
        />
      )}
      {tab === 'Ping' && (
        <PingTab circleId={session.circleId} fromName={session.memberName} patientName={session.patientName} />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  topActions: { alignItems: 'flex-end' },
  title: { fontSize: 28, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  note: { fontSize: 18, color: colors.green, fontWeight: '700', marginBottom: 12 },
  settings: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  settingsText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  tabText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
