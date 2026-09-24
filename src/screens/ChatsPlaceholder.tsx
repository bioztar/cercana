import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Person } from '../lib/types';
import { Avatar } from '../components/ui';
import { colors, fonts, type, typeFamily } from '../theme';

type Props = { people: Person[]; big?: boolean }; // `big`: the patient's larger type scale

/** Light placeholder (Vitaly, 2026-09-24 15:50: "don't spend time") — 1:1 chats are v2. */
export function ChatsPlaceholder({ people, big }: Props) {
  const t = big ? type : typeFamily;
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={[s.title, { fontSize: t.title }]}>Chats</Text>
      <Text style={[s.note, { fontSize: t.body }]}>Coming soon — use "Send to family" instead for now.</Text>
      {people.map((p) => (
        <View key={p.id} style={s.row}>
          <Avatar uri={p.photo_url} name={p.name} size={big ? 56 : 48} group={people.map((x) => x.name)} />
          <Text style={[s.name, { fontSize: t.body }]}>{p.name}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 700, width: '100%', alignSelf: 'center', gap: 16 },
  title: { fontFamily: fonts.display, color: colors.ink },
  note: { color: colors.inkSoft, lineHeight: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, opacity: 0.7 },
  name: { fontWeight: '700', color: colors.ink },
});
