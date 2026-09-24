import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ImportantEvent } from '../lib/types';
import { cardText } from '../lib/important';
import { BigButton } from './ui';
import { colors } from '../theme';

type Props = {
  event: ImportantEvent | null; // next important event that isn't over yet (important.nextImportant)
  due: boolean; // a check-in is due for it (important.dueCheckin)
  onOpenCheck: () => void; // opens MomCheck
  now?: Date;
};

/** Patient home slot (PatientHome's `importantCard` prop, above the feed, see Main.png). Renders
 * nothing when there is no upcoming important event. */
export function ImportantCard({ event, due, onOpenCheck, now = new Date() }: Props) {
  if (!event) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={due ? `${cardText(event, now)}. ${event.title} check-in due.` : cardText(event, now)}
      onPress={due ? onOpenCheck : undefined}
      style={s.card}
    >
      <Text style={s.badge}>Important</Text>
      <Text style={s.title}>{cardText(event, now)}</Text>
      {due ? <BigButton label="Did you go?" tone="terracotta" onPress={onOpenCheck} style={s.btn} /> : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.peachSoft, borderRadius: 20, padding: 18, marginBottom: 24,
    borderWidth: 2, borderColor: colors.terracotta,
  },
  badge: { fontSize: 16, fontWeight: '800', color: colors.terracottaDark, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: '800', color: colors.ink },
  btn: { marginTop: 14 },
});
