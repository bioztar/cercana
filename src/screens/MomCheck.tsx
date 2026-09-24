import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import type { Checkin, CheckinAnswer, ImportantEvent } from '../lib/types';
import { submitCheckin, uploadMedia } from '../lib/api';
import { ANSWER_LABEL, checkQuestion } from '../lib/important';
import { BigButton, ErrorText } from '../components/ui';
import { colors } from '../theme';

type Props = { circleId: string; event: ImportantEvent; existing: Checkin | null; onDone: () => void };

const ANSWERS: CheckinAnswer[] = ['went', 'missed', 'rescheduled'];

/** Patient full-screen check-in, opened from a tapped reminder notification or a due card on
 * PatientHome (like PingOverlay). Matches design/mockups/MomCheck.png. */
export function MomCheck({ circleId, event, existing, onDone }: Props) {
  const [answer, setAnswer] = useState<CheckinAnswer | null>(existing?.answer ?? null);
  const [audio, setAudio] = useState<string | null>(existing?.note_audio_url ?? null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleRecord = () => guard(async () => {
    if (recording) {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setRecording(false);
      if (recorder.uri) {
        const url = await uploadMedia(recorder.uri, 'audio');
        setAudio(url);
        if (answer) await submitCheckin(circleId, event.id, answer, url); // already answered: attach the note now
      }
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission was not granted.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  });

  const choose = (a: CheckinAnswer) => guard(async () => {
    await submitCheckin(circleId, event.id, a, audio);
    setAnswer(a);
  });

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={{ alignSelf: 'stretch', maxWidth: 480, width: '100%' }}>
        <Text style={s.badge}>Important</Text>
        <Text style={s.eventTitle}>{event.title}</Text>
        <Text style={s.question}>{checkQuestion(event.title)}</Text>
        <View style={s.answers}>
          {ANSWERS.map((a) => (
            <BigButton
              key={a}
              label={answer === a ? `✓ ${ANSWER_LABEL[a]}` : ANSWER_LABEL[a]}
              tone={answer === a ? 'terracotta' : 'plain'}
              onPress={() => choose(a)}
              disabled={busy}
            />
          ))}
        </View>
        {answer ? <Text style={s.savedNote}>Saved — your family will see your answer.</Text> : null}
        <BigButton
          label={recording ? 'Stop recording' : audio ? 'Voice note added ✓' : 'Record voice note (optional)'}
          tone="plain"
          onPress={toggleRecord}
          disabled={busy}
          style={s.record}
        />
        <ErrorText message={error} />
        {answer ? <BigButton label="Done" onPress={onDone} style={s.done} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  badge: {
    alignSelf: 'flex-start', fontSize: 16, fontWeight: '800', color: colors.terracottaDark,
    backgroundColor: colors.peach, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginBottom: 12,
  },
  eventTitle: { fontSize: 34, fontWeight: '800', color: colors.ink, marginBottom: 20 },
  question: { fontSize: 30, fontWeight: '800', color: colors.ink, marginBottom: 20 },
  answers: { gap: 14, marginBottom: 16 },
  savedNote: { fontSize: 18, color: colors.green, fontWeight: '700', marginBottom: 16 },
  record: { marginTop: 4 },
  done: { marginTop: 20 },
});
