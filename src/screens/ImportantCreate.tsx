import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createImportant } from '../lib/api';
import { REMINDER_LABEL, defaultReminders } from '../lib/important';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors } from '../theme';

type Props = { circleId: string; createdByPersonId: string | null; onClose: () => void; onSaved: () => void };

/** Family: create an important event for Mom — a reminder the evening before, on the day, and a
 * "Did you go?" check-in afterwards (see src/lib/important.ts). Matches design/mockups/ImpCreate.png. */
export function ImportantCreate({ circleId, createdByPersonId, onClose, onSaved }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseDateTime(date, time);

  const save = async () => {
    if (!title.trim()) return setError('Give the event a title, e.g. "Cardiologist appointment".');
    if (!parsed) return setError('Date must be YYYY-MM-DD and time HH:MM (24-hour), e.g. 2026-09-29 and 10:30.');
    setBusy(true);
    setError(null);
    try {
      await createImportant(circleId, {
        title: title.trim(),
        starts_at: parsed.toISOString(),
        ends_at: null,
        location: location.trim() || null,
        created_by_person_id: createdByPersonId,
        reminders: defaultReminders(parsed, null),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Text style={s.title}>New important event</Text>
      <Field label="Title (e.g. Cardiologist appointment)" value={title} onChangeText={setTitle} autoCapitalize="sentences" />
      <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <Field label="Time (HH:MM, 24-hour)" value={time} onChangeText={setTime} autoCapitalize="none" keyboardType="numbers-and-punctuation" />
      <Field label="Location (optional)" value={location} onChangeText={setLocation} />
      <View style={s.for}>
        <Text style={s.forLabel}>For</Text>
        <Text style={s.forValue}>Mom only</Text>
      </View>
      <View style={s.reminders}>
        <Text style={s.remindersTitle}>Notifications to Mom</Text>
        {parsed
          ? defaultReminders(parsed, null).map((r) => (
              <Text key={r.kind} style={s.reminderRow}>
                {REMINDER_LABEL[r.kind]} · {new Date(r.at).toLocaleString()}
              </Text>
            ))
          : <Text style={s.reminderRow}>Enter a date and time to see when reminders go out.</Text>}
      </View>
      <ErrorText message={error} />
      <View style={{ gap: 12 }}>
        <BigButton label="Save" onPress={save} busy={busy} />
        <Pressable onPress={onClose} accessibilityRole="button" style={s.cancel}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** "2026-09-29" + "10:30" → local Date, or null if either is malformed. */
function parseDateTime(date: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date.trim());
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const [, y, mo, da] = d.map(Number) as unknown as [number, number, number, number];
  const [, h, mi] = t.map(Number) as unknown as [number, number, number];
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const parsed = new Date(y, mo - 1, da, h, mi);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const s = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.ink, marginBottom: 16 },
  for: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  forLabel: { fontSize: 16, color: colors.inkSoft, fontWeight: '600' },
  forValue: { fontSize: 18, color: colors.ink, fontWeight: '700' },
  reminders: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 16, gap: 6 },
  remindersTitle: { fontSize: 15, fontWeight: '700', color: colors.inkSoft, marginBottom: 4 },
  reminderRow: { fontSize: 16, color: colors.ink },
  cancel: { alignItems: 'center', minHeight: 48, justifyContent: 'center' },
  cancelText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
});
