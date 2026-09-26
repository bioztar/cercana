import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, ErrorText, Field } from '../components/ui';
import { askAssistant } from '../lib/api';
import { deviceTz } from '../lib/voice';
import type { AssistantProposal } from '../lib/types';
import { colors, type } from '../theme';

type Props = {
  circleId: string;
  speakerPersonId: string | null; // null = the patient herself
  patientName: string;
  /** Family mode: a relative or doctor dictating an event for the patient. */
  family?: boolean;
  onDone: (transcript: string, proposal: AssistantProposal | null) => void;
  onCancel: () => void;
};

/** "Say what and when": one recording (or typed sentence) → `assistant` mode 'dictate' → prefilled EventConfirm. */
export function EventVoice({ circleId, speakerPersonId, patientName, family, onDone, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');

  const dictate = async (text: string) => {
    const t = text.trim();
    if (!t) { setError(family ? "I couldn't hear that. Please try again, or type it." : "I couldn't hear that. Please try again."); return; }
    setBusy(true);
    setError(null);
    try {
      const a = await askAssistant({
        circle_id: circleId, speaker_person_id: speakerPersonId, mode: 'dictate', text: t, history: [],
        now: new Date().toISOString(), tz: deviceTz(),
      });
      onDone(t, a.proposal ?? null);
    } catch (e) {
      console.warn('dictate failed', e);
      onDone(t, null); // fall back to the manual form with the words already in the title
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Pressable accessibilityRole="button" onPress={onCancel}><Text style={s.cancel}>← Cancel</Text></Pressable>
      <Text style={s.title}>{family ? '🎤 Dictate an event' : 'Say what and when'}</Text>
      <Text style={s.hint}>
        {family
          ? `For example: “${patientName} has cardiology on the 3rd at 9:30 at Hospital Clínic, bring the blood test”`
          : 'For example: “Doctor on Thursday at ten in the morning”'}
      </Text>
      <VoiceRecorder circleId={circleId} disabled={busy} onDone={(clip) => void dictate(clip.transcript)} onError={setError}
        idleLabel={busy ? 'Thinking…' : 'Tap to speak'} />
      <ErrorText message={error} />
      {family && (
        <View style={s.typed}>
          <Field label="Or type it" value={typed} onChangeText={setTyped} placeholder="Cardiology on the 3rd at 9:30" onSubmitEditing={() => void dictate(typed)} />
          <BigButton label="Add" onPress={() => void dictate(typed)} busy={busy} disabled={!typed.trim()} />
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={() => onDone('', null)} disabled={busy}>
        <Text style={s.skip}>Fill in without voice</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 20, gap: 16, alignItems: 'center', maxWidth: 700, width: '100%', alignSelf: 'center' },
  cancel: { alignSelf: 'flex-start', fontSize: 18, fontWeight: '700', color: colors.terracotta, minHeight: 48, paddingVertical: 12 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, alignSelf: 'flex-start' },
  hint: { fontSize: 18, color: colors.inkSoft, alignSelf: 'flex-start', marginBottom: 12 },
  typed: { width: '100%', gap: 4 },
  skip: { fontSize: 18, fontWeight: '700', color: colors.terracotta, marginTop: 20 },
});
