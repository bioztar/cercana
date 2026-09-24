import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { uploadMedia } from '../lib/api';
import { startTranscribing, type Transcriber } from '../lib/transcribe';
import type { VoiceClip } from '../lib/types';
import { colors, radius, type } from '../theme';

type Props = {
  onDone: (clip: VoiceClip) => void;
  onError?: (message: string) => void;
  /** Big = the hero circle; compact = a round mic beside a field. */
  size?: 'big' | 'compact';
  idleLabel?: string;
  disabled?: boolean;
  /** false = skip uploadMedia and hand back the local file uri (AssistantChat: local-only, no network). */
  upload?: boolean;
};

const HOLD_MS = 700; // held at least this long → release stops; a shorter press is a tap and toggles

/**
 * One record control for the whole app. Hold it and let go to stop, or tap once to start and tap
 * again to stop. Uploads to `media` and hands back url + seconds + transcript (empty if the device
 * cannot transcribe).
 */
export function VoiceRecorder({ onDone, onError, size = 'big', idleLabel, disabled, upload = true }: Props) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  const pressedAt = useRef(0);
  const transcriber = useRef<Transcriber | null>(null);
  const active = useRef(false); // synchronous guard: press events can outrun state updates

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  const fail = (e: unknown) => {
    active.current = false;
    setRecording(false);
    setBusy(false);
    onError?.(e instanceof Error ? e.message : String(e));
  };

  const start = async () => {
    active.current = true;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) throw new Error('The microphone is off. Please allow it, then try again.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedAt.current = Date.now();
      setLive('');
      setElapsed(0);
      setRecording(true);
      transcriber.current = startTranscribing(setLive);
    } catch (e) {
      fail(e);
    }
  };

  const stop = async () => {
    setRecording(false);
    setBusy(true);
    try {
      const seconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000));
      const heard = (await transcriber.current?.stop()) ?? '';
      transcriber.current = null;
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      if (!recorder.uri) throw new Error('Nothing was recorded. Please try again.');
      const url = upload ? await uploadMedia(recorder.uri, 'audio') : recorder.uri;
      active.current = false;
      setBusy(false);
      onDone({ url, seconds, transcript: heard.trim() });
    } catch (e) {
      fail(e);
    }
  };

  const pressIn = () => {
    if (disabled || busy) return;
    pressedAt.current = Date.now();
    if (active.current) void stop(); // second tap ends a tap-started recording
    else void start();
  };

  const pressOut = () => {
    // Held long enough = hold-to-talk: letting go ends it. A short tap leaves it running.
    if (recording && Date.now() - pressedAt.current >= HOLD_MS) void stop();
  };

  const big = size === 'big';
  const label = busy ? 'Saving…' : recording ? 'Listening… tap to finish' : idleLabel ?? 'Hold or tap to speak';
  const dim = big ? 132 : 56;

  return (
    <View style={big ? s.bigWrap : s.compactWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record your voice'}
        onPressIn={pressIn}
        onPressOut={pressOut}
        disabled={disabled}
        style={[
          big && s.halo,
          big && recording && s.haloOn,
          { opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <View style={[s.mic, { width: dim, height: dim, borderRadius: dim / 2 }, recording && s.micOn]}>
          {busy ? <ActivityIndicator color={colors.white} /> : <Text style={{ fontSize: dim / 2.4 }}>{recording ? '■' : '🎙'}</Text>}
        </View>
      </Pressable>
      {big ? <Text style={[s.label, recording && { color: colors.terracotta }]}>{label}</Text> : null}
      {recording ? <Text style={s.timer}>{`0:${String(elapsed).padStart(2, '0')}`}</Text> : null}
      {big && live ? <Text style={s.live}>{`“${live}”`}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  bigWrap: { alignItems: 'center', gap: 12 },
  compactWrap: { alignItems: 'center' },
  halo: {
    width: 220, height: 220, borderRadius: 110, backgroundColor: colors.peachSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  haloOn: { backgroundColor: colors.peach },
  mic: { backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center', borderWidth: 0 },
  micOn: { backgroundColor: colors.danger },
  label: { fontSize: type.name - 4, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  timer: { fontSize: type.label, fontWeight: '700', color: colors.inkSoft, borderRadius: radius.pill },
  live: { fontSize: type.body, color: colors.inkSoft, textAlign: 'center', lineHeight: 32, paddingHorizontal: 12 },
});
