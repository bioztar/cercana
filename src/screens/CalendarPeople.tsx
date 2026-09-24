import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Person } from '../lib/types';
import { Avatar, BigButton } from '../components/ui';
import { colors } from '../theme';

type Props = {
  calendarLabel: string;
  people: Person[];
  busy: boolean;
  onBack: () => void;
  onConnect: (personIds: string[]) => void;
};

/** Step 2 of connecting an iPhone calendar: who usually takes part (→ `calendar_people`, reused as
 * the default cast for every event from this calendar; per-event override is optional, see
 * CalEvent.png). Matches design/mockups/CalPeople.png. */
export function CalendarPeople({ calendarLabel, people, busy, onBack, onConnect }: Props) {
  const [chosen, setChosen] = useState<string[]>(people.map((p) => p.id)); // everyone, by default

  const toggle = (id: string) =>
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button" style={s.back} disabled={busy}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>
      <Text style={s.title}>Who usually takes part?</Text>
      <Text style={s.sub}>
        These people will be added to every event in the "{calendarLabel}" calendar. You can change this for any event.
      </Text>
      <View style={s.list}>
        {people.map((p) => (
          <Pressable key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen.includes(p.id) }} style={s.row}>
            <Avatar uri={p.photo_url} name={p.name} size={44} />
            <Text style={s.rowName}>{p.name}</Text>
            <View style={[s.check, chosen.includes(p.id) && s.checkOn]}>
              {chosen.includes(p.id) ? <Text style={s.checkMark}>✓</Text> : null}
            </View>
          </Pressable>
        ))}
        {people.length === 0 ? <Text style={s.sub}>Add people first, then connect a calendar.</Text> : null}
      </View>
      <BigButton label={`Connect "${calendarLabel}"`} onPress={() => onConnect(chosen)} busy={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  backText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: colors.inkSoft, marginBottom: 16, lineHeight: 21 },
  list: { gap: 4, marginBottom: 20 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 6,
  },
  rowName: { flex: 1, fontSize: 18, fontWeight: '700', color: colors.ink },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  checkMark: { color: colors.white, fontWeight: '800' },
});
