import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import type { Checkin, EventRow, ImportantEvent, Person } from '../lib/types';
import { CalendarSections } from './CalendarSections';
import { colors, fonts, MAX_WIDTH, type } from '../theme';

type Props = {
  events: EventRow[];
  people: Person[];
  important: ImportantEvent[];
  checkins: Checkin[];
  onOpenEvent: (eventId: string) => void;
};

/** Mom's "Calendar" tab (Vitaly, 2026-09-24 15:40/15:50): her upcoming days, "For you" highlighted. */
export function PatientCalendar({ events, people, important, checkins, onOpenEvent }: Props) {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>Calendar</Text>
      <CalendarSections events={events} people={people} important={important} checkins={checkins} onOpenEvent={onOpenEvent} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: 20 },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
});
