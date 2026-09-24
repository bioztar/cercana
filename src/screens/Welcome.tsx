import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { createCircle } from '../lib/api';
import { shareInvite, shareResultText } from '../lib/share';
import type { Session } from '../lib/types';
import { inviteUrl, isValidCode, normalizeCode } from '../lib/util';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, type } from '../theme';

type Step = 'choose' | 'patient' | 'lead' | 'code' | 'family';

type Props = {
  /** The patient's phone is set up: the lead created the circle here. */
  onDone: (s: Session) => void;
  /** "I'm family" with a code typed in: continue on the invite screen. */
  onJoinCode: (code: string) => void;
};

export function Welcome({ onDone, onJoinCode }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [patientName, setPatientName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadRelation, setLeadRelation] = useState('');
  const [code, setCode] = useState('');
  const [created, setCreated] = useState<Session | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const patientNext = () => {
    if (!patientName.trim()) return setError('Please type the first name.');
    go('lead');
  };

  const create = async () => {
    if (!leadName.trim()) return setError('Please type your name.');
    setBusy(true);
    setError(null);
    try {
      const first = patientName.trim();
      const c = await createCircle(first, { name: leadName.trim(), relation: leadRelation.trim() });
      setCreated({ role: 'patient', circleId: c.id, code: c.code, patientName: c.patient_name, memberName: first });
      setStep('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const continueAsFamily = () => {
    const c = normalizeCode(code);
    if (!isValidCode(c)) return setError('The code has 6 letters and numbers, like K7M4QX.');
    onJoinCode(c);
  };

  const share = async () => {
    if (!created) return;
    setNote(shareResultText(await shareInvite(inviteUrl(created.code), created.patientName)));
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.brand}>Cercana</Text>
      {step === 'choose' && (
        <View style={s.stack}>
          <Text style={s.title}>Who is using this phone?</Text>
          <BigButton label="This phone is for the person with memory loss" onPress={() => go('patient')} />
          <BigButton label="I'm family" tone="terracotta" onPress={() => go('family')} />
        </View>
      )}
      {step === 'patient' && (
        <View style={s.stack}>
          <Text style={s.title}>What is their first name?</Text>
          <Field label="First name" value={patientName} onChangeText={setPatientName} autoFocus autoCapitalize="words" />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={patientNext} />
          <BigButton label="Back" tone="plain" onPress={() => go('choose')} />
        </View>
      )}
      {step === 'lead' && (
        <View style={s.stack}>
          <Text style={s.title}>You are setting this up, so you lead {patientName.trim()}'s family</Text>
          <Field label="Your name" value={leadName} onChangeText={setLeadName} autoFocus autoCapitalize="words" />
          <Field label={`Relation, from ${patientName.trim()}'s view (e.g. "your son")`} value={leadRelation} onChangeText={setLeadRelation} />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={create} busy={busy} />
          <BigButton label="Back" tone="plain" onPress={() => go('patient')} disabled={busy} />
        </View>
      )}
      {step === 'code' && created && (
        <View style={s.stack}>
          <Text style={s.title}>Family join with:</Text>
          <Text style={s.code} selectable>{created.code}</Text>
          <Text style={s.body}>Or send this link: {inviteUrl(created.code)}</Text>
          <Text style={s.body}>Family open the link, or choose "I'm family" and type the code. You can also do this later from Settings.</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
          <BigButton label="Share invite" tone="terracotta" onPress={share} />
          <BigButton label="Done" onPress={() => onDone(created)} />
        </View>
      )}
      {step === 'family' && (
        <View style={s.stack}>
          <Text style={s.title}>Enter the circle code</Text>
          <Field label="Circle code (6 characters)" value={code} onChangeText={setCode} autoFocus autoCapitalize="characters" autoCorrect={false} maxLength={8} />
          <ErrorText message={error} />
          <BigButton label="Continue" tone="terracotta" onPress={continueAsFamily} />
          <BigButton label="Back" tone="plain" onPress={() => go('choose')} />
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
  note: { fontSize: 20, color: colors.green, fontWeight: '700' },
  code: {
    fontSize: 64, fontWeight: '800', letterSpacing: 8, color: colors.green,
    backgroundColor: colors.warm, textAlign: 'center', paddingVertical: 20, borderRadius: 16,
  },
});
