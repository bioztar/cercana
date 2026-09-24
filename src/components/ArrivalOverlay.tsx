import React, { useEffect } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Text } from './Text';
import type { Arrival } from '../lib/arrivals';
import { say, stopSaying } from '../lib/speech';
import { Avatar, BigButton } from './ui';
import { colors, fonts } from '../theme';

type Props = { arrival: Arrival; onDismiss: () => void };

/** Full-screen "she hears it immediately" card: speaks the announcement, then auto-plays the
 * voice note (if any). Same visual pattern as PingOverlay, generalised for moments/comments. */
export function ArrivalOverlay({ arrival, onDismiss }: Props) {
  const player = useAudioPlayer(arrival.audioUrl);
  const status = useAudioPlayerStatus(player);
  const blockedAutoplay = Platform.OS === 'web' && !!arrival.audioUrl && !status.playing && status.currentTime === 0;

  useEffect(() => {
    say(arrival.spoken, () => {
      if (arrival.audioUrl) player.play(); // browsers may block this until the first tap — see the button below
    });
    return stopSaying;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once per arrival, keyed by id
  }, [arrival.id]);

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <Avatar uri={arrival.photoUrl} name={arrival.name} size={160} />
      <Text style={s.from}>{arrival.name}{arrival.relation ? `, ${arrival.relation}` : ''}</Text>
      {arrival.mediaPhotoUrl && <Image source={{ uri: arrival.mediaPhotoUrl }} style={s.photo} resizeMode="cover" />}
      {arrival.body && <Text style={s.msg}>{arrival.body}</Text>}
      {arrival.audioUrl && (
        <BigButton
          tone="terracotta"
          label={blockedAutoplay ? `▶ Play ${arrival.name}'s message` : status.playing ? 'Pause' : '▶ Play again'}
          onPress={() => (status.playing ? player.pause() : player.play())}
        />
      )}
      <BigButton label="OK" onPress={onDismiss} style={s.ok} />
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16,
  },
  from: { fontSize: 36, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  photo: { width: 260, height: 260, borderRadius: 16 },
  msg: { fontSize: 32, color: colors.ink, textAlign: 'center', lineHeight: 42, fontFamily: fonts.display },
  ok: { alignSelf: 'stretch', maxWidth: 480, width: '100%', minHeight: 88, marginTop: 4 },
});
