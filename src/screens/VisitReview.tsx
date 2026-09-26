import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { BigButton, ErrorText } from '../components/ui';
import {
  addEvent, createMedication, ensureFamilyCalendar, setEventIncludesPatient, updateMedication, updateVisitProposals,
} from '../lib/api';
import { formatDate } from '../lib/dates';
import { timeLabel } from '../lib/briefing';
import { describeMedChange, followUpEvent, planMedChange, withStatus } from '../lib/visit';
import type { Medication, Proposals, ProposalStatus, Visit } from '../lib/types';
import { colors, fonts, typeFamily } from '../theme';

type Props = {
  visit: Visit;
  medications: Medication[];
  canReview: boolean; // can(actor, { type: 'visit.review' }) — lead/admin
  actorPersonId: string | null;
  recordedBy: string | null; // display name, or null for the patient's phone
  onBack: () => void;
  onChanged: () => void; // parent reloads medicines + visits
};

type List = 'med_changes' | 'follow_ups';

const STATUS_TEXT: Record<ProposalStatus, string> = { pending: '', approved: '✓ Added', skipped: 'Skipped' };

/** The family's view of one doctor visit: the plain summary, and each proposed change with
 * Approve / Skip. Approving writes through the existing medicines / events api. */
export function VisitReview({ visit, medications, canReview, actorPersonId, recordedBy, onBack, onChanged }: Props) {
  const [proposals, setProposals] = useState<Proposals>(visit.proposals);
  const [working, setWorking] = useState<string | null>(null); // "list:index" being saved
  const [error, setError] = useState<string | null>(null);

  const decide = async (list: List, index: number, status: ProposalStatus) => {
    setWorking(`${list}:${index}`);
    setError(null);
    try {
      if (status === 'approved') await write(list, index);
      const next = withStatus(proposals, list, index, status);
      await updateVisitProposals(visit.id, next);
      setProposals(next);
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setWorking(null);
    }
  };

  const write = async (list: List, index: number) => {
    if (list === 'follow_ups') {
      const cal = await ensureFamilyCalendar(visit.circle_id);
      const id = await addEvent(visit.circle_id, cal, followUpEvent(proposals.follow_ups[index]), actorPersonId);
      await setEventIncludesPatient(id, true); // a doctor appointment is for the patient
      return;
    }
    const plan = planMedChange(proposals.med_changes[index], medications);
    if (plan.kind === 'none') throw new Error(plan.reason);
    if (plan.kind === 'create') await createMedication(visit.circle_id, { ...plan.input, created_by_person_id: actorPersonId });
    else await updateMedication(plan.id, plan.patch);
  };

  const row = (list: List, index: number, label: string, status: ProposalStatus) => (
    <View key={`${list}-${index}`} style={s.item}>
      <Text style={s.itemText}>{label}</Text>
      {status !== 'pending' ? (
        <Text style={[s.done, status === 'skipped' && { color: colors.inkSoft }]}>{STATUS_TEXT[status]}</Text>
      ) : canReview ? (
        <View style={s.btns}>
          <BigButton label="Approve" tone="green" style={s.btn} busy={working === `${list}:${index}`}
            disabled={working !== null} onPress={() => void decide(list, index, 'approved')} />
          <BigButton label="Skip" tone="plain" style={s.btn} disabled={working !== null}
            onPress={() => void decide(list, index, 'skipped')} />
        </View>
      ) : (
        <Text style={s.wait}>Waiting for the family lead to approve</Text>
      )}
    </View>
  );

  const when = new Date(visit.created_at);
  const anyProposals = proposals.med_changes.length + proposals.follow_ups.length > 0;

  return (
    <View style={s.wrap}>
      <BigButton label="← Back" tone="plain" onPress={onBack} style={s.back} />
      <Text style={s.title}>🩺 Doctor visit</Text>
      <Text style={s.meta}>
        {formatDate(when)}, {timeLabel(when)} · recorded by {recordedBy ?? 'the patient'}
      </Text>

      <Text style={s.h2}>What the doctor said</Text>
      <Text style={s.summary}>{visit.summary}</Text>

      <Text style={s.h2}>Proposed changes</Text>
      {!anyProposals && <Text style={s.wait}>No medicine or appointment changes were heard.</Text>}
      {proposals.med_changes.map((c, i) => row('med_changes', i, `💊 ${describeMedChange(c)}`, c.status))}
      {proposals.follow_ups.map((f, i) => {
        const at = new Date(f.starts_at);
        return row('follow_ups', i, `📅 ${f.title} — ${formatDate(at)}, ${timeLabel(at)}`, f.status);
      })}
      <ErrorText message={error} />
      <Text style={s.foot}>Nothing changes until it is approved. Check the doctor's exact words before you approve a medicine.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 10 },
  back: { alignSelf: 'flex-start', minHeight: 48 },
  title: { fontSize: 28, fontFamily: fonts.display, color: colors.ink },
  meta: { fontSize: typeFamily.label, color: colors.inkSoft },
  h2: { fontSize: typeFamily.title, fontFamily: fonts.display, color: colors.terracottaDark, marginTop: 12 },
  summary: { fontSize: typeFamily.body + 1, lineHeight: 26, color: colors.ink },
  item: { backgroundColor: colors.peachSoft, borderRadius: 16, padding: 14, gap: 10, borderWidth: 1, borderColor: colors.line },
  itemText: { fontSize: typeFamily.body + 1, fontWeight: '700', color: colors.ink, lineHeight: 24 },
  btns: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1 },
  done: { fontSize: typeFamily.body, fontWeight: '800', color: colors.green },
  wait: { fontSize: typeFamily.body, color: colors.inkSoft },
  foot: { fontSize: typeFamily.label, color: colors.inkSoft, marginTop: 8 },
});
