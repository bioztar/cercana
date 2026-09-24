import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text';
import type { BriefSettings, Checkin, EventRow, ImportantEvent, Moment, Person, Session } from '../lib/types';
import { can, ROLE_LABEL, type Actor } from '../lib/permissions';
import { shareInvite, shareResultText } from '../lib/share';
import { inviteUrl } from '../lib/util';
import { ErrorText } from '../components/ui';
import { CalendarTab } from './CalendarTab';
import { EventDetail } from './EventDetail';
import { FamilyDashboard } from './FamilyDashboard';
import { MomentsTab } from './MomentsTab';
import { PeopleTab } from './PeopleTab';
import { PingTab } from './PingTab';
import { colors, fonts } from '../theme';

/** The family tab bar's tabs this screen draws; Settings is its own route (see App.tsx / FamilyTabBar). */
export type FamilyHomeTab = 'Today' | 'Feed' | 'Calendar' | 'People';
const WIDE = 1000; // dashboard-beside-feed breakpoint (Vitaly, 2026-09-24 15:30)

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
  tab: FamilyHomeTab;
  // "<patient> today" dashboard (cercana-care's data, cercana-design's layout).
  important: ImportantEvent[];
  checkins: Checkin[];
  briefSettings: BriefSettings;
  onNewImportant: () => void;
  onOpenImportant: (id: string) => void;
  onHearBrief: () => void;
  onConnectDeviceCalendar?: () => void;
};

export function FamilyHome({
  session, actor, people, events, moments, error, version, reload, reloadEvents, tab,
  important, checkins, briefSettings, onNewImportant, onOpenImportant, onHearBrief, onConnectDeviceCalendar,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [ping, setPing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const me = actor.kind === 'member' ? people.find((p) => p.id === actor.id) : undefined;
  const canInvite = can(actor, { type: 'invite.share' });

  const share = async () => setNote(shareResultText(await shareInvite(inviteUrl(session.code), session.patientName)));

  const dashboard = (
    <FamilyDashboard
      circleId={session.circleId} patientName={session.patientName} important={important} checkins={checkins}
      events={events} people={people} moments={moments} version={version} briefSettings={briefSettings}
      onNewImportant={onNewImportant} onOpenImportant={onOpenImportant} onHearBrief={onHearBrief}
    />
  );

  if (openEventId) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
        <EventDetail eventId={openEventId} events={events} people={people} moments={moments}
          onBack={() => setOpenEventId(null)} onOpenPerson={() => {}} />
      </ScrollView>
    );
  }

  // Wide screens keep the dashboard in its own column, so "Today" there shows the feed beside it.
  const content: FamilyHomeTab = wide && tab === 'Today' ? 'Feed' : tab;
  const tabs = (
    <>
      <ErrorText message={error} />
      {content === 'Today' && dashboard}
      {content === 'Feed' && (
        <MomentsTab
          circleId={session.circleId}
          actor={actor}
          authorName={session.memberName}
          authorId={me?.id ?? null}
          people={people}
          version={version}
        />
      )}
      {content === 'Calendar' && (
        <CalendarTab circleId={session.circleId} actor={actor} people={people} events={events}
          important={important} checkins={checkins} onOpenEvent={setOpenEventId} onOpenImportant={onOpenImportant}
          onSynced={reloadEvents} onConnectDeviceCalendar={onConnectDeviceCalendar} />
      )}
      {content === 'People' && (
        <PeopleTab circleId={session.circleId} patientName={session.patientName} actor={actor} people={people} onChanged={reload} />
      )}
    </>
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[s.wrap, wide && s.wrapWide]}>
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
        </View>
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
      {ping && (
        <View style={s.pingPanel}>
          <PingTab circleId={session.circleId} fromName={session.memberName} patientName={session.patientName} />
        </View>
      )}

      {wide ? (
        <View style={s.columns}>
          <View style={s.leftCol}>
            <Text style={s.dashboardHeading}>{session.patientName} today</Text>
            {dashboard}
          </View>
          <View style={s.rightCol}>{tabs}</View>
        </View>
      ) : (
        <>
          {tab === 'Today' ? <Text style={s.dashboardHeading}>{session.patientName} today</Text> : null}
          {tabs}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 820, width: '100%', alignSelf: 'center' },
  wrapWide: { maxWidth: 1180 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  topActions: { alignItems: 'flex-end', gap: 4 },
  title: { fontSize: 28, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  note: { fontSize: 18, color: colors.green, fontWeight: '700', marginBottom: 12 },
  pingPanel: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.line },
  settings: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  settingsText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  columns: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  leftCol: { width: 380, gap: 16 },
  dashboardHeading: { fontSize: 28, fontFamily: fonts.display, color: colors.ink, marginBottom: 12 },
  rightCol: { flex: 1, minWidth: 0 },
});
