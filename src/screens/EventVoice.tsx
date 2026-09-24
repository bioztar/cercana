import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { ErrorText } from '../components/ui';
import { colors, type } from '../theme';

type Props = { onDone: (transcript: string, audioUrl: string | null) => void; onCancel: () => void };

/** "Say what and when": one recording, then straight to EventConfirm to fix the title and pick a day. */
export function EventVoice({ onDone, onCancel }: Props) {
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={s.wrap}>
      <Pressable accessibilityRole="button" onPress={onCancel}><Text style={s.cancel}>← Cancel</Text></Pressable>
      <Text style={s.title}>Say what and when</Text>
      <Text style={s.hint}>For example: “Doctor on Thursday at ten in the morning”</Text>
      <VoiceRecorder onDone={(clip) => onDone(clip.transcript, clip.url)} onError={setError} idleLabel="Tap to speak" />
      <ErrorText message={error} />
      <Pressable accessibilityRole="button" onPress={() => onDone('', null)}>
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
  skip: { fontSize: 18, fontWeight: '700', color: colors.terracotta, marginTop: 20 },
});
