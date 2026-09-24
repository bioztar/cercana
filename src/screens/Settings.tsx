import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { Session } from '../lib/types';
import { BigButton } from '../components/ui';
import { colors, type } from '../theme';

type Props = { session: Session; onBack: () => void; onLeave: () => void };

export function Settings({ session, onBack, onLeave }: Props) {
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <Text style={s.title}>Settings</Text>
      <Text style={s.body}>
        {session.role === 'patient'
          ? `This phone is for ${session.patientName}.`
          : `You are ${session.memberName}, family of ${session.patientName}.`}
      </Text>
      <Text style={s.body}>Circle code: {session.code}</Text>
      <BigButton label="Back" tone="plain" onPress={onBack} />
      <BigButton label="Switch role / leave circle" tone="danger" onPress={onLeave} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 24, gap: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  body: { fontSize: type.body, color: colors.ink },
});
