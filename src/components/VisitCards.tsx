import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { BigButton } from './ui';
import { formatDate } from '../lib/dates';
import { pendingCount } from '../lib/visit';
import { say } from '../lib/speech';
import type { Visit } from '../lib/types';
import { colors, fonts, typeFamily } from '../theme';

/** Family Feed card: "Doctor visit summary", newest visit first, with how many changes await a decision. */
export function FamilyVisitCard({ visit, onOpen }: { visit: Visit; onOpen: (id: string) => void }) {
  const pending = pendingCount(visit);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Doctor visit summary, ${formatDate(new Date(visit.created_at))}`}
      onPress={() => onOpen(visit.id)}
      style={s.card}
    >
      <Text style={s.title}>🩺 Doctor visit summary</Text>
      <Text style={s.date}>{formatDate(new Date(visit.created_at))}</Text>
      <Text style={s.body} numberOfLines={3}>{visit.summary}</Text>
      <Text style={[s.badge, pending === 0 && { color: colors.green }]}>
        {pending > 0 ? `${pending} change${pending === 1 ? '' : 's'} to review →` : 'All reviewed →'}
      </Text>
    </Pressable>
  );
}

/** Patient home slot (above the medicines card): the gentle summary, read aloud on tap. */
export function PatientVisitCard({ visit }: { visit: Visit }) {
  return (
    <View style={[s.card, s.big]}>
      <Text style={[s.title, s.bigTitle]}>🩺 Your doctor visit</Text>
      <Text style={s.bigBody}>{visit.patient_summary}</Text>
      <BigButton label="🔊 Hear it" tone="terracotta" onPress={() => say(visit.patient_summary)} />
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.peachSoft, borderRadius: 20, padding: 16, gap: 6, marginBottom: 16,
    borderWidth: 2, borderColor: colors.terracotta,
  },
  title: { fontSize: typeFamily.title, fontFamily: fonts.display, color: colors.terracottaDark },
  date: { fontSize: typeFamily.label, color: colors.inkSoft },
  body: { fontSize: typeFamily.body + 1, lineHeight: 25, color: colors.ink },
  badge: { fontSize: typeFamily.body, fontWeight: '800', color: colors.terracotta, marginTop: 4 },
  big: { gap: 14, padding: 18, marginBottom: 24 },
  bigTitle: { fontSize: 26 },
  bigBody: { fontSize: 24, lineHeight: 34, color: colors.ink, fontFamily: fonts.display },
});
