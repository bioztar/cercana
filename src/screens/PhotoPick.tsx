import React, { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { uploadMedia } from '../lib/api';
import { BigButton, ErrorText } from '../components/ui';
import { colors, type } from '../theme';

const MAX_PHOTOS = 3;

type Props = { onNext: (photoUrls: string[]) => void; onCancel: () => void };

/** Pick up to three photos from the phone's library and upload them. */
export function PhotoPick({ onNext, onCancel }: Props) {
  const [urls, setUrls] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'], quality: 0.6, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS,
      });
      if (res.canceled || res.assets.length === 0) return;
      const picked = res.assets.slice(0, MAX_PHOTOS);
      const uploaded = await Promise.all(picked.map((a) => uploadMedia(a.uri, 'photo')));
      setUrls(uploaded);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <Text style={s.title}>Choose photos</Text>
      <Text style={s.hint}>Up to {MAX_PHOTOS} photos</Text>

      {urls.length > 0 ? (
        <View style={s.grid}>
          {urls.map((u) => <Image key={u} accessibilityLabel="Selected photo" source={{ uri: u }} style={s.thumb} />)}
        </View>
      ) : null}

      <ErrorText message={error} />
      <BigButton label={urls.length > 0 ? 'Choose different photos' : 'Choose from photos'} tone={urls.length > 0 ? 'plain' : 'green'} onPress={pick} busy={busy} />
      {urls.length > 0 ? <BigButton label="Next" onPress={() => onNext(urls)} disabled={busy} /> : null}
      <BigButton label="Cancel" tone="plain" onPress={onCancel} disabled={busy} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 18, color: colors.inkSoft, marginBottom: 6 },
  grid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  thumb: { width: 140, height: 140, borderRadius: 12, backgroundColor: colors.line },
});
