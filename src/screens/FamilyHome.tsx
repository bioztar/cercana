import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Moment, Person, Session } from '../lib/types';
import { can, ROLE_LABEL, type Actor } from '../lib/permissions';
import { shareInvite, shareResultText } from '../lib/share';
import { inviteUrl } from '../lib/util';
import { ErrorText } from '../components/ui';
import { CalendarTab } from './CalendarTab';
import { EventDetail } from './EventDetail';
import { MomentsTab } from './MomentsTab';
import { PeopleTab } from './PeopleTab';
import { PingTab } from './PingTab';
import { colors, fonts } from '../theme';

const TABS = ['Feed', 'Calendar', 'People'] as const;
type Tab = (typeof TABS)[number];

type Props = {
  session: Session;
  actor: Actor;
  people: Person[];
  events: EventRow[];
  moments: Moment[];
  error: string | null;
  version: number;
  reload: () => void;
  reloadEvents: () => void;
  onSettings: () => void;
};

export function FamilyHome({ session, actor, people, events, moments, error, version, reload, reloadEvents, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>('Feed');
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [ping, setPing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const me = actor.kind === 'member' ? people.find((p) => p.id === actor.id) : undefined;
  const canInvite = can(actor, { type: 'invite.share' });

  const share = async () => setNote(shareResultText(await shareInvite(inviteUrl(session.code), session.patientName)));

  if (openEventId) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
        <EventDetail eventId={openEventId} events={events} people={people} moments={moments}
          onBack={() => setOpenEventId(null)} onOpenPerson={() => {}} />
      </ScrollView>
    );
  }

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
          <Pressable onPress={() => setPing((v) => !v)} accessibilityRole="button" style={s.settings}>
            <Text style={s.settingsText}>📣 Ping</Text>
          </Pressable>
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
      {ping && (
        <View style={s.pingPanel}>
          <PingTab circleId={session.circleId} fromName={session.memberName} patientName={session.patientName} />
        </View>
      )}
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabText, tab === t && { color: colors.white }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText message={error} />
      {tab === 'Feed' && (
        <MomentsTab
          circleId={session.circleId}
          actor={actor}
          authorName={session.memberName}
          authorId={me?.id ?? null}
          people={people}
          version={version}
        />
      )}
      {tab === 'Calendar' && (
        <CalendarTab circleId={session.circleId} actor={actor} people={people} events={events}
          onOpenEvent={setOpenEventId} onSynced={reloadEvents} />
      )}
      {tab === 'People' && (
        <PeopleTab circleId={session.circleId} patientName={session.patientName} actor={actor} people={people} onChanged={reload} />
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  topActions: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 28, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  note: { fontSize: 18, color: colors.green, fontWeight: '700', marginBottom: 12 },
  pingPanel: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.line },
  settings: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  settingsText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  tabText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
