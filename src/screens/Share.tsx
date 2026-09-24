import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { addMoment } from '../lib/api';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, ErrorText } from '../components/ui';
import { colors, TARGET, type } from '../theme';

type Props = {
  circleId: string;
  patientName: string;
  onPosted: () => void; // voice news was posted straight to the feed
  onPhotos: () => void;
  onEvent: () => void;
  onCancel: () => void;
};

type Choice = 'menu' | 'voice';

const OPTIONS: { key: Exclude<Choice, 'menu'> | 'photos' | 'event'; icon: string; label: string; hint: string }[] = [
  { key: 'voice', icon: '🎙', label: 'Voice', hint: 'Just tell your news' },
  { key: 'photos', icon: '📷', label: 'Photos', hint: 'Share photos from your phone' },
  { key: 'event', icon: '📅', label: 'Event', hint: 'Trip, holiday, doctor: anything with a date' },
];

/** Mom's "Tell the family" entry point: voice news, photos, or an event. */
export function Share({ circleId, patientName, onPosted, onPhotos, onEvent, onCancel }: Props) {
  const [choice, setChoice] = useState<Choice>('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const postVoiceNews = async (audioUrl: string, transcript: string) => {
    setBusy(true);
    setError(null);
    try {
      await addMoment(circleId, {
        person_id: null, author_person_id: null, author: patientName,
        body: transcript || null, photo_url: null, audio_url: audioUrl, by_patient: true,
      });
      onPosted();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (choice === 'voice') {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Tell your news</Text>
        <VoiceRecorder onDone={(clip) => postVoiceNews(clip.url, clip.transcript)} onError={setError} disabled={busy} />
        <ErrorText message={error} />
        <BigButton label="Cancel" tone="plain" onPress={() => setChoice('menu')} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>What do you want to share?</Text>
      {OPTIONS.map((o) => (
        <Pressable key={o.key} accessibilityRole="button" style={s.row}
          onPress={() => (o.key === 'voice' ? setChoice('voice') : o.key === 'photos' ? onPhotos() : onEvent())}>
          <Text style={s.icon}>{o.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.rowLabel}>{o.label}</Text>
            <Text style={s.rowHint}>{o.hint}</Text>
          </View>
        </Pressable>
      ))}
      <ErrorText message={error} />
      <BigButton label="Cancel" tone="plain" onPress={onCancel} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, marginBottom: 8 },
  row: {
    minHeight: TARGET + 16, borderRadius: 18, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 18,
  },
  icon: { fontSize: 32 },
  rowLabel: { fontSize: type.name - 4, fontWeight: '800', color: colors.ink },
  rowHint: { fontSize: 18, color: colors.inkSoft, marginTop: 2 },
});
