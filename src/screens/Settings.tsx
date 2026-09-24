import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from '../components/Text';
import type { Session } from '../lib/types';
import { inviteUrl } from '../lib/util';
import { shareInvite, shareResultText } from '../lib/share';
import { BigButton } from '../components/ui';
import { colors, type, fonts } from '../theme';

type Props = { session: Session; canInvite: boolean; onBack: () => void; onLeave: () => void };

export function Settings({ session, canInvite, onBack, onLeave }: Props) {
  const [note, setNote] = useState<string | null>(null);
  const share = async () => setNote(shareResultText(await shareInvite(inviteUrl(session.code), session.patientName)));

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>Settings</Text>
      <Text style={s.body}>
        {session.role === 'patient'
          ? `This phone is for ${session.patientName}.`
          : `You are ${session.memberName}, family of ${session.patientName}.`}
      </Text>
      <Text style={s.body}>Circle code: {session.code}</Text>
      {canInvite ? (
        <>
          <Text style={s.small}>{inviteUrl(session.code)}</Text>
          {note ? <Text style={s.note}>{note}</Text> : null}
          <BigButton label="Share invite" tone="terracotta" onPress={share} />
        </>
      ) : null}
      <BigButton label="Back" tone="plain" onPress={onBack} />
      <BigButton label="Switch role / leave circle" tone="danger" onPress={onLeave} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
  body: { fontSize: type.body, color: colors.ink },
  small: { fontSize: 18, color: colors.inkSoft },
  note: { fontSize: 20, color: colors.green, fontWeight: '700' },
});
