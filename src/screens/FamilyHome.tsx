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

const TABS = ['Feed', 'Calendar', 'People'] as const;
type Tab = (typeof TABS)[number];
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
  onSettings: () => void;
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
  session, actor, people, events, moments, error, version, reload, reloadEvents, onSettings,
  important, checkins, briefSettings, onNewImportant, onOpenImportant, onHearBrief, onConnectDeviceCalendar,
}: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const [tab, setTab] = useState<Tab>('Feed');
  const [openEventId, setOpenEventId] = useState<string | null>(null);
  const [ping, setPing] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [dashboardOpen, setDashboardOpen] = useState(true); // phones: collapsible; wide screens: always shown
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

  const tabs = (
    <>
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
          onOpenEvent={setOpenEventId} onSynced={reloadEvents} onConnectDeviceCalendar={onConnectDeviceCalendar} />
      )}
      {tab === 'People' && (
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
          <Pressable accessibilityRole="button" onPress={() => setDashboardOpen((v) => !v)} style={s.collapseRow}>
            <Text style={s.collapseText}>{session.patientName} today</Text>
            <Text style={s.collapseChevron}>{dashboardOpen ? '︿' : '﹀'}</Text>
          </Pressable>
          {dashboardOpen && <View style={{ marginBottom: 20 }}>{dashboard}</View>}
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
  dashboardHeading: { fontSize: 28, fontFamily: fonts.display, color: colors.ink },
  rightCol: { flex: 1, minWidth: 0 },
  collapseRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48,
    marginBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingBottom: 8,
  },
  collapseText: { fontSize: 20, fontFamily: fonts.display, color: colors.ink },
  collapseChevron: { fontSize: 20, color: colors.inkSoft },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  tabText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
