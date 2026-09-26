// Doctor-visit helpers for the app side. Pure: no React / RN imports.
import type { FollowUp, MedChange, Medication, MedicationInput, NewEventInput, ProposalStatus, Proposals, Visit } from './types.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const PATIENT_VISIT_DAYS = 7; // how long the gentle summary stays in the patient's day

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export type MedPlan =
  | { kind: 'create'; input: Pick<MedicationInput, 'name' | 'dose' | 'times'> }
  | { kind: 'update'; id: string; patch: Partial<Pick<Medication, 'name' | 'dose' | 'times' | 'active'>> }
  | { kind: 'none'; reason: string };

/** What approving a medicine proposal writes, against today's active medicines (matched by name). */
export function planMedChange(change: MedChange, meds: Medication[]): MedPlan {
  const found = meds.find((m) => m.active && same(m.name, change.name));
  if (change.action === 'stop') {
    return found ? { kind: 'update', id: found.id, patch: { active: false } } : { kind: 'none', reason: `${change.name} is not in the medicines list` };
  }
  if (change.action === 'change' && found) {
    return {
      kind: 'update',
      id: found.id,
      patch: { ...(change.dose ? { dose: change.dose } : {}), ...(change.times.length ? { times: change.times } : {}) },
    };
  }
  // 'add', or a 'change' of something not in the list yet: needs a dose to create.
  if (!change.dose) return { kind: 'none', reason: `No dose was said for ${change.name}` };
  return { kind: 'create', input: { name: change.name, dose: change.dose, times: change.times } };
}

/** A follow-up as a one-hour calendar event. */
export function followUpEvent(f: FollowUp): NewEventInput {
  const start = new Date(f.starts_at);
  return { title: f.title, starts_at: start.toISOString(), ends_at: new Date(start.getTime() + HOUR_MS).toISOString(), all_day: false };
}

/** One-line description of a proposal for the review screen. */
export function describeMedChange(c: MedChange): string {
  const verb = { add: 'Add', change: 'Change', stop: 'Stop' }[c.action];
  const bits = [c.dose, c.times.length ? `at ${c.times.join(', ')}` : c.action === 'stop' ? '' : 'no time given'].filter(Boolean);
  return `${verb} ${c.name}${bits.length ? ` — ${bits.join(', ')}` : ''}`;
}

/** A copy of `p` with one proposal's status set. Out-of-range index returns `p` unchanged. */
export function withStatus(p: Proposals, list: 'med_changes' | 'follow_ups', index: number, status: ProposalStatus): Proposals {
  if (!p[list][index]) return p;
  return { ...p, [list]: p[list].map((item, i) => (i === index ? { ...item, status } : item)) };
}

export const pendingCount = (v: Pick<Visit, 'proposals'>): number =>
  [...v.proposals.med_changes, ...v.proposals.follow_ups].filter((x) => x.status === 'pending').length;

/** The newest visit recent enough to show in the patient's day, else null. */
export function visitForPatient(visits: Visit[], now: Date): Visit | null {
  const fresh = visits
    .filter((v) => now.getTime() - new Date(v.created_at).getTime() <= PATIENT_VISIT_DAYS * DAY_MS)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return fresh[0] ?? null;
}
