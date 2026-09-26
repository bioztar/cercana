import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { formatTrend, latestDigest, TRENDS, trendBars } from '../lib/digest';
import type { Digest } from '../lib/types';
import { colors, fonts, radius } from '../theme';
import { Text } from './Text';

const BAR_MAX = 44;

/** "Today with <patient>": the evening note. Tap to see the last 14 days as simple bars. */
export function DigestCard({ digests, patientName }: { digests: Digest[]; patientName: string }) {
  const [open, setOpen] = useState(false);
  const latest = latestDigest(digests);
  if (!latest) return null;
  const distressToday = latest.metrics.distress > 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Today with ${patientName}. ${open ? 'Hide' : 'Show'} the last 14 days`}
      onPress={() => setOpen((o) => !o)}
      style={s.card}
    >
      <Text style={s.title}>Today with {patientName}</Text>
      <Text style={s.note}>{latest.note}</Text>
      {distressToday && (
        <Text style={s.calm}>The assistant noticed {patientName} seemed upset today. A call or a message would help.</Text>
      )}
      {latest.watch && <Text style={s.watch}>{latest.watch}</Text>}
      <Text style={s.toggle}>{open ? 'Hide the last 14 days ▴' : 'Show the last 14 days ▾'}</Text>

      {open && (
        <View style={s.trends}>
          {TRENDS.map(({ key, label, percent }) => {
            const bars = trendBars(digests, key);
            return (
              <View key={key} style={s.trend}>
                <View style={s.trendHead}>
                  <Text style={s.trendLabel}>{label}</Text>
                  <Text style={s.trendNow}>today {formatTrend(latest.metrics[key], percent)}</Text>
                </View>
                <View style={s.bars} accessibilityLabel={`${label}, last 14 days`}>
                  {bars.map((b, i) => (
                    <View key={b.day} style={s.barCol}>
                      <View
                        style={[
                          s.bar,
                          { height: b.value === null ? 2 : Math.max(3, Math.round(b.ratio * BAR_MAX)) },
                          i === bars.length - 1 && s.barToday,
                          b.value === null && s.barEmpty,
                        ]}
                      />
                    </View>
                  ))}
                </View>
              </View>
            );
          })}
          <Text style={s.foot}>Each bar is one evening. Nothing here is a diagnosis; it only shows change over time.</Text>
        </View>
      )}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  title: { fontSize: 22, fontFamily: fonts.display, color: colors.ink },
  note: { fontSize: 18, lineHeight: 27, color: colors.ink },
  calm: { fontSize: 17, lineHeight: 25, color: colors.ink, backgroundColor: colors.peachSoft, borderRadius: radius.md, padding: 12 },
  watch: { fontSize: 16, lineHeight: 24, color: colors.terracottaDark, backgroundColor: colors.peachSoft, borderRadius: radius.md, padding: 12 },
  toggle: { fontSize: 16, fontWeight: '700', color: colors.terracottaDark, minHeight: 32 },
  trends: { gap: 16, marginTop: 4 },
  trend: { gap: 6 },
  trendHead: { flexDirection: 'row', justifyContent: 'space-between' },
  trendLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  trendNow: { fontSize: 16, color: colors.inkSoft },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: BAR_MAX },
  barCol: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 2, backgroundColor: colors.line },
  barToday: { backgroundColor: colors.terracotta },
  barEmpty: { opacity: 0.5 },
  foot: { fontSize: 14, color: colors.inkSoft },
});
