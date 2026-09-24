import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { sendPing } from '../lib/api';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors } from '../theme';

const PRESETS = ['Thinking of you ❤️', 'Call me when you can', "Don't forget to eat lunch"];

export function PingTab({ circleId, fromName, patientName }: { circleId: string; fromName: string; patientName: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const text = message.trim();
    if (!text) { setError('Type a message or pick one below.'); return; }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await sendPing(circleId, fromName, text);
      setStatus(`Sent to ${patientName}.`);
      setMessage('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={s.help}>{patientName}'s phone will show this in big letters and read it aloud.</Text>
      <Field label="Message" value={message} onChangeText={setMessage} multiline />
      <View style={s.chips}>
        {PRESETS.map((p) => (
          <Pressable key={p} onPress={() => setMessage(p)} style={s.chip} accessibilityRole="button">
            <Text style={s.chipText}>{p}</Text>
          </Pressable>
        ))}
      </View>
      <ErrorText message={error} />
      {status ? <Text style={s.ok}>{status}</Text> : null}
      <BigButton label="Send" onPress={send} busy={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  help: { fontSize: 18, color: colors.inkSoft, marginBottom: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24,
    backgroundColor: colors.warm, borderWidth: 1, borderColor: colors.line,
  },
  chipText: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  ok: { fontSize: 20, color: colors.green, fontWeight: '700', marginBottom: 12 },
});
