// Pure parts of the `visit` edge function: validate what the model says about a doctor visit.
// No Deno / RN imports, so `node --test` can run it (src/lib/visit.test.ts).
// Rule: never invent a dose. A proposal the transcript does not support is dropped, not repaired.

export type MedAction = 'add' | 'change' | 'stop';
export type ProposalStatus = 'pending' | 'approved' | 'skipped';

export type MedChange = { action: MedAction; name: string; dose: string; times: string[]; status: ProposalStatus };
export type FollowUp = { title: string; starts_at: string; status: ProposalStatus };
export type Proposals = { med_changes: MedChange[]; follow_ups: FollowUp[] };
export type VisitResult = { summary: string; patient_summary: string } & Proposals;

export const MAX_TRANSCRIPT_CHARS = 80_000; // ~50 min of speech; longer is refused, not truncated
export const MAX_PROPOSALS = 12;
const MAX_TEXT = 2000;

const NUMBER_WORDS: Record<string, string> = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8',
  nine: '9', ten: '10', eleven: '11', twelve: '12', half: '0.5', una: '1', un: '1', dos: '2', tres: '3',
  cuatro: '4', cinco: '5', seis: '6', siete: '7', ocho: '8', nueve: '9', diez: '10', media: '0.5', medio: '0.5',
};

const str = (v: unknown, max = 200): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Every number in the transcript, as digits, with spoken number words folded in ("five" -> "5"). */
function numbersHeard(transcript: string): Set<string> {
  const heard = new Set<string>();
  const lower = transcript.toLowerCase().replace(/(\d),(\d)/g, '$1.$2');
  for (const m of lower.match(/\d+(?:\.\d+)?/g) ?? []) heard.add(m);
  for (const w of lower.match(/[a-záéíóúñ]+/g) ?? []) if (NUMBER_WORDS[w]) heard.add(NUMBER_WORDS[w]);
  return heard;
}

/** True when every number in `dose` was actually said in the transcript. "5 mg" needs a 5 heard. */
export function doseSupported(dose: string, transcript: string): boolean {
  const wanted = dose.toLowerCase().replace(/(\d),(\d)/g, '$1.$2').match(/\d+(?:\.\d+)?/g) ?? [];
  const heard = numbersHeard(transcript);
  return wanted.every((n) => heard.has(n));
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Valid 'HH:MM' strings, de-duplicated, sorted, at most 4 (the Medicines form's limit). */
export function cleanTimes(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const ok = v.filter((t): t is string => typeof t === 'string' && HHMM.test(t.trim())).map((t) => t.trim());
  return [...new Set(ok)].sort().slice(0, 4);
}

export function cleanMedChange(raw: unknown, transcript: string): MedChange | null {
  if (!isObj(raw)) return null;
  const action = raw.action;
  if (action !== 'add' && action !== 'change' && action !== 'stop') return null;
  const name = str(raw.name, 80);
  if (!name) return null;
  const dose = str(raw.dose, 80);
  const times = cleanTimes(raw.times);
  if (action === 'add' && !dose) return null; // an add without a dose would be a guess
  if (action === 'change' && !dose && times.length === 0) return null; // nothing to change
  if (dose && !doseSupported(dose, transcript)) return null; // number the doctor never said
  return { action, name, dose, times, status: 'pending' };
}

/** A follow-up needs a title and a real, parseable date. Returns the start as an ISO instant. */
export function cleanFollowUp(raw: unknown): FollowUp | null {
  if (!isObj(raw)) return null;
  const title = str(raw.title, 120);
  const at = typeof raw.starts_at === 'string' ? new Date(raw.starts_at) : null;
  if (!title || !at || Number.isNaN(at.getTime())) return null;
  return { title, starts_at: at.toISOString(), status: 'pending' };
}

/** Model JSON -> a safe VisitResult, or null when there is no usable summary at all. */
export function parseVisit(raw: unknown, transcript: string): VisitResult | null {
  if (!isObj(raw)) return null;
  const summary = str(raw.summary, MAX_TEXT);
  if (!summary) return null;
  const meds = (Array.isArray(raw.med_changes) ? raw.med_changes : [])
    .map((m) => cleanMedChange(m, transcript))
    .filter((m): m is MedChange => m !== null);
  const follow = (Array.isArray(raw.follow_ups) ? raw.follow_ups : [])
    .map(cleanFollowUp)
    .filter((f): f is FollowUp => f !== null);
  return {
    summary,
    patient_summary: str(raw.patient_summary, MAX_TEXT) || summary,
    med_changes: meds.slice(0, MAX_PROPOSALS),
    follow_ups: follow.slice(0, MAX_PROPOSALS),
  };
}

/** System prompt. `now` / `tz` let the model turn "next Tuesday" into a real date. */
export function visitPrompt(patientName: string, now: string, tz: string): string {
  return [
    `You read the transcript of a doctor's visit for ${patientName}, an older person with memory loss, recorded by family.`,
    `Now is ${now} (time zone ${tz}). Answer with ONE JSON object and nothing else:`,
    '{"summary": string, "patient_summary": string,',
    ' "med_changes": [{"action": "add"|"change"|"stop", "name": string, "dose": string, "times": ["HH:MM"]}],',
    ' "follow_ups": [{"title": string, "starts_at": ISO 8601 with offset}]}',
    'Rules:',
    '- summary: plain, factual, for the family: diagnosis, what the doctor said, what to watch for. Same language as the speakers.',
    `- patient_summary: 2-3 short, warm, calm sentences for ${patientName}. Never alarming, no jargon. Same language as the speakers.`,
    '- med_changes: only medicines the doctor clearly started, changed or stopped. Use the doctor\'s exact dose words; never guess a dose or number. If no dose was said, leave the change out.',
    '- times: only when the doctor gave them ("morning" = 08:00, "night" = 21:00 is fine); otherwise [].',
    '- follow_ups: only appointments with a date or day the doctor stated. Resolve relative days from now. If the date is unclear, leave it out.',
    '- If something is not in the transcript, do not add it. Empty arrays are fine.',
  ].join('\n');
}
