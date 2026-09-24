import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text';
import type { Moment, Person } from '../lib/types';
import { PersonPhotos } from './PersonPhotos';
import { Avatar } from '../components/ui';
import { colors, fonts, MAX_WIDTH, type } from '../theme';

const PAD = 20;
const GAP = 16;

type Props = { people: Person[]; moments: Moment[] };

/** Mom's "People" tab (Vitaly, 2026-09-24 15:40/15:50): the faces grid, tap → their photos. */
export function PatientPeople({ people, moments }: Props) {
  const { width } = useWindowDimensions();
  const cols = width < 700 ? 2 : width < 1000 ? 3 : 4;
  const inner = Math.min(width, MAX_WIDTH) - 2 * PAD;
  const cardWidth = Math.floor((inner - GAP * (cols - 1)) / cols);
  const names = people.map((p) => p.name);
  const [open, setOpen] = useState<Person | null>(null);

  if (open) return <PersonPhotos person={open} moments={moments} people={people} onBack={() => setOpen(null)} />;

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>People</Text>
      {people.length === 0 ? (
        <Text style={s.empty}>Your family will add the people you love here.</Text>
      ) : (
        <View style={s.grid}>
          {people.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              accessibilityLabel={`${p.name}${p.relation ? `, ${p.relation}` : ''}, see their photos`}
              onPress={() => setOpen(p)}
              style={[s.card, { width: cardWidth }]}
            >
              <Avatar uri={p.photo_url} name={p.name} size={Math.min(220, cardWidth - 28)} group={names} />
              <Text style={s.name} numberOfLines={2}>{p.name}</Text>
              {p.relation ? <Text style={s.relation} numberOfLines={2}>{p.relation}</Text> : null}
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: PAD, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: 20 },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
  empty: { fontSize: type.body, color: colors.inkSoft, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    backgroundColor: colors.card, borderRadius: 20, padding: 12, alignItems: 'center',
    borderWidth: 2, borderColor: colors.line,
  },
  name: { fontSize: type.name, fontFamily: fonts.display, color: colors.ink, marginTop: 10, textAlign: 'center' },
  relation: { fontSize: type.label, color: colors.inkSoft, textAlign: 'center', marginTop: 2 },
});
