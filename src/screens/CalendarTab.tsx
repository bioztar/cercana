import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Checkin, EventRow, ImportantEvent, Person } from '../lib/types';
import { CalendarSections } from './CalendarSections';
import { BigButton } from '../components/ui';
import { CalendarsTab } from './CalendarsTab';
import { colors, fonts } from '../theme';
import type { Actor } from '../lib/permissions';

type Props = {
  circleId: string;
  actor: Actor;
  people: Person[];
  events: EventRow[];
  important: ImportantEvent[];
  checkins: Checkin[];
  onOpenEvent: (eventId: string) => void;
  onOpenImportant: (id: string) => void;
  onSynced: () => void;
  onConnectDeviceCalendar?: () => void;
};

export function CalendarTab({
  circleId, actor, people, events, important, checkins, onOpenEvent, onOpenImportant, onSynced, onConnectDeviceCalendar,
}: Props) {
  const [managing, setManaging] = useState(false);

  if (managing) {
    return (
      <View style={{ gap: 16 }}>
        <BigButton label="‹ Back to calendar" tone="plain" onPress={() => setManaging(false)} />
        <CalendarsTab circleId={circleId} actor={actor} people={people} onSynced={onSynced}
          onConnectDeviceCalendar={onConnectDeviceCalendar} />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={s.top}>
        <Text style={s.title}>Calendar</Text>
        <Text style={s.sub}>What's coming up for the family</Text>
      </View>
      <CalendarSections
        events={events} people={people} important={important} checkins={checkins}
        onOpenEvent={onOpenEvent} onOpenImportant={onOpenImportant}
      />
      <BigButton label="Manage calendar sources" tone="plain" onPress={() => setManaging(true)} />
    </View>
  );
}

const s = StyleSheet.create({
  top: { gap: 4 },
  title: { fontSize: 32, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 17, color: colors.inkSoft },
});
