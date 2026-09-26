import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '../components/Text';
import { addMoment, uploadMedia } from '../lib/api';
import { say } from '../lib/speech';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { BigButton, ErrorText } from '../components/ui';
import { VisitRecord } from './VisitRecord';
import { colors, fonts, radius, type } from '../theme';

type Props = {
  circleId: string; patientName: string; onSent: () => void; onCancel: () => void;
  onOpenAssistant: () => void; // third floating-"+" choice: AssistantChat (Vitaly, 2026-09-24)
};

type Step = 'choose' | 'voice' | 'photo' | 'visit';

/** Mom's floating "+" (Vitaly, 2026-09-24 15:55): one tap, two big choices, both straight into the
 * whole family feed with no further questions — unlike `Share.tsx`'s fuller Voice/Photos/Event menu
 * (kept in the ☰ menu for the multi-photo + event-linking cases). */
export function TalkToFamily({ circleId, patientName, onSent, onCancel, onOpenAssistant }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [sent, setSent] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = async (photoUrl: string | null, audioUrl: string | null, transcript: string) => {
    setBusy(true);
    setError(null);
    try {
      await addMoment(circleId, {
        person_id: null, author_person_id: null, author: patientName,
        body: transcript || null, photo_url: photoUrl, audio_url: audioUrl, by_patient: true,
      });
      setSent(true);
      say('Sent to your family.');
      setTimeout(onSent, 1600); // auto-close after the confirmation is read
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      const res = perm.granted
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const url = await uploadMedia(res.assets[0].uri, 'photo');
      setPhotoUri(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={s.wrap}>
        <Text style={s.check}>✓</Text>
        <Text style={s.title}>Sent to your family</Text>
      </View>
    );
  }

  if (step === 'voice') {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Say something</Text>
        <VoiceRecorder circleId={circleId} onDone={(clip) => post(null, clip.url, clip.transcript)} onError={setError} disabled={busy}
          idleLabel="Tap when you're done" />
        <ErrorText message={error} />
        <BigButton label="Cancel" tone="plain" onPress={() => setStep('choose')} disabled={busy} />
      </View>
    );
  }

  if (step === 'visit') {
    return (
      <View style={s.wrap}>
        <VisitRecord large circleId={circleId} recordedByPersonId={null} onDone={onSent} onCancel={() => setStep('choose')} />
      </View>
    );
  }

  if (step === 'photo') {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Send a photo</Text>
        {photoUri ? (
          <>
            <Image accessibilityLabel="Photo to send" source={{ uri: photoUri }} style={s.preview} resizeMode="cover" />
            <Text style={s.hint}>Say a caption if you like</Text>
            <VoiceRecorder size="compact" onDone={(clip) => post(photoUri, clip.url, clip.transcript)} onError={setError} disabled={busy} />
            <BigButton label="Send without saying anything" onPress={() => post(photoUri, null, '')} busy={busy} tone="terracotta" />
          </>
        ) : (
          <BigButton label="📷 Take or choose a photo" onPress={pickPhoto} busy={busy} />
        )}
        <ErrorText message={error} />
        <BigButton label="Cancel" tone="plain" onPress={() => setStep('choose')} disabled={busy} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Text style={s.title}>Send to your family</Text>
      <Pressable accessibilityRole="button" style={s.choice} onPress={() => setStep('voice')}>
        <Text style={s.choiceIcon}>🎤</Text>
        <Text style={s.choiceLabel}>Say something</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.choice} onPress={() => setStep('photo')}>
        <Text style={s.choiceIcon}>📷</Text>
        <Text style={s.choiceLabel}>Send a photo</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.choice} onPress={onOpenAssistant}>
        <Text style={s.choiceIcon}>💬</Text>
        <Text style={s.choiceLabel}>Chat with assistant</Text>
      </Pressable>
      <Pressable accessibilityRole="button" style={s.choice} onPress={() => setStep('visit')}>
        <Text style={s.choiceIcon}>🩺</Text>
        <Text style={s.choiceLabel}>Record doctor visit</Text>
      </Pressable>
      <BigButton label="Cancel" tone="plain" onPress={onCancel} />
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20, padding: 24, backgroundColor: colors.bg },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  check: { fontSize: 72, color: colors.green, fontWeight: '800' },
  choice: {
    width: '100%', maxWidth: 420, minHeight: 96, borderRadius: radius.xl, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 24,
  },
  choiceIcon: { fontSize: 40 },
  choiceLabel: { fontSize: type.name - 4, fontWeight: '800', color: colors.ink },
  preview: { width: '100%', maxWidth: 420, height: 260, borderRadius: radius.lg, backgroundColor: colors.line },
  hint: { fontSize: type.body, color: colors.inkSoft },
});
