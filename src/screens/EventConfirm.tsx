import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { addEvent, ensureFamilyCalendar } from '../lib/api';
import { allDaySpan, titleFromTranscript, weekendRange, type DayRange } from '../lib/voice';
import { WhenPicker } from '../components/WhenPicker';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, TARGET, type } from '../theme';

type Props = {
  circleId: string;
  createdByPersonId: string | null;
  transcript: string;
  onSaved: () => void;
  onBack: () => void;
};

/** "Does this look right?": fix the title, pick a day from the three big choices, then save. */
export function EventConfirm({ circleId, createdByPersonId, transcript, onSaved, onBack }: Props) {
  const [title, setTitle] = useState(titleFromTranscript(transcript));
  const [when, setWhen] = useState<DayRange>(weekendRange(new Date(), 0));
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setError('Say or type what the event is.'); return; }
    setBusy(true);
    setError(null);
    try {
      const calendarId = await ensureFamilyCalendar(circleId);
      const span = allDaySpan(when);
      const fullTitle = location.trim() ? `${title.trim()} · ${location.trim()}` : title.trim();
      await addEvent(circleId, calendarId, { title: fullTitle, all_day: true, ...span }, createdByPersonId);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <BigButton label="← Back" tone="plain" onPress={onBack} style={s.back} />
      <Text style={s.title}>Does this look right?</Text>

      <View style={s.card}>
        <Text style={s.label}>What</Text>
        <Field label="" value={title} onChangeText={setTitle} placeholder="What is it?" />
      </View>

      <View style={s.card}>
        <Text style={s.label}>When</Text>
        <WhenPicker value={when} onChange={setWhen} />
      </View>

      <View style={s.card}>
        <Field label="Where (optional)" value={location} onChangeText={setLocation} placeholder="Add where you're going" />
      </View>

      <View style={s.audienceRow}>
        <Text style={s.audienceLabel}>Who can see it</Text>
        <Text style={s.audienceValue}>Whole family</Text>
      </View>

      <ErrorText message={error} />
      <BigButton label="Save" onPress={save} busy={busy} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, gap: 8, borderWidth: 2, borderColor: colors.line },
  label: { fontSize: 16, fontWeight: '700', color: colors.inkSoft, textTransform: 'uppercase' },
  audienceRow: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  audienceLabel: { fontSize: type.label, color: colors.inkSoft },
  audienceValue: { fontSize: type.label, fontWeight: '800', color: colors.terracotta },
});
