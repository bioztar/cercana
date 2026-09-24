import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Person } from '../lib/types';
import { agenda, dateTile, groupByDay, type AgendaItem } from '../lib/calendarView';
import { Avatar, BigButton } from '../components/ui';
import { CalendarsTab } from './CalendarsTab';
import { colors, fonts, radius, typeFamily } from '../theme';
import type { Actor } from '../lib/permissions';

const NEW_WITHIN_MS = 24 * 60 * 60 * 1000; // "Just added" for anything created in the last day

type Props = {
  circleId: string;
  actor: Actor;
  people: Person[];
  events: EventRow[];
  onOpenEvent: (eventId: string) => void;
  onSynced: () => void;
};

export function CalendarTab({ circleId, actor, people, events, onOpenEvent, onSynced }: Props) {
  const [managing, setManaging] = useState(false);
  const now = new Date();
  const items = useMemo(
    () => agenda(events, people, now, new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())),
    [events, people],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` recomputed fresh each render is not a real dependency
  );
  const groups = useMemo(() => groupByDay(items, now), [items]);

  if (managing) {
    return (
      <View style={{ gap: 16 }}>
        <BigButton label="‹ Back to calendar" tone="plain" onPress={() => setManaging(false)} />
        <CalendarsTab circleId={circleId} actor={actor} people={people} onSynced={onSynced} />
      </View>
    );
  }

  return (
    <View style={{ gap: 20 }}>
      <View style={s.top}>
        <Text style={s.title}>Calendar</Text>
        <Text style={s.sub}>What's coming up for the family</Text>
      </View>
      {groups.length === 0 && <Text style={s.sub}>Nothing coming up yet.</Text>}
      {groups.map((g) => (
        <View key={g.key} style={{ gap: 10 }}>
          <Text style={s.heading}>{g.heading}</Text>
          {g.items.map((it) => (
            <AgendaCard key={it.key} item={it} people={people} onPress={() => it.eventId && onOpenEvent(it.eventId)} />
          ))}
        </View>
      ))}
      <BigButton label="Manage calendar sources" tone="plain" onPress={() => setManaging(true)} />
    </View>
  );
}

function AgendaCard({ item, people, onPress }: { item: AgendaItem; people: Person[]; onPress: () => void }) {
  const tile = dateTile(item);
  const justAdded = item.kind === 'event' && Date.now() - item.start.getTime() < NEW_WITHIN_MS && item.start <= new Date();
  const spans = tile.top.length > 3; // "SAT–SUN" etc. needs a wider tile and smaller type than "SAT"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      disabled={!item.eventId}
      style={[s.card, item.kind === 'birthday' && s.cardBirthday, justAdded && s.cardNew]}
    >
      <View style={[s.tile, spans && s.tileWide, (item.kind === 'birthday' || justAdded) && s.tileBirthday]}>
        <Text style={[s.tileTop, spans && s.tileTopWide, (item.kind === 'birthday' || justAdded) && s.tileTopBirthday]} numberOfLines={1}>
          {tile.top}
        </Text>
        <Text style={[s.tileBottom, spans && s.tileBottomWide, (item.kind === 'birthday' || justAdded) && s.tileBottomBirthday]} numberOfLines={1}>
          {tile.bottom}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={s.cardTitle}>{item.title}</Text>
        <View style={s.faces}>
          {item.personIds.slice(0, 4).map((id) => {
            const p = people.find((x) => x.id === id);
            return p ? <Avatar key={id} uri={p.photo_url} name={p.name} size={24} group={people.map((x) => x.name)} /> : null;
          })}
          <Text style={s.names}>{item.personIds.map((id) => people.find((p) => p.id === id)?.name).filter(Boolean).join(', ')}</Text>
        </View>
        {justAdded && (
          <View style={s.tag}>
            <Text style={s.tagText}>Just added</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  top: { gap: 4 },
  title: { fontSize: 32, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: typeFamily.body, color: colors.inkSoft },
  heading: { fontSize: typeFamily.label, fontWeight: '700', color: colors.inkSoft },
  card: {
    flexDirection: 'row', gap: 14, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14,
    borderWidth: 1, borderColor: colors.line, alignItems: 'center',
  },
  cardBirthday: { backgroundColor: colors.peachSoft, borderColor: colors.peach },
  cardNew: { borderWidth: 2, borderColor: colors.terracotta },
  tile: {
    width: 56, height: 56, borderRadius: radius.md, backgroundColor: colors.peachSoft, alignItems: 'center',
    justifyContent: 'center', paddingHorizontal: 2,
  },
  tileWide: { width: 72 },
  tileBirthday: { backgroundColor: colors.terracotta },
  tileTop: { fontSize: 12, fontWeight: '700', color: colors.terracotta },
  tileTopWide: { fontSize: 10 },
  tileTopBirthday: { color: colors.peach },
  tileBottom: { fontSize: 20, fontWeight: '800', color: colors.terracottaDark },
  tileBottomWide: { fontSize: 16 },
  tileBottomBirthday: { color: colors.white },
  cardTitle: { fontSize: typeFamily.label, fontFamily: fonts.display, color: colors.ink },
  faces: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  names: { fontSize: typeFamily.small, color: colors.inkSoft },
  tag: { alignSelf: 'flex-start', backgroundColor: colors.peach, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  tagText: { fontSize: typeFamily.small, fontWeight: '700', color: colors.terracottaDark },
});
