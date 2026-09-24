import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createCircle, findCircleByCode } from '../lib/api';
import type { Session } from '../lib/types';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, type } from '../theme';

type Step = 'choose' | 'patient' | 'family' | 'code';

export function Welcome({ onDone }: { onDone: (s: Session) => void }) {
  const [step, setStep] = useState<Step>('choose');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [relation, setRelation] = useState('');
  const [created, setCreated] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
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

  const createForPatient = () =>
    run(async () => {
      const first = name.trim();
      if (!first) throw new Error('Please type the first name.');
      const c = await createCircle(first);
      setCreated({ role: 'patient', circleId: c.id, code: c.code, patientName: c.patient_name, memberName: first });
      setStep('code');
    });

  const joinAsFamily = () =>
    run(async () => {
      if (!name.trim()) throw new Error('Please type your name.');
      const c = await findCircleByCode(code);
      if (!c) throw new Error('That code was not found. It has 6 letters and numbers.');
      onDone({
        role: 'family', circleId: c.id, code: c.code, patientName: c.patient_name,
        memberName: name.trim(), relation: relation.trim() || undefined,
      });
    });

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.brand}>Cercana</Text>
      {step === 'choose' && (
        <View style={s.stack}>
          <Text style={s.title}>Who is using this phone?</Text>
          <BigButton label="This phone is for the person with memory loss" onPress={() => { setName(''); setStep('patient'); }} />
          <BigButton label="I'm family" tone="terracotta" onPress={() => { setName(''); setStep('family'); }} />
        </View>
      )}
      {step === 'patient' && (
        <View style={s.stack}>
          <Text style={s.title}>What is their first name?</Text>
          <Field label="First name" value={name} onChangeText={setName} autoFocus autoCapitalize="words" />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={createForPatient} busy={busy} />
          <BigButton label="Back" tone="plain" onPress={() => setStep('choose')} />
        </View>
      )}
      {step === 'code' && created && (
        <View style={s.stack}>
          <Text style={s.title}>Family join with:</Text>
          <Text style={s.code} selectable>{created.code}</Text>
          <Text style={s.body}>Tell your family this code. They choose "I'm family" and type it in.</Text>
          <BigButton label="Done" onPress={() => onDone(created)} />
        </View>
      )}
      {step === 'family' && (
        <View style={s.stack}>
          <Text style={s.title}>Join the circle</Text>
          <Field label="Circle code (6 characters)" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={8} />
          <Field label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />
          <Field label="Your relation to them (e.g. daughter)" value={relation} onChangeText={setRelation} />
          <ErrorText message={error} />
          <BigButton label="Join" tone="terracotta" onPress={joinAsFamily} busy={busy} />
          <BigButton label="Back" tone="plain" onPress={() => setStep('choose')} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, alignSelf: 'center', width: '100%', maxWidth: 640 },
  brand: { fontSize: 20, fontWeight: '700', color: colors.terracotta, marginBottom: 12, letterSpacing: 2 },
  stack: { gap: 16 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink, lineHeight: 48 },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  code: {
    fontSize: 64, fontWeight: '800', letterSpacing: 8, color: colors.green,
    backgroundColor: colors.warm, textAlign: 'center', paddingVertical: 20, borderRadius: 16,
  },
});
