import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Person, Session } from '../lib/types';
import { ErrorText } from '../components/ui';
import { CalendarsTab } from './CalendarsTab';
import { MomentsTab } from './MomentsTab';
import { PeopleTab } from './PeopleTab';
import { PingTab } from './PingTab';
import { colors } from '../theme';

const TABS = ['People', 'Calendars', 'Moments', 'Ping'] as const;
type Tab = (typeof TABS)[number];

type Props = {
  session: Session;
  people: Person[];
  error: string | null;
  version: number;
  reload: () => void;
  reloadEvents: () => void;
  onSettings: () => void;
};

export function FamilyHome({ session, people, error, version, reload, reloadEvents, onSettings }: Props) {
  const [tab, setTab] = useState<Tab>('People');
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Family of {session.patientName}</Text>
          <Text style={s.sub}>Circle code {session.code} · you are {session.memberName}</Text>
        </View>
        <Pressable onPress={onSettings} accessibilityRole="button" style={s.settings}>
          <Text style={s.settingsText}>Settings</Text>
        </Pressable>
      </View>
      <View style={s.tabs}>
        {TABS.map((t) => (
          <Pressable key={t} onPress={() => setTab(t)} accessibilityRole="tab" style={[s.tab, tab === t && s.tabOn]}>
            <Text style={[s.tabText, tab === t && { color: colors.white }]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText message={error} />
      {tab === 'People' && <PeopleTab circleId={session.circleId} people={people} onChanged={reload} />}
      {tab === 'Calendars' && <CalendarsTab circleId={session.circleId} people={people} onSynced={reloadEvents} />}
      {tab === 'Moments' && (
        <MomentsTab circleId={session.circleId} authorName={session.memberName} people={people} version={version} />
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
  title: { fontSize: 28, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  settings: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  settingsText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  tab: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  tabOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  tabText: { fontSize: 18, fontWeight: '700', color: colors.ink },
});
