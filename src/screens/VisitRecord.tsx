import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, ErrorText } from '../components/ui';
import { createVisit } from '../lib/api';
import { say } from '../lib/speech';
import { colors, fonts, type, typeFamily } from '../theme';

type Props = {
  circleId: string;
  recordedByPersonId: string | null; // null = recorded on the patient's phone
  onDone: () => void;
  onCancel: () => void;
  /** Patient phone: bigger type, and the result is spoken. */
  large?: boolean;
};

/** 🩺 Record doctor visit: consent line, one long recording, then the `visit` function makes the
 * summary. Used by Carmen's floating "+" (TalkToFamily) and by the family ☰ menu. */
export function VisitRecord({ circleId, recordedByPersonId, onDone, onCancel, large }: Props) {
  const [url, setUrl] = useState<string | null>(null); // uploaded, waiting to be summarised
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = large ? type : { ...typeFamily, name: typeFamily.title };

  const summarise = async (audioUrl: string) => {
    setBusy(true);
    setError(null);
    try {
      await createVisit(circleId, audioUrl, recordedByPersonId);
      setSaved(true);
      if (large) say('Saved. Your family will see it.');
      setTimeout(onDone, large ? 2000 : 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return (
      <View style={s.wrap}>
        <Text style={s.check}>✓</Text>
        <Text style={[s.title, { fontSize: t.title }]}>{large ? 'Saved' : 'Visit saved — the summary is ready'}</Text>
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={[s.title, { fontSize: t.title }]}>🩺 Record doctor visit</Text>
      <Text style={[s.consent, { fontSize: t.body }]}>Ask the doctor before recording.</Text>
      {url ? (
        <>
          <Text style={[s.hint, { fontSize: t.body }]}>
            {busy ? 'Listening to the visit and writing it up. This can take a minute.' : 'The recording is saved.'}
          </Text>
          {!busy && <BigButton label="Try again" tone="terracotta" onPress={() => void summarise(url)} />}
        </>
      ) : (
        <>
          <VoiceRecorder long onDone={(clip) => { setUrl(clip.url); void summarise(clip.url); }} onError={setError}
            idleLabel="Tap to start, tap when the visit is over" />
          <Text style={[s.hint, { fontSize: t.body }]}>Put the phone near the doctor. You can record up to 45 minutes.</Text>
        </>
      )}
      <ErrorText message={error} />
      <BigButton label="Cancel" tone="plain" onPress={onCancel} disabled={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24 },
  title: { fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  consent: { fontWeight: '800', color: colors.terracottaDark, textAlign: 'center', backgroundColor: colors.peachSoft, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 20, overflow: 'hidden' },
  hint: { color: colors.inkSoft, textAlign: 'center', lineHeight: 30 },
  check: { fontSize: 72, color: colors.green, fontWeight: '800' },
});
