import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useMediaUrl } from '../lib/mediaUrl';
import { BigButton } from './ui';

/** `url` is a stored media path (moments/comments `audio_url`) or a final URL; signed on demand. */
export function VoicePlayer({ url }: { url: string }) {
  const src = useMediaUrl(url);
  const player = useAudioPlayer(src ?? null);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    if (!src) return;
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration)) {
      void player.seekTo(0);
    }
    player.play();
  };
  return (
    <BigButton
      tone="terracotta"
      label={status.playing ? 'Stop voice message' : 'Play voice message'}
      onPress={toggle}
      busy={src === undefined}
    />
  );
}
