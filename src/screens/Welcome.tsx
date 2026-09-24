import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { createCircle, findCircleByCode } from '../lib/api';
import { shareInvite, shareResultText } from '../lib/share';
import type { Circle, Session } from '../lib/types';
import { inviteUrl, isValidCode, normalizeCode } from '../lib/util';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, type, fonts } from '../theme';

// A relative sets Cercana up (becomes the family's lead, on their own phone) and only afterwards
// hands the patient's phone its join code — the patient path never starts a new family.
type Step =
  | 'choose'
  | 'setupName' | 'setupLead' | 'invite' // "I'm setting up Cercana for someone in my family"
  | 'joinCode' | 'joinConfirm' // "I have an invite code or link" typed in (not via a link)
  | 'patientCode' | 'patientConfirm'; // "This is the phone of the person we care for"

type Props = {
  /** The patient's phone is set up: it joined by code, this device becomes a patient session. */
  onDone: (s: Session) => void;
  /** "I have an invite code or link" with a code typed in: continue on the invite-landing screen. */
  onJoinCode: (code: string) => void;
};

export function Welcome({ onDone, onJoinCode }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [patientName, setPatientName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadRelation, setLeadRelation] = useState('');
  const [code, setCode] = useState('');
  const [found, setFound] = useState<Circle | null>(null);
  const [created, setCreated] = useState<Session | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const setupNameNext = () => {
    if (!patientName.trim()) return setError('Please type their first name.');
    go('setupLead');
  };

  const create = async () => {
    if (!leadName.trim()) return setError('Please type your name.');
    setBusy(true);
    setError(null);
    try {
      const first = patientName.trim();
      const relation = leadRelation.trim();
      const c = await createCircle(first, { name: leadName.trim(), relation });
      // This device is the relative setting things up: a family session, leading the circle.
      setCreated({
        role: 'family', circleId: c.id, code: c.code, patientName: c.patient_name,
        memberName: leadName.trim(), memberId: c.lead_id ?? undefined, relation: relation || undefined,
      });
      setStep('invite');
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

  const lookUpPatientCircle = async () => {
    const c = normalizeCode(code);
    if (!isValidCode(c)) return setError('The code has 6 letters and numbers, like K7M4QX.');
    setBusy(true);
    setError(null);
    try {
      const circle = await findCircleByCode(c);
      if (!circle) return setError('That code was not found. Check it with your family.');
      setFound(circle);
      setStep('patientConfirm');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
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
          <Text style={s.title}>Welcome</Text>
          <BigButton label="I'm setting up Cercana for someone in my family" onPress={() => go('setupName')} />
          <BigButton label="I have an invite code or link" tone="terracotta" onPress={() => go('joinCode')} />
          <BigButton label="This is the phone of the person we care for" tone="plain" onPress={() => go('patientCode')} />
        </View>
      )}
      {step === 'setupName' && (
        <View style={s.stack}>
          <Text style={s.title}>What is their first name?</Text>
          <Field label="Their first name" value={patientName} onChangeText={setPatientName} autoFocus autoCapitalize="words" />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={setupNameNext} />
          <BigButton label="Back" tone="plain" onPress={() => go('choose')} />
        </View>
      )}
      {step === 'setupLead' && (
        <View style={s.stack}>
          <Text style={s.title}>You're setting this up, so you lead {patientName.trim()}'s family</Text>
          <Field label="Your name" value={leadName} onChangeText={setLeadName} autoFocus autoCapitalize="words" />
          <Field label={`Your relation, from ${patientName.trim()}'s view (e.g. "your daughter")`} value={leadRelation} onChangeText={setLeadRelation} />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={create} busy={busy} />
          <BigButton label="Back" tone="plain" onPress={() => go('setupName')} disabled={busy} />
        </View>
      )}
      {step === 'invite' && created && (
        <View style={s.stack}>
          <Text style={s.title}>{created.patientName}'s family is set up</Text>
          <Text style={s.body}>Invite the rest of the family with this code or link.</Text>
          <Text style={s.code} selectable>{created.code}</Text>
          <Text style={s.small}>{inviteUrl(created.code)}</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
          <BigButton label="Share invite" tone="terracotta" onPress={share} />
          <View style={s.card}>
            <Text style={s.cardTitle}>Set up {created.patientName}'s phone</Text>
            <Text style={s.body}>1. On her phone, open Cercana.</Text>
            <Text style={s.body}>2. Choose "This is the phone of the person we care for" and type the code above.</Text>
          </View>
          <BigButton label="Done" onPress={() => onDone(created)} />
        </View>
      )}
      {step === 'joinCode' && (
        <View style={s.stack}>
          <Text style={s.title}>Enter the family code</Text>
          <Field label="Family code (6 characters)" value={code} onChangeText={setCode} autoFocus autoCapitalize="characters" autoCorrect={false} maxLength={8} />
          <ErrorText message={error} />
          <BigButton label="Continue" tone="terracotta" onPress={continueAsFamily} />
          <BigButton label="Back" tone="plain" onPress={() => go('choose')} />
        </View>
      )}
      {step === 'patientCode' && (
        <View style={s.stack}>
          <Text style={s.title}>Enter the family code</Text>
          <Field label="Family code (6 characters)" value={code} onChangeText={setCode} autoFocus autoCapitalize="characters" autoCorrect={false} maxLength={8} />
          <ErrorText message={error} />
          <BigButton label="Continue" onPress={lookUpPatientCircle} busy={busy} />
          <BigButton label="Back" tone="plain" onPress={() => go('choose')} disabled={busy} />
        </View>
      )}
      {step === 'patientConfirm' && found && (
        <View style={s.stack}>
          <Text style={s.title}>This is {found.patient_name}'s phone?</Text>
          <BigButton
            label="Yes"
            onPress={() => onDone({ role: 'patient', circleId: found.id, code: found.code, patientName: found.patient_name, memberName: found.patient_name })}
          />
          <BigButton label="No" tone="plain" onPress={() => go('patientCode')} />
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: 'center', padding: 24, alignSelf: 'center', width: '100%', maxWidth: 640 },
  brand: { fontSize: 20, fontWeight: '700', color: colors.terracotta, marginBottom: 12, letterSpacing: 2 },
  stack: { gap: 16 },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink, lineHeight: 48 },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  small: { fontSize: 18, color: colors.inkSoft },
  note: { fontSize: 20, color: colors.green, fontWeight: '700' },
  code: {
    fontSize: 64, fontFamily: fonts.display, letterSpacing: 8, color: colors.green,
    backgroundColor: colors.warm, textAlign: 'center', paddingVertical: 20, borderRadius: 16,
  },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 8, borderWidth: 2, borderColor: colors.line },
  cardTitle: { fontSize: 22, fontFamily: fonts.display, color: colors.ink },
});
