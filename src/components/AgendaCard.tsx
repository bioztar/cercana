import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { Person } from '../lib/types';
import { dateTile, type AgendaItem } from '../lib/calendarView';
import { Avatar } from './ui';
import { colors, fonts, radius, typeFamily } from '../theme';

const NEW_WITHIN_MS = 24 * 60 * 60 * 1000; // "Just added" for anything created in the last day

type Props = { item: AgendaItem; people: Person[]; onPress?: () => void };

/** One row of the Calendar screen (shared by the patient's and the family's Calendar tab): date
 * tile, title, participant avatars, "Just added" highlight for a same-day event just created. */
export function AgendaCard({ item, people, onPress }: Props) {
  const tile = dateTile(item);
  const justAdded = item.kind === 'event' && Date.now() - item.start.getTime() < NEW_WITHIN_MS && item.start <= new Date();
  const spans = tile.top.length > 3; // "SAT–SUN" etc. needs a wider tile and smaller type than "SAT"
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      disabled={!onPress}
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
