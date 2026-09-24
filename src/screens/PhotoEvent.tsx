import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addEvent, ensureFamilyCalendar } from '../lib/api';
import { nearbyEvents, rangeLabel, singleDay, titleFromTranscript } from '../lib/voice';
import type { EventRow } from '../lib/types';
import { VoiceRecorder } from '../components/VoiceRecorder';
import { WhenPicker } from '../components/WhenPicker';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, TARGET, type } from '../theme';

type Props = {
  circleId: string;
  createdByPersonId: string | null;
  events: EventRow[];
  onNext: (eventId: string | null, eventLabel: string | null) => void;
  onBack: () => void;
};

/** Which event a batch of photos belongs to: a nearby one, a new one, or none. */
export function PhotoEvent({ circleId, createdByPersonId, events, onNext, onBack }: Props) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState(singleDay(new Date()));
  const [changingDate, setChangingDate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nearby = nearbyEvents(events, new Date());

  const pickExisting = (e: EventRow) => onNext(e.id, e.title ?? 'Event');

  const saveNew = async () => {
    if (!title.trim()) { setError('Give the event a name first.'); return; }
    setBusy(true);
    setError(null);
    try {
      const calendarId = await ensureFamilyCalendar(circleId);
      const utc = (d: Date, plus = 0) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + plus)).toISOString();
      const eventId = await addEvent(circleId, calendarId, {
        title: title.trim(), all_day: true, starts_at: utc(when.first), ends_at: utc(when.last, 1),
      }, createdByPersonId);
      onNext(eventId, title.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.wrap}>
      <BigButton label="← Back" tone="plain" onPress={onBack} style={s.back} />
      <Text style={s.title}>Which event is this?</Text>
      <Text style={s.hint}>Optional</Text>

      {!creating && nearby.map((e) => (
        <Pressable key={`${e.uid}|${e.starts_at}`} accessibilityRole="button" style={s.row} onPress={() => pickExisting(e)}>
          <Text style={s.rowLabel}>{e.title ?? 'Event'}</Text>
          <Text style={s.rowDate}>{rangeLabel(singleDay(new Date(e.starts_at)))}</Text>
        </Pressable>
      ))}

      {!creating ? (
        <BigButton label="＋ New event" tone="plain" onPress={() => setCreating(true)} />
      ) : (
        <View style={s.newEvent}>
          <View style={s.titleRow}>
            <View style={{ flex: 1 }}>
              <Field label="Title" value={title} onChangeText={setTitle} placeholder="What is it called?" />
            </View>
            <VoiceRecorder size="compact" onDone={(clip) => setTitle(titleFromTranscript(clip.transcript) || title)} onError={setError} />
          </View>
          {changingDate ? (
            <WhenPicker value={when} onChange={setWhen} />
          ) : (
            <Pressable accessibilityRole="button" style={s.dateRow} onPress={() => setChangingDate(true)}>
              <Text style={s.rowLabel}>Date · {rangeLabel(when)}</Text>
              <Text style={s.edit}>Edit</Text>
            </Pressable>
          )}
          <ErrorText message={error} />
          <BigButton label="Next" onPress={saveNew} busy={busy} />
        </View>
      )}

      <ErrorText message={!creating ? error : null} />
      <BigButton label="No event, just photos" tone="plain" onPress={() => onNext(null, null)} disabled={busy} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, gap: 12, maxWidth: 700, width: '100%', alignSelf: 'center' },
  back: { alignSelf: 'flex-start', minHeight: 48, paddingHorizontal: 16 },
  title: { fontSize: type.title, fontWeight: '800', color: colors.ink },
  hint: { fontSize: 18, color: colors.inkSoft, marginBottom: 6 },
  row: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  rowLabel: { fontSize: type.label, fontWeight: '700', color: colors.ink },
  rowDate: { fontSize: type.label, color: colors.inkSoft },
  newEvent: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  dateRow: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  edit: { fontSize: 18, fontWeight: '700', color: colors.terracotta },
});
