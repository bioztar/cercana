import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import type { Session } from '../lib/types';
import { inviteUrl } from '../lib/util';
import { shareInvite, shareResultText } from '../lib/share';
import { BigButton } from '../components/ui';
import { confirmAction } from '../components/confirm';
import { colors, type, fonts } from '../theme';

type Props = { session: Session; canInvite: boolean; onBack: () => void; onLeave: () => void };

export function Settings({ session, canInvite, onBack, onLeave }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const share = async () => setNote(shareResultText(await shareInvite(inviteUrl(session.code), session.patientName)));
  const isPatient = session.role === 'patient';
  // One tap here used to drop the session with no way back for the patient, so it always asks first.
  const leave = async () => {
    const ok = await confirmAction(
      isPatient
        ? `Reset this phone? It leaves ${session.patientName}'s family and goes back to the first screen. Photos and messages stay with the family.`
        : `Leave ${session.patientName}'s family on this phone? You can join again later with the code ${session.code}.`,
      isPatient ? 'Reset phone' : 'Leave',
    );
    if (ok) onLeave();
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>Settings</Text>
      <Text style={s.body}>
        {session.role === 'patient'
          ? `This phone is for ${session.patientName}.`
          : `You are ${session.memberName}, family of ${session.patientName}.`}
      </Text>
      <Text style={s.body}>Circle code: {session.code}</Text>

      {/* SLOT: cercana-care's <MorningBriefSettings /> (brief time + on/off + "Hear it now") renders
          here for both roles — helm wires the import at merge once that component lands. */}
      <Text style={s.slot}>Morning brief settings — coming soon</Text>

      {canInvite ? (
        <>
          <Text style={s.small}>{inviteUrl(session.code)}</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
          <BigButton label="Share invite" tone="terracotta" onPress={share} />
        </>
      ) : null}
      <BigButton label="Back" tone="plain" onPress={onBack} />
      <BigButton label={isPatient ? 'Reset this phone…' : 'Leave this family…'} tone="danger" onPress={leave} style={s.leave} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
  body: { fontSize: type.body, color: colors.ink },
  small: { fontSize: 18, color: colors.inkSoft },
  leave: { marginTop: 32 }, // set apart from Back so it is not hit by mistake
  slot: {
    fontSize: 16, color: colors.inkSoft, fontStyle: 'italic', borderWidth: 1, borderColor: colors.line,
    borderRadius: 12, padding: 12,
  },
  note: { fontSize: 20, color: colors.green, fontWeight: '700' },
});
