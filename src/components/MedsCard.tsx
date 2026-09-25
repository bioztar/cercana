import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import type { Dose } from '../lib/meds';
import { nextDose, STATUS_ICON } from '../lib/meds';
import { timeLabel } from '../lib/briefing';
import { BigButton } from './ui';
import { colors, fonts } from '../theme';

type Props = {
  doses: Dose[]; // today's doses, soonest first (meds.todaysDoses)
  onOpenCheck: (dose: Dose) => void; // opens MedsCheck for a due dose
};

/** Patient home slot, at the TOP of the feed (PatientHome renders it above importantCard).
 * Next dose + a small row of today's doses with their icon. Nothing renders without any medicines. */
export function MedsCard({ doses, onOpenCheck }: Props) {
  if (doses.length === 0) return null;
  const next = nextDose(doses);

  return (
    <View style={s.card}>
      <Text style={s.title}>Medicines today</Text>
      {next ? (
        <Text style={s.next}>
          Next: {next.medication.name} at {timeLabel(next.scheduledFor)}
        </Text>
      ) : (
        <Text style={s.next}>All done for today</Text>
      )}
      <View style={s.row}>
        {doses.map((d) => (
          <Pressable
            key={d.key}
            accessibilityRole="button"
            accessibilityLabel={`${d.medication.name} at ${timeLabel(d.scheduledFor)}, ${d.status}`}
            onPress={() => (d.status === 'due' ? onOpenCheck(d) : undefined)}
            style={s.chip}
          >
            <Text style={s.chipIcon}>{STATUS_ICON[d.status]}</Text>
            <Text style={s.chipTime}>{timeLabel(d.scheduledFor)}</Text>
          </Pressable>
        ))}
      </View>
      {next?.status === 'due' && (
        <BigButton label={`Did you take your ${next.medication.name}?`} tone="terracotta" onPress={() => onOpenCheck(next)} style={s.btn} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.peachSoft, borderRadius: 20, padding: 18, marginBottom: 24,
    borderWidth: 2, borderColor: colors.terracotta, gap: 8,
  },
  title: { fontSize: 20, fontWeight: '800', color: colors.terracottaDark },
  next: { fontSize: 24, fontWeight: '800', color: colors.ink, fontFamily: fonts.display },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: colors.line,
  },
  chipIcon: { fontSize: 18 },
  chipTime: { fontSize: 16, fontWeight: '700', color: colors.ink },
  btn: { marginTop: 6 },
});
