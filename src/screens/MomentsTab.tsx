import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder,
} from 'expo-audio';
import type { Moment, Person } from '../lib/types';
import { addMoment, listMoments, uploadMedia } from '../lib/api';
import { timeAgo } from '../lib/dates';
import { pickAndUploadPhoto } from '../lib/media';
import { BigButton, ErrorText, Field } from '../components/ui';
import { VoicePlayer } from '../components/VoicePlayer';
import { colors } from '../theme';

type Props = { circleId: string; authorName: string; people: Person[]; version: number };

export function MomentsTab({ circleId, authorName, people, version }: Props) {
  const [target, setTarget] = useState<string | null>(null); // null = everyone
  const [body, setBody] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moments, setMoments] = useState<Moment[]>([]);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    listMoments(circleId, undefined, 30).then(setMoments).catch((e) => setError(String(e)));
  }, [circleId, version]);

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
      if (recorder.uri) setAudio(await uploadMedia(recorder.uri, 'audio'));
      return;
    }
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) throw new Error('Microphone permission was not granted.');
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  });

  const post = () => guard(async () => {
    if (!body.trim() && !photo && !audio) throw new Error('Add some text, a photo or a voice note.');
    await addMoment(circleId, {
      person_id: target, author: authorName, body: body.trim() || null, photo_url: photo, audio_url: audio,
    });
    setBody(''); setPhoto(null); setAudio(null);
    setMoments(await listMoments(circleId, undefined, 30));
  });

  const nameOf = (id: string | null) => people.find((p) => p.id === id)?.name ?? 'Everyone';

  return (
    <View>
      <Text style={s.label}>Who is this about?</Text>
      <View style={s.chips}>
        {[{ id: null, name: 'Everyone' }, ...people].map((p) => (
          <Pressable key={p.id ?? 'all'} onPress={() => setTarget(p.id)} accessibilityRole="button"
            style={[s.chip, target === p.id && s.chipOn]}>
            <Text style={[s.chipText, target === p.id && { color: colors.white }]}>{p.name}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="What happened?" value={body} onChangeText={setBody} multiline />
      <View style={s.row}>
        <BigButton label={photo ? 'Photo added ✓' : 'Add photo'} tone="plain" style={s.half}
          onPress={() => guard(async () => { const u = await pickAndUploadPhoto(); if (u) setPhoto(u); })} disabled={busy || recording} />
        <BigButton label={recording ? 'Stop recording' : audio ? 'Voice note added ✓' : 'Record voice note'}
          tone={recording ? 'danger' : 'plain'} style={s.half} onPress={toggleRecord} disabled={busy && !recording} />
      </View>
      <ErrorText message={error} />
      <BigButton label="Post" onPress={post} busy={busy && !recording} disabled={recording} />

      <Text style={[s.label, { marginTop: 24 }]}>Recent</Text>
      {moments.map((m) => (
        <View key={m.id} style={s.moment}>
          <Text style={s.meta}>{nameOf(m.person_id)} · {m.author ?? 'someone'} · {timeAgo(new Date(m.created_at), new Date())}</Text>
          {m.body ? <Text style={s.body}>{m.body}</Text> : null}
          {m.photo_url ? <Image source={{ uri: m.photo_url }} style={s.photo} accessibilityLabel="Photo" /> : null}
          {m.audio_url ? <VoicePlayer url={m.audio_url} /> : null}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  chipText: { fontSize: 18, fontWeight: '600', color: colors.ink },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  half: { flexGrow: 1, flexBasis: 200 },
  moment: { backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 8, borderWidth: 1, borderColor: colors.line, marginTop: 10 },
  meta: { fontSize: 16, fontWeight: '700', color: colors.terracotta },
  body: { fontSize: 18, color: colors.ink },
  photo: { width: '100%', height: 220, borderRadius: 10, backgroundColor: colors.line },
});
