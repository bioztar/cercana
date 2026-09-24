import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getBriefSettings, updateBriefSettings } from '../lib/api';
import { BigButton, ErrorText } from './ui';
import { colors } from '../theme';

type Props = {
  circleId: string;
  canEdit: boolean; // permissions.can(actor, { type: 'editBrief' }) — Mom, or lead/admin
  onHearNow: () => void; // speaks the full brief right now (caller has the events/photos to build it)
};

const clampMinutes = (h: number, m: number) => {
  const total = ((h * 60 + m) % 1440 + 1440) % 1440;
  return [Math.floor(total / 60), total % 60] as const;
};
const fmt = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

/** Self-contained settings panel for the scheduled morning brief. Rendered by Settings.tsx's slot
 * for both the patient and family roles; disabled (read-only) when `canEdit` is false. */
export function MorningBriefSettings({ circleId, canEdit, onHearNow }: Props) {
  const [time, setTime] = useState('09:00');
  const [enabled, setEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBriefSettings(circleId).then((s) => {
      setTime(s.brief_time);
      setEnabled(s.brief_enabled);
    }).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [circleId]);

  const save = (next: { time?: string; enabled?: boolean }) => {
    const brief_time = next.time ?? time;
    const brief_enabled = next.enabled ?? enabled;
    setTime(brief_time);
    setEnabled(brief_enabled);
    setBusy(true);
    setError(null);
    updateBriefSettings(circleId, { brief_time, brief_enabled })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setBusy(false));
  };

  const nudge = (deltaMin: number) => {
    const [h, m] = time.split(':').map(Number);
    const [nh, nm] = clampMinutes(h, m + deltaMin);
    save({ time: fmt(nh, nm) });
  };

  return (
    <View style={s.box}>
      <Text style={s.title}>Morning brief</Text>
      <Text style={s.sub}>
        {enabled ? `A daily reminder at ${time} that speaks the day's news.` : 'Off — no daily reminder.'}
      </Text>
      <View style={s.row}>
        <Pressable onPress={() => nudge(-15)} disabled={!canEdit || busy} accessibilityRole="button" accessibilityLabel="15 minutes earlier"
          style={[s.step, (!canEdit || busy) && s.disabled]}>
          <Text style={s.stepText}>−15m</Text>
        </Pressable>
        <Text style={s.time}>{time}</Text>
        <Pressable onPress={() => nudge(15)} disabled={!canEdit || busy} accessibilityRole="button" accessibilityLabel="15 minutes later"
          style={[s.step, (!canEdit || busy) && s.disabled]}>
          <Text style={s.stepText}>+15m</Text>
        </Pressable>
      </View>
      <Pressable
        onPress={() => save({ enabled: !enabled })}
        disabled={!canEdit || busy}
        accessibilityRole="switch"
        accessibilityState={{ checked: enabled, disabled: !canEdit }}
        style={[s.toggle, enabled && s.toggleOn, (!canEdit || busy) && s.disabled]}
      >
        <Text style={[s.toggleText, enabled && { color: colors.white }]}>{enabled ? 'On' : 'Off'}</Text>
      </Pressable>
      <ErrorText message={error} />
      <BigButton label="Hear it now" tone="plain" onPress={onHearNow} style={s.hear} />
      {!canEdit ? <Text style={s.hint}>Only Mom or family admins can change this.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  title: { fontSize: 18, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 15, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  time: { fontSize: 28, fontWeight: '800', color: colors.ink, minWidth: 88, textAlign: 'center' },
  step: {
    minHeight: 48, minWidth: 64, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
    borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg,
  },
  stepText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  toggle: {
    alignSelf: 'flex-start', minHeight: 44, minWidth: 80, alignItems: 'center', justifyContent: 'center',
    borderRadius: 999, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.bg, paddingHorizontal: 18,
  },
  toggleOn: { backgroundColor: colors.green, borderColor: colors.green },
  toggleText: { fontSize: 16, fontWeight: '700', color: colors.ink },
  disabled: { opacity: 0.5 },
  hear: { alignSelf: 'flex-start', paddingHorizontal: 20, minHeight: 44 },
  hint: { fontSize: 13, color: colors.inkSoft, fontStyle: 'italic' },
});
