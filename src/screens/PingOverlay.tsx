import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Person, Ping } from '../lib/types';
import { say, stopSaying } from '../lib/speech';
import { spokenPing } from '../lib/util';
import { Avatar, BigButton } from '../components/ui';
import { colors, fonts } from '../theme';

type Props = { ping: Ping; people: Person[]; onDismiss: () => void };

export function PingOverlay({ ping, people, onDismiss }: Props) {
  const from = ping.from_name ?? 'Someone';
  const sender =
    people.find((p) => p.id === ping.person_id) ??
    people.find((p) => p.name.trim().toLowerCase() === from.trim().toLowerCase());

  useEffect(() => {
    say(spokenPing(from, ping.message));
    return stopSaying;
  }, [ping.id, from, ping.message]);

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <Avatar uri={sender?.photo_url} name={from} size={220} />
      <Text style={s.from}>{from}</Text>
      <Text style={s.msg}>{ping.message}</Text>
      <BigButton label="OK" onPress={onDismiss} style={s.ok} />
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 20,
  },
  from: { fontSize: 48, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  msg: { fontSize: 40, color: colors.ink, textAlign: 'center', lineHeight: 52, fontFamily: fonts.display },
  ok: { alignSelf: 'stretch', maxWidth: 480, width: '100%', minHeight: 88, marginTop: 12 },
});
