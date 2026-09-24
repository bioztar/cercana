import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Checkin, ImportantEvent, Person } from '../lib/types';
import { ANSWER_LABEL, REMINDER_LABEL, deliveryOf, hasNotAnswered } from '../lib/important';
import { VoicePlayer } from '../components/VoicePlayer';
import { colors } from '../theme';

type Props = {
  event: ImportantEvent;
  checkin: Checkin | null;
  people: Person[];
  /** permissions.can(actor, { type: 'viewCheckin', creatorId: event.created_by_person_id }) —
   * creator + lead/admin only (Vitaly, 2026-09-24 14:50); other members see the reminders, not the answer. */
  canView: boolean;
  onBack: () => void;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Family: one important event — Mom's answer, each reminder's delivery, her voice note.
 * Matches design/mockups/ImpStatus.png. */
export function ImportantStatus({ event, checkin, people, canView, onBack }: Props) {
  const author = people.find((p) => p.id === event.created_by_person_id)?.name;
  const now = new Date();
  const notAnswered = hasNotAnswered(event, checkin, now);

  return (
    <View>
      <Pressable onPress={onBack} accessibilityRole="button" style={s.back}>
        <Text style={s.backText}>‹ Calendar</Text>
      </Pressable>
      <Text style={s.badge}>Important</Text>
      <Text style={s.title}>{event.title}</Text>
      <Text style={s.sub}>
        Mom · {fmt(event.starts_at)}{author ? ` · added by ${author}` : ''}
      </Text>

      {!canView ? (
        <Text style={s.waiting}>Only the person who added this and family admins can see Mom's answer.</Text>
      ) : checkin ? (
        <View style={s.answerBox}>
          <Text style={s.answerHeadline}>{ANSWER_LABEL[checkin.answer]}</Text>
          <Text style={s.answerSub}>answered {fmt(checkin.answered_at)}</Text>
        </View>
      ) : notAnswered ? (
        <Text style={s.notAnswered}>Mom hasn't answered yet — you might want to check in with her.</Text>
      ) : (
        <Text style={s.waiting}>Waiting for Mom's answer.</Text>
      )}

      {canView && checkin?.note_audio_url ? (
        <View style={s.voice}>
          <Text style={s.voiceLabel}>Mom shared what she said</Text>
          <VoicePlayer url={checkin.note_audio_url} />
        </View>
      ) : null}

      <Text style={s.remindersTitle}>Notifications to Mom</Text>
      <View style={s.reminders}>
        {event.reminders.map((r) => (
          <View key={r.kind} style={s.reminderRow}>
            <Text style={s.reminderLabel}>{REMINDER_LABEL[r.kind]}</Text>
            <Text style={s.reminderSub}>
              {fmt(r.at)} · {deliveryOf(r, now) === 'delivered' ? 'delivered' : 'scheduled'}
              {r.kind === 'check' && canView && checkin ? ` · answer: "${ANSWER_LABEL[checkin.answer]}"` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', marginBottom: 8 },
  backText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start', fontSize: 14, fontWeight: '800', color: colors.terracottaDark,
    backgroundColor: colors.peach, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, marginBottom: 8,
  },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2, marginBottom: 16 },
  answerBox: { backgroundColor: '#E4F0E1', borderRadius: 14, padding: 14, marginBottom: 12 },
  answerHeadline: { fontSize: 18, fontWeight: '800', color: colors.green },
  answerSub: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  waiting: { fontSize: 16, color: colors.inkSoft, marginBottom: 12 },
  notAnswered: { fontSize: 16, color: colors.terracottaDark, fontWeight: '700', marginBottom: 12 },
  voice: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 16, gap: 8 },
  voiceLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  remindersTitle: { fontSize: 15, fontWeight: '700', color: colors.inkSoft, marginBottom: 8 },
  reminders: { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 12 },
  reminderRow: { gap: 2 },
  reminderLabel: { fontSize: 16, fontWeight: '700', color: colors.ink },
  reminderSub: { fontSize: 14, color: colors.inkSoft },
});
