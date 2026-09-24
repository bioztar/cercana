import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, TARGET } from '../theme';

type Props = { label: string; holdingLabel?: string; holdMs?: number; onComplete: () => void };

/**
 * Press-and-hold guard for actions a confused user must not trigger by accident
 * (e.g. Settings on the patient's phone). A plain tap does nothing but explain.
 */
export function HoldButton({ label, holdingLabel = 'Keep holding…', holdMs = 2000, onComplete }: Props) {
  const [progress, setProgress] = useState(0); // 0..1
  const [tapped, setTapped] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setProgress(0);
  };

  useEffect(() => stop, []);

  const start = () => {
    setTapped(false);
    startedAt.current = Date.now();
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - startedAt.current) / holdMs);
      setProgress(p);
      if (p >= 1) {
        stop();
        onComplete();
      }
    }, 50);
  };

  const release = () => {
    const held = Date.now() - startedAt.current;
    const wasHolding = timer.current !== null;
    stop();
    if (wasHolding && held < 400) setTapped(true); // a quick tap: explain instead of acting
  };

  return (
    <View style={s.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. Press and hold for two seconds.`}
        onPressIn={start}
        onPressOut={release}
        style={s.btn}
      >
        <View style={[s.fill, { width: `${progress * 100}%` }]} />
        <Text style={s.text}>{progress > 0 ? holdingLabel : label}</Text>
      </Pressable>
      {tapped ? <Text style={s.hint}>This is for family. Press and hold to open.</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', marginTop: 32 },
  btn: {
    minHeight: TARGET, minWidth: 260, borderRadius: 16, borderWidth: 2, borderColor: colors.inkSoft,
    backgroundColor: colors.card, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24,
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.warm },
  text: { fontSize: 20, fontWeight: '600', color: colors.inkSoft },
  hint: { fontSize: 18, color: colors.inkSoft, marginTop: 8 },
});
