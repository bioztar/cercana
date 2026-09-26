import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { addEvent, ensureFamilyCalendar } from '../lib/api';
import type { AssistantProposal } from '../lib/types';
import { allDaySpan, proposalToEvent, singleDay, titleFromTranscript, weekendRange, type DayRange } from '../lib/voice';
import { WhenPicker } from '../components/WhenPicker';
import { BigButton, ErrorText, Field } from '../components/ui';
import { colors, TARGET, type } from '../theme';

type Props = {
  circleId: string;
  createdByPersonId: string | null;
  transcript: string;
  /** Heard by the assistant (dictation): prefills what / when / where. */
  proposal?: AssistantProposal | null;
  onSaved: () => void;
  onBack: () => void;
};

const whenLabel = (p: AssistantProposal): string =>
  p.all_day
    ? new Date(p.starts_at).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    : new Date(p.starts_at).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** The day an all-day proposal names, as a local single day (its span is UTC midnight). */
const proposalDay = (p: AssistantProposal): DayRange => {
  const d = new Date(p.starts_at);
  return singleDay(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

/** "Does this look right?": fix the title, pick a day from the three big choices, then save. A dictated
 * proposal arrives filled in, with its exact time kept unless the user changes the day. */
export function EventConfirm({ circleId, createdByPersonId, transcript, proposal, onSaved, onBack }: Props) {
  const exactTime = !!proposal && !proposal.all_day;
  const [title, setTitle] = useState(proposal?.title ?? titleFromTranscript(transcript));
  const [when, setWhen] = useState<DayRange>(proposal?.all_day ? proposalDay(proposal) : weekendRange(new Date(), 0));
  const [changeDay, setChangeDay] = useState(false);
  const [location, setLocation] = useState(proposal?.location ?? '');
  const [note, setNote] = useState(proposal?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!title.trim()) { setError('Say or type what the event is.'); return; }
    setBusy(true);
    setError(null);
    try {
      const calendarId = await ensureFamilyCalendar(circleId);
      if (proposal && !changeDay) {
        const input = proposalToEvent({ ...proposal, title: title.trim(), location: location.trim() || undefined, note: note.trim() || undefined });
        await addEvent(circleId, calendarId, input, createdByPersonId);
      } else {
        const span = allDaySpan(when);
        const fullTitle = location.trim() ? `${title.trim()} · ${location.trim()}` : title.trim();
        await addEvent(circleId, calendarId, { title: fullTitle, all_day: true, ...span }, createdByPersonId);
      }
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
        {proposal && !changeDay ? (
          <>
            <Text style={s.when}>{whenLabel(proposal)}</Text>
            <Pressable accessibilityRole="button" onPress={() => setChangeDay(true)}>
              <Text style={s.link}>{exactTime ? 'Change the day (drops the time)' : 'Change the day'}</Text>
            </Pressable>
          </>
        ) : (
          <WhenPicker value={when} onChange={setWhen} />
        )}
      </View>

      <View style={s.card}>
        <Field label="Where (optional)" value={location} onChangeText={setLocation} placeholder="Add where you're going" />
        {proposal && !changeDay ? <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="Anything to bring or remember" /> : null}
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
  when: { fontSize: type.name, fontWeight: '800', color: colors.ink },
  link: { fontSize: 18, fontWeight: '700', color: colors.terracotta, minHeight: 48, paddingVertical: 12 },
  audienceRow: {
    minHeight: TARGET, borderRadius: 16, backgroundColor: colors.card, borderWidth: 2, borderColor: colors.line,
    paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  audienceLabel: { fontSize: type.label, color: colors.inkSoft },
  audienceValue: { fontSize: type.label, fontWeight: '800', color: colors.terracotta },
});
