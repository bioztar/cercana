import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../components/Text';
import { seeImage, uploadMedia } from '../lib/api';
import { say, stopSaying } from '../lib/speech';
import type { SeeMode, SeeResult } from '../lib/types';
import { BigButton, ErrorText } from '../components/ui';
import { colors, fonts, radius, TARGET, type } from '../theme';

type Props = { circleId: string; mode: SeeMode; onBack: () => void };

const COPY: Record<SeeMode, { title: string; pick: string; busy: string }> = {
  who: { title: 'Who is this?', pick: '📷 Take a photo', busy: 'Looking…' },
  letter: { title: 'Read this for me', pick: '📷 Take a photo of it', busy: 'Reading…' },
};

/** Carmen's camera helpers: pick/take a photo, get a big spoken result card with 🔊 replay. */
export function SeeHelper({ circleId, mode, onBack }: Props) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<SeeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[mode];

  useEffect(() => stopSaying, []);

  const run = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const res = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      setResult(null);
      const url = await uploadMedia(res.assets[0].uri, 'photo');
      setPhoto(res.assets[0].uri);
      const r = await seeImage(circleId, mode, url);
      setResult(r);
      say(r.reply);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      say(msg);
    } finally {
      setBusy(false);
    }
  };

  const warn = result?.scam_risk === 'high' || result?.scam_risk === 'medium';

  return (
    <View style={s.wrap}>
      <Text style={s.title}>{copy.title}</Text>
      {photo ? <Image accessibilityLabel="Your photo" source={{ uri: photo }} style={s.preview} resizeMode="cover" /> : null}
      {busy ? <Text style={s.hint}>{copy.busy}</Text> : null}
      {result ? (
        <View style={[s.card, warn && s.cardWarn]}>
          <Text style={s.reply}>{result.reply}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Hear it again" style={s.replay} onPress={() => say(result.reply)}>
            <Text style={s.replayText}>🔊 Hear it again</Text>
          </Pressable>
        </View>
      ) : null}
      <ErrorText message={error} />
      <BigButton label={result ? '📷 Try another photo' : copy.pick} onPress={run} busy={busy} tone={result ? 'plain' : 'green'} />
      <BigButton label="Back" tone="plain" onPress={onBack} disabled={busy} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.bg },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  preview: { width: '100%', maxWidth: 420, height: 200, borderRadius: radius.lg, backgroundColor: colors.line },
  hint: { fontSize: type.body, color: colors.inkSoft },
  card: {
    width: '100%', maxWidth: 420, borderRadius: radius.xl, backgroundColor: colors.card, borderWidth: 2,
    borderColor: colors.line, padding: 20, gap: 14,
  },
  cardWarn: { borderColor: colors.terracotta },
  reply: { fontSize: type.name - 4, fontWeight: '800', color: colors.ink, lineHeight: 38 },
  replay: { minHeight: TARGET, justifyContent: 'center' },
  replayText: { fontSize: type.body, fontWeight: '700', color: colors.terracotta },
});
