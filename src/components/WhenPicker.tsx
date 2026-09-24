import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { rangeLabel, singleDay, weekendRange, type DayRange } from '../lib/voice';
import { colors, TARGET, type } from '../theme';

type Props = { value: DayRange | null; onChange: (r: DayRange) => void };

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/**
 * Big quick choices for "when": this weekend, next weekend, or another day picked by stepping
 * one day at a time — never a typed date, so it stays usable with no keyboard.
 */
export function WhenPicker({ value, onChange }: Props) {
  const now = new Date();
  const thisWeekend = weekendRange(now, 0);
  const nextWeekend = weekendRange(now, 1);
  const [otherDay, setOtherDay] = useState(addDays(now, 1));
  const [pickingOther, setPickingOther] = useState(false);

  const sameRange = (a: DayRange, b: DayRange) => a.first.getTime() === b.first.getTime() && a.last.getTime() === b.last.getTime();
  const pick = (r: DayRange) => { setPickingOther(false); onChange(r); };

  const options: { key: string; label: string; range: DayRange }[] = [
    { key: 'this', label: 'This weekend', range: thisWeekend },
    { key: 'next', label: 'Next weekend', range: nextWeekend },
  ];

  return (
    <View style={s.wrap}>
      {options.map((o) => (
        <Pressable key={o.key} accessibilityRole="button" onPress={() => pick(o.range)}
          style={[s.row, value && sameRange(value, o.range) && !pickingOther && s.rowOn]}>
          <Text style={s.rowLabel}>{o.label}</Text>
          <Text style={s.rowDate}>{rangeLabel(o.range)}</Text>
        </Pressable>
      ))}
      <Pressable accessibilityRole="button" onPress={() => { setPickingOther(true); pick(singleDay(otherDay)); }}
        style={[s.row, pickingOther && s.rowOn]}>
        <Text style={s.rowLabel}>Another day</Text>
        <Text style={s.rowDate}>{rangeLabel(singleDay(otherDay))}</Text>
      </Pressable>
      {pickingOther && (
        <View style={s.stepper}>
          <Pressable accessibilityRole="button" accessibilityLabel="Earlier day"
            onPress={() => { const d = addDays(otherDay, -1); setOtherDay(d); pick(singleDay(d)); }} style={s.stepBtn}>
            <Text style={s.stepText}>◀</Text>
          </Pressable>
          <Text style={s.stepDate}>{rangeLabel(singleDay(otherDay))}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Later day"
            onPress={() => { const d = addDays(otherDay, 1); setOtherDay(d); pick(singleDay(d)); }} style={s.stepBtn}>
            <Text style={s.stepText}>▶</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  row: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowOn: { borderColor: colors.terracotta, backgroundColor: colors.peachSoft },
  rowLabel: { fontSize: type.label, fontWeight: '700', color: colors.ink },
  rowDate: { fontSize: type.label, color: colors.inkSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginTop: 4 },
  stepBtn: { minWidth: TARGET, minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 28, color: colors.terracotta, fontWeight: '800' },
  stepDate: { fontSize: type.name, fontWeight: '800', color: colors.ink, minWidth: 140, textAlign: 'center' },
});
