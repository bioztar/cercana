import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { Dose } from '../lib/meds';
import { spokenLine } from '../lib/meds';
import { submitMedicationLog } from '../lib/api';
import { say } from '../lib/speech';
import { BigButton, ErrorText } from '../components/ui';
import { colors } from '../theme';

type Props = { circleId: string; dose: Dose; onSnooze: () => void; onDone: () => void };

/** Patient full-screen "Did you take it?" — opened when a dose becomes due (or on app open if one
 * already is), speaks the reminder once, then answers with a tap. Same pattern as MomCheck. */
export function MedsCheck({ circleId, dose, onSnooze, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    say(spokenLine(dose));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speaks once per dose, keyed by its key
  }, [dose.key]);

  const answer = (status: 'taken' | 'skipped') => {
    setBusy(true);
    setError(null);
    submitMedicationLog(circleId, dose.medication.id, dose.scheduledFor.toISOString(), status)
      .then(onDone)
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setBusy(false);
      });
  };

  return (
    <View style={s.overlay} accessibilityViewIsModal>
      <View style={{ alignSelf: 'stretch', maxWidth: 480, width: '100%' }}>
        <Text style={s.badge}>Medicine</Text>
        <Text style={s.name}>{dose.medication.name}</Text>
        <Text style={s.dose}>{dose.medication.dose}</Text>
        <Text style={s.question}>Did you take your {dose.medication.name}?</Text>
        <View style={s.answers}>
          <BigButton label="Yes, I took it" tone="green" onPress={() => answer('taken')} disabled={busy} />
          <BigButton label="Not yet" tone="plain" onPress={() => { onSnooze(); onDone(); }} disabled={busy} />
          <BigButton label="Skip" tone="outline" onPress={() => answer('skipped')} disabled={busy} />
        </View>
        <ErrorText message={error} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100,
    backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24,
  },
  badge: {
    alignSelf: 'flex-start', fontSize: 16, fontWeight: '800', color: colors.terracottaDark,
    backgroundColor: colors.peach, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, marginBottom: 12,
  },
  name: { fontSize: 34, fontWeight: '800', color: colors.ink },
  dose: { fontSize: 20, color: colors.inkSoft, marginBottom: 20 },
  question: { fontSize: 28, fontWeight: '800', color: colors.ink, marginBottom: 20 },
  answers: { gap: 14 },
});
