import React from 'react';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { BigButton } from './ui';

export function VoicePlayer({ url }: { url: string }) {
  const player = useAudioPlayer(url);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
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
    />
  );
}
