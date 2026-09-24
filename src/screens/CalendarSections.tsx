import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Checkin, EventRow, ImportantEvent, Person } from '../lib/types';
import { agenda, groupByDay, splitByPatient } from '../lib/calendarView';
import { dashboardImportant } from '../lib/dashboard';
import { cardText } from '../lib/important';
import { AgendaCard } from '../components/AgendaCard';
import { colors, fonts, radius, typeFamily } from '../theme';

type Props = {
  events: EventRow[];
  people: Person[];
  important?: ImportantEvent[]; // patient side may omit — she already sees these on her home card
  checkins?: Checkin[];
  monthsAhead?: number;
  onOpenEvent: (eventId: string) => void;
  onOpenImportant?: (id: string) => void; // family only — patient has no important-event screen
};

/** "For you" (highlighted) vs "Family" calendar sections (Vitaly, 2026-09-24 15:50), shared by
 * Mom's Calendar tab and the family's. */
export function CalendarSections({ events, people, important = [], checkins = [], monthsAhead = 3, onOpenEvent, onOpenImportant }: Props) {
  const now = new Date();
  const items = useMemo(
    () => agenda(events, people, now, new Date(now.getFullYear(), now.getMonth() + monthsAhead, now.getDate())),
    [events, people, monthsAhead],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` recomputed fresh each render is not a real dependency
  );
  const { forYou, family } = splitByPatient(items);
  const forYouGroups = groupByDay(forYou, now);
  const familyGroups = groupByDay(family, now);
  const importantRows = dashboardImportant(important, checkins, now);

  return (
    <View style={{ gap: 20 }}>
      <View style={s.forYouCard}>
        <View style={s.forYouTag}>
          <Text style={s.forYouTagText}>For you</Text>
        </View>
        {importantRows.length === 0 && forYouGroups.length === 0 ? (
          <Text style={s.empty}>Nothing just for you yet.</Text>
        ) : (
          <>
            {importantRows.map(({ event, status, urgent }) => (
              <Pressable
                key={event.id} accessibilityRole="button" disabled={!onOpenImportant}
                onPress={() => onOpenImportant?.(event.id)} style={s.importantRow}
              >
                <Text style={s.importantTitle}>{cardText(event, now)}</Text>
                <Text style={[s.importantStatus, urgent && s.importantStatusUrgent]}>{status}</Text>
              </Pressable>
            ))}
            {forYouGroups.map((g) => (
              <View key={g.key} style={{ gap: 10 }}>
                <Text style={s.heading}>{g.heading}</Text>
                {g.items.map((it) => (
                  <AgendaCard key={it.key} item={it} people={people} onPress={it.eventId ? () => onOpenEvent(it.eventId!) : undefined} />
                ))}
              </View>
            ))}
          </>
        )}
      </View>

      <View style={{ gap: 14 }}>
        <Text style={s.familyLabel}>Family</Text>
        {familyGroups.length === 0 ? (
          <Text style={s.empty}>Nothing coming up.</Text>
        ) : (
          familyGroups.map((g) => (
            <View key={g.key} style={{ gap: 10 }}>
              <Text style={s.heading}>{g.heading}</Text>
              {g.items.map((it) => (
                <AgendaCard key={it.key} item={it} people={people} onPress={it.eventId ? () => onOpenEvent(it.eventId!) : undefined} />
              ))}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  forYouCard: { backgroundColor: colors.peachSoft, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.peach, padding: 16, gap: 14 },
  forYouTag: { alignSelf: 'flex-start', backgroundColor: colors.terracotta, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  forYouTagText: { fontSize: typeFamily.small, fontWeight: '800', color: colors.white },
  familyLabel: { fontSize: typeFamily.label, fontWeight: '700', color: colors.inkSoft },
  heading: { fontSize: typeFamily.label, fontWeight: '700', color: colors.inkSoft },
  empty: { fontSize: typeFamily.body, color: colors.inkSoft },
  importantRow: { gap: 2, borderBottomWidth: 1, borderBottomColor: colors.peach, paddingBottom: 10 },
  importantTitle: { fontSize: typeFamily.body, fontWeight: '700', color: colors.ink, fontFamily: fonts.display },
  importantStatus: { fontSize: typeFamily.small, fontWeight: '700', color: colors.green },
  importantStatusUrgent: { color: colors.danger },
});
