// Pure logic for medication reminders: today's doses, their status, and spoken lines.
// No React / RN imports so `node --test` can run it.
import { timeLabel } from './briefing.ts';
import type { Medication, MedicationLog } from './types.ts';

const DUE_WINDOW_MIN = 60; // "due" from its time until +60 min, then "missed"
export const SNOOZE_MIN = 30; // "Not yet" re-asks in 30 min (local only, not persisted)

export type DoseStatus = 'taken' | 'skipped' | 'due' | 'missed' | 'upcoming';

export type Dose = {
  key: string; // stable per medicine+time-today, for React keys and the snooze map
  medication: Medication;
  time: string; // 'HH:MM'
  scheduledFor: Date;
  status: DoseStatus;
  log: MedicationLog | null;
};

export const doseKey = (medicationId: string, scheduledFor: Date): string =>
  `${medicationId}|${scheduledFor.toISOString()}`;

/** Today's local Date for a 'HH:MM' time string, relative to `now`'s day. */
function doseTime(now: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
}

export function doseStatus(scheduledFor: Date, log: MedicationLog | null, now: Date): DoseStatus {
  if (log) return log.status;
  const minutesSince = (now.getTime() - scheduledFor.getTime()) / 60_000;
  if (minutesSince < 0) return 'upcoming';
  return minutesSince <= DUE_WINDOW_MIN ? 'due' : 'missed';
}

/** Every active medicine's doses for today, soonest first. */
export function todaysDoses(meds: Medication[], logs: MedicationLog[], now: Date): Dose[] {
  const byKey = new Map(logs.map((l) => [doseKey(l.medication_id, new Date(l.scheduled_for)), l]));
  const doses: Dose[] = [];
  for (const med of meds) {
    if (!med.active) continue;
    for (const time of med.times) {
      const scheduledFor = doseTime(now, time);
      const key = doseKey(med.id, scheduledFor);
      doses.push({ key, medication: med, time, scheduledFor, status: doseStatus(scheduledFor, byKey.get(key) ?? null, now), log: byKey.get(key) ?? null });
    }
  }
  return doses.sort((a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime());
}

/** The next dose still open (due, missed, or upcoming), soonest first; null once today is done. */
export function nextDose(doses: Dose[]): Dose | null {
  return doses.find((d) => d.status === 'due' || d.status === 'missed' || d.status === 'upcoming') ?? null;
}

/** The dose that should pop the full-screen "Did you take it?" now: earliest due dose that isn't
 * snoozed past `now` (see SNOOZE_MIN / snoozeUntil). */
export function dueDoseNow(doses: Dose[], now: Date, snoozedUntil: Record<string, string> = {}): Dose | null {
  return doses.find((d) => d.status === 'due' && !(snoozedUntil[d.key] && new Date(snoozedUntil[d.key]) > now)) ?? null;
}

export const snoozeUntil = (now: Date): string => new Date(now.getTime() + SNOOZE_MIN * 60_000).toISOString();

/** "Time for your blood pressure pill, 1 pill". */
export function spokenLine(dose: Dose): string {
  return `Time for your ${dose.medication.name}, ${dose.medication.dose}`;
}

export const STATUS_ICON: Record<DoseStatus, string> = { taken: '✓', due: '⏳', missed: '✗', upcoming: '○', skipped: '⏭' };

/** Family-side status label, e.g. "taken 08:04", "due", "missed", "upcoming". */
export function statusLabel(dose: Dose): string {
  if (dose.status === 'taken' && dose.log) return `taken ${timeLabel(new Date(dose.log.answered_at))}`;
  return dose.status;
}
