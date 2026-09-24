import React, { useEffect, useState } from 'react';
import { Platform, StyleSheet, Switch, View } from 'react-native';
import { Text } from './Text';
import { keepAliveEnabled, setKeepAliveEnabled } from '../lib/keepAlive';
import { colors, fonts } from '../theme';

/** Patient Settings row: "Keep listening for family" — the locked-phone keep-alive (see
 * src/lib/keepAlive.ts). On by default; off stops the silent background loop. */
export function KeepListeningSettings() {
  const [on, setOn] = useState<boolean | null>(null);

  useEffect(() => { void keepAliveEnabled().then(setOn); }, []);

  if (on === null || Platform.OS === 'web') return null; // web has nothing to keep alive while locked

  const toggle = (value: boolean) => {
    setOn(value);
    void setKeepAliveEnabled(value);
  };

  return (
    <View style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.title}>Keep listening for family</Text>
        <Text style={s.sub}>Hear voice messages right away, even with the phone locked. Uses battery.</Text>
      </View>
      <Switch value={on} onValueChange={toggle} />
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16,
  },
  title: { fontSize: 20, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 15, color: colors.inkSoft, marginTop: 2 },
});
