import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { BriefSettings, Checkin, CommentSummary, Digest, EventRow, ImportantEvent, Medication, MedicationLog, Moment, Person } from '../lib/types';
import { commentSummaries, listDigests } from '../lib/api';
import { DigestCard } from '../components/DigestCard';
import { dashboardImportant } from '../lib/dashboard';
import { mergeBriefingEvents, timeLabel, todaySentences } from '../lib/briefing';
import { cardText, todaysImportantSentences } from '../lib/important';
import { STATUS_ICON, statusLabel, todaysDoses } from '../lib/meds';
import { commentText } from '../lib/voice';
import { BigButton } from '../components/ui';
import { VoicePlayer } from '../components/VoicePlayer';
import { colors, fonts, radius, typeFamily } from '../theme';

type Props = {
  circleId: string;
  patientName: string;
  important: ImportantEvent[];
  checkins: Checkin[];
  events: EventRow[];
  people: Person[];
  moments: Moment[]; // for "From <patient>": her own posts (by_patient) + her voice replies
  version: number; // bumps on realtime changes, incl. new comments — refetches commentSummaries
  briefSettings: BriefSettings;
  medications: Medication[];
  medicationLogs: MedicationLog[];
  canManageMedications: boolean;
  onNewImportant: () => void;
  onOpenImportant: (id: string) => void;
  onHearBrief: () => void;
  onManageMedications: () => void;
};

type FromPatientItem = { key: string; at: string; text: string; audioUrl: string | null };

/** Family-side "<patient> today" dashboard (Vitaly, 2026-09-24 15:30): important events with their
 * live status, her day (brief + today's events), and her latest posts. Replaces the temporary
 * "Important events" box App.tsx carried for cercana-care. */
export function FamilyDashboard({
  circleId, patientName, important, checkins, events, people, moments, version, briefSettings,
  medications, medicationLogs, canManageMedications, onNewImportant, onOpenImportant, onHearBrief,
  onManageMedications,
}: Props) {
  const now = new Date();
  const rows = dashboardImportant(important, checkins, now);
  const doses = todaysDoses(medications, medicationLogs, now);
  const [h, m] = briefSettings.brief_time.split(':').map(Number);
  const briefTime = timeLabel(new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m));
  // Her own day is her important events; calendar events belong to other family members and are
  // only news she hears in the brief — kept apart so "Anna is in London" doesn't read as hers.
  const ownToday = todaysImportantSentences(important, now);
  const todays = todaySentences(mergeBriefingEvents(events, people), now, 4);

  // Her own posts ("Tell the family") plus her voice replies in others' comment threads — the
  // latter come from a per-moment summary (author_person_id null = the patient, by this app's
  // convention), not a bulk comment feed, so only the newest reply per moment is visible here.
  const [summaries, setSummaries] = useState<Record<string, CommentSummary>>({});
  useEffect(() => {
    void commentSummaries(circleId).then(setSummaries).catch(() => {});
  }, [circleId, version]);

  const posts: FromPatientItem[] = moments
    .filter((mo) => mo.by_patient)
    .map((mo) => ({ key: `m-${mo.id}`, at: mo.created_at, text: mo.body ?? '', audioUrl: mo.audio_url }));
  const replies: FromPatientItem[] = Object.values(summaries)
    .filter((sum) => sum.last.author_person_id === null)
    .map((sum) => ({ key: `c-${sum.last.id}`, at: sum.last.created_at, text: commentText(sum.last), audioUrl: sum.last.audio_url }));
  const fromPatient = [...posts, ...replies].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3);

  const [digests, setDigests] = useState<Digest[]>([]);
  useEffect(() => {
    void listDigests(circleId).then(setDigests).catch(() => {}); // the card is optional: no digest yet, no card
  }, [circleId, version]);

  return (
    <View style={{ gap: 20 }}>
      <DigestCard digests={digests} patientName={patientName} />

      <View style={s.card}>
        <Text style={s.cardTitle}>Medicines today</Text>
        {doses.length === 0 && <Text style={s.empty}>No medicines set up yet.</Text>}
        {doses.map((d) => (
          <View key={d.key} style={s.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.rowTitle}>{d.medication.name} — {d.medication.dose}</Text>
              <Text style={s.rowStatus}>{timeLabel(d.scheduledFor)} · {STATUS_ICON[d.status]} {statusLabel(d)}</Text>
            </View>
          </View>
        ))}
        {canManageMedications && <BigButton label="+ Add medicine" tone="plain" onPress={onManageMedications} style={s.addBtn} />}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>Important events</Text>
        {rows.length === 0 && <Text style={s.empty}>No important events yet.</Text>}
        {rows.map(({ event, checkin, status, urgent }) => (
          <Pressable key={event.id} accessibilityRole="button" onPress={() => onOpenImportant(event.id)} style={s.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.rowTitle}>{cardText(event, now)}</Text>
              <Text style={[s.rowStatus, urgent && s.rowStatusUrgent]}>{status}</Text>
            </View>
            {checkin?.note_audio_url ? <VoicePlayer url={checkin.note_audio_url} /> : null}
          </Pressable>
        ))}
        <BigButton label="+ New important event" tone="plain" onPress={onNewImportant} style={s.addBtn} />
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>{patientName}'s day</Text>
        <View style={s.briefRow}>
          <Text style={s.body}>Brief at {briefTime}</Text>
          <Pressable accessibilityRole="button" onPress={onHearBrief} style={s.hearLink}>
            <Text style={s.hearLinkText}>🔊 Hear her brief</Text>
          </Pressable>
        </View>
        {ownToday.length === 0 ? (
          <Text style={s.empty}>Nothing on {patientName}'s calendar today.</Text>
        ) : (
          ownToday.map((line, i) => <Text key={i} style={s.body}>{line}</Text>)
        )}
        {todays.length > 0 && (
          <View style={s.newsBlock}>
            <Text style={s.subTitle}>Family news in her brief</Text>
            {todays.map((line, i) => <Text key={i} style={s.body}>{line}</Text>)}
          </View>
        )}
      </View>

      <View style={s.card}>
        <Text style={s.cardTitle}>From {patientName}</Text>
        {fromPatient.length === 0 ? (
          <Text style={s.empty}>Nothing from {patientName} yet.</Text>
        ) : (
          fromPatient.map((item) => (
            <View key={item.key} style={s.fromRow}>
              {item.text ? <Text style={s.body} numberOfLines={2}>{item.text}</Text> : null}
              {item.audioUrl ? <VoicePlayer url={item.audioUrl} /> : null}
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 10, borderWidth: 1, borderColor: colors.line },
  cardTitle: { fontSize: typeFamily.label, fontWeight: '700', color: colors.inkSoft },
  empty: { fontSize: typeFamily.body, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowTitle: { fontSize: typeFamily.body, fontWeight: '700', color: colors.ink },
  rowStatus: { fontSize: typeFamily.small, fontWeight: '700', color: colors.green },
  rowStatusUrgent: { color: colors.danger },
  addBtn: { marginTop: 4 },
  briefRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  newsBlock: { gap: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8 },
  subTitle: { fontSize: typeFamily.small, fontWeight: '700', color: colors.inkSoft },
  body: { fontSize: typeFamily.body, color: colors.ink },
  hearLink: { minHeight: 40, justifyContent: 'center' },
  hearLinkText: { fontSize: typeFamily.small, fontWeight: '700', color: colors.terracotta },
  fromRow: { gap: 6, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 8 },
});
