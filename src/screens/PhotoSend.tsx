import React, { useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addMoment } from '../lib/api';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, TARGET, type } from '../theme';

type Props = {
  circleId: string;
  patientName: string;
  photos: string[];
  eventId: string | null;
  eventLabel: string | null;
  onSent: () => void;
  onBack: () => void;
};

/** Last step of "Tell the family" with photos: caption by voice or text, then send to the whole family. */
export function PhotoSend({ circleId, patientName, photos, eventId, eventLabel, onSent, onBack }: Props) {
  const [caption, setCaption] = useState('');
  const [captionAudio, setCaptionAudio] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await Promise.all(photos.map((url, i) => addMoment(circleId, {
        person_id: null, author_person_id: null, author: patientName, by_patient: true, event_id: eventId,
        body: caption.trim() || null, photo_url: url, audio_url: i === 0 ? captionAudio : null,
      })));
      onSent();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <BigButton label="← Back" tone="plain" onPress={onBack} style={s.back} />
      <Text style={s.title}>Caption and audience</Text>

      <View style={s.grid}>
        {photos.map((u) => <Image key={u} accessibilityLabel="Photo" source={{ uri: u }} style={s.thumb} />)}
      </View>

      {eventLabel ? <Text style={s.event}>📅 Event · {eventLabel}</Text> : null}

      <View style={s.captionRow}>
        <View style={{ flex: 1 }}>
          <Field label="Caption" value={caption} onChangeText={setCaption} multiline placeholder="What is happening in the photo?" />
        </View>
        <VoiceRecorder size="compact" onDone={(clip) => { setCaptionAudio(clip.url); if (clip.transcript) setCaption(clip.transcript); }} onError={setError} />
      </View>

      <Text style={s.audienceLabel}>Who can see it</Text>
      <View style={s.audience}><Text style={s.audienceText}>Whole family</Text></View>

      <ErrorText message={error} />
      <BigButton label="Send" onPress={send} busy={busy} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  grid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: colors.line },
  event: { fontSize: 18, fontWeight: '700', color: colors.terracotta },
  captionRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  audienceLabel: { fontSize: 18, fontWeight: '700', color: colors.ink },
  audience: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.terracotta,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  audienceText: { fontSize: type.label, fontWeight: '800', color: colors.ink },
});
