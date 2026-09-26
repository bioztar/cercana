// Pure logic for the `assistant` edge function (and the demo stand-in): request validation, relative-date
// resolution (English + Spanish), distress heuristics, prompt building, model-output sanitising.
// No Deno / React imports so `node --test` can run it.

export type Proposal = {
  title: string;
  starts_at: string; // ISO instant; all_day → UTC midnight of the date (app convention)
  ends_at?: string;
  location?: string;
  note?: string;
  all_day?: boolean; // date known, time not
};

export type HistoryItem = { role: 'user' | 'assistant'; text: string };

export type AssistantRequest = {
  circle_id: string;
  speaker_person_id: string | null;
  mode: 'chat' | 'dictate';
  text: string;
  audio_url: string | null;
  history: HistoryItem[];
  now: string;
  tz: string;
};

export const CAPS = { text: 1000, historyItems: 8, historyText: 500, url: 500, dailyCalls: 300 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validTz(tz: unknown): tz is string {
  if (typeof tz !== 'string' || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Fail-fast check of an untrusted body. Returns the cleaned request or a message. */
export function validateRequest(body: unknown): { ok: true; value: AssistantRequest } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b.circle_id !== 'string' || !UUID.test(b.circle_id)) return { ok: false, error: 'circle_id must be a uuid' };
  const speaker = b.speaker_person_id ?? null;
  if (speaker !== null && (typeof speaker !== 'string' || !UUID.test(speaker))) return { ok: false, error: 'speaker_person_id must be a uuid or null' };
  if (b.mode !== 'chat' && b.mode !== 'dictate') return { ok: false, error: "mode must be 'chat' or 'dictate'" };
  const text = typeof b.text === 'string' ? b.text.trim() : '';
  if (text.length > CAPS.text) return { ok: false, error: 'text too long' };
  const audio = typeof b.audio_url === 'string' && b.audio_url ? b.audio_url : null;
  if (audio && (audio.length > CAPS.url || !/^https:\/\//.test(audio))) return { ok: false, error: 'audio_url must be an https url' };
  if (!text && !audio) return { ok: false, error: 'text or audio_url is required' };
  const rawHistory = Array.isArray(b.history) ? b.history : [];
  const history: HistoryItem[] = rawHistory.slice(-CAPS.historyItems).flatMap((h) => {
    const r = (h ?? {}) as Record<string, unknown>;
    if ((r.role !== 'user' && r.role !== 'assistant') || typeof r.text !== 'string') return [];
    return [{ role: r.role, text: r.text.slice(0, CAPS.historyText) }];
  });
  const now = typeof b.now === 'string' ? b.now : '';
  if (Number.isNaN(new Date(now).getTime())) return { ok: false, error: 'now must be an ISO timestamp' };
  if (!validTz(b.tz)) return { ok: false, error: 'tz must be an IANA time zone' };
  return { ok: true, value: { circle_id: b.circle_id, speaker_person_id: speaker, mode: b.mode, text, audio_url: audio, history, now, tz: b.tz } };
}

// ---- time zones ------------------------------------------------------------------------------

export type Ymd = { y: number; m: number; d: number }; // m 1-12
export type Hm = { h: number; mi: number };

const pad = (n: number) => String(n).padStart(2, '0');

/** Wall-clock parts of `at` in `tz`. */
export function localParts(at: Date, tz: string): Ymd & Hm & { weekday: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', weekday: 'short',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  return { y: Number(get('year')), m: Number(get('month')), d: Number(get('day')), h: Number(get('hour')) % 24, mi: Number(get('minute')), weekday };
}

/** The UTC instant at which the wall clock in `tz` reads y-m-d h:mi. */
export function zonedToUtc(ymd: Ymd, hm: Hm, tz: string): Date {
  const guess = Date.UTC(ymd.y, ymd.m - 1, ymd.d, hm.h, hm.mi);
  let ts = guess;
  for (let i = 0; i < 2; i++) { // offset can shift across a DST edge, so refine once
    const lp = localParts(new Date(ts), tz);
    ts += guess - Date.UTC(lp.y, lp.m - 1, lp.d, lp.h, lp.mi);
  }
  return new Date(ts);
}

const addDays = (ymd: Ymd, n: number): Ymd => {
  const d = new Date(Date.UTC(ymd.y, ymd.m - 1, ymd.d + n));
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const cmp = (a: Ymd, b: Ymd) => Date.UTC(a.y, a.m - 1, a.d) - Date.UTC(b.y, b.m - 1, b.d);

// ---- relative-date resolution ----------------------------------------------------------------

const MONTH_WORDS: Record<string, number> = {
  january: 1, jan: 1, enero: 1, february: 2, feb: 2, febrero: 2, march: 3, mar: 3, marzo: 3, april: 4, apr: 4, abril: 4,
  may: 5, mayo: 5, june: 6, jun: 6, junio: 6, july: 7, jul: 7, julio: 7, august: 8, aug: 8, agosto: 8,
  september: 9, sep: 9, sept: 9, septiembre: 9, setiembre: 9, october: 10, oct: 10, octubre: 10,
  november: 11, nov: 11, noviembre: 11, december: 12, dec: 12, diciembre: 12,
};
const WEEKDAY_WORDS: Record<string, number> = {
  sunday: 0, domingo: 0, monday: 1, lunes: 1, tuesday: 2, martes: 2, wednesday: 3, miercoles: 3,
  thursday: 4, jueves: 4, friday: 5, viernes: 5, saturday: 6, sabado: 6,
};
const monthRe = Object.keys(MONTH_WORDS).sort((a, b) => b.length - a.length).join('|');
const weekdayRe = Object.keys(WEEKDAY_WORDS).join('|');

/** Lowercase, accent-free, with "morning" phrases neutralised so "mañana" only ever means tomorrow. */
function norm(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\b(de la|por la|en la) manana\b/g, ' am ')
    .replace(/\b(in the )?morning\b/g, ' am ');
}

/** Date of the next `weekday` strictly after `today`. */
function nextWeekday(today: Ymd, todayDow: number, target: number): Ymd {
  const delta = ((target - todayDow + 7) % 7) || 7;
  return addDays(today, delta);
}

/** Resolves the date phrase in `text` against `now` in `tz`. Null when there is none. */
export function resolveDate(text: string, now: Date, tz: string): Ymd | null {
  const t = norm(text);
  const lp = localParts(now, tz);
  const today: Ymd = { y: lp.y, m: lp.m, d: lp.d };

  const iso = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (iso) return { y: Number(iso[1]), m: Number(iso[2]), d: Number(iso[3]) };

  if (/\b(pasado manana|day after tomorrow)\b/.test(t)) return addDays(today, 2);
  if (/\b(tomorrow|manana)\b/.test(t)) return addDays(today, 1);
  if (/\b(today|hoy|tonight|esta noche)\b/.test(t)) return today;

  const inN = /\b(?:in|dentro de|en)\s+(\d{1,2})\s+(day|days|dia|dias|week|weeks|semana|semanas)\b/.exec(t);
  if (inN) return addDays(today, Number(inN[1]) * (/^(w|s)/.test(inN[2]) ? 7 : 1));

  const monthDay = (d: number, m: number): Ymd | null => {
    if (d < 1 || d > 31) return null;
    for (const y of [today.y, today.y + 1]) {
      if (d <= daysInMonth(y, m) && cmp({ y, m, d }, today) >= 0) return { y, m, d };
    }
    return null;
  };
  const dm = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+|de\\s+)?(${monthRe})\\b`).exec(t);
  if (dm) return monthDay(Number(dm[1]), MONTH_WORDS[dm[2]]);
  const md = new RegExp(`\\b(${monthRe})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`).exec(t);
  if (md) return monthDay(Number(md[2]), MONTH_WORDS[md[1]]);

  const wd = new RegExp(`\\b(${weekdayRe})\\b`).exec(t);
  if (wd) return nextWeekday(today, lp.weekday, WEEKDAY_WORDS[wd[1]]);

  const dom = /\b(?:the|el|dia)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?::|h\b|am\b|pm\b))/.exec(t);
  if (dom) {
    const d = Number(dom[1]);
    for (let i = 0; i < 13; i++) {
      const m0 = today.m - 1 + i;
      const y = today.y + Math.floor(m0 / 12);
      const m = (m0 % 12) + 1;
      if (d >= 1 && d <= daysInMonth(y, m) && cmp({ y, m, d }, today) >= 0) return { y, m, d };
    }
  }
  return null;
}

/** Resolves a clock time ("at 11", "9:30", "a las 11 y media", "3pm", "noon"). Null when none. */
export function resolveTime(text: string): Hm | null {
  const t = norm(text);
  const pm = /\b(pm|p\.m\.|de la tarde|de la noche|por la tarde|in the afternoon|in the evening|at night)\b/.test(t);
  const am = /\b(am|a\.m\.)\b/.test(t);
  const fix = (h: number, mi: number): Hm | null => {
    if (h > 23 || mi > 59) return null;
    if (pm && h < 12) h += 12;
    else if (am && h === 12) h = 0;
    else if (!pm && !am && h >= 1 && h <= 6) h += 12; // "dentist at 3" is an afternoon appointment
    return { h, mi };
  };
  if (/\b(noon|mediodia)\b/.test(t)) return { h: 12, mi: 0 };
  const hm = /\b(\d{1,2})[:.h](\d{2})\b/.exec(t);
  if (hm) return fix(Number(hm[1]), Number(hm[2]));
  const at = /\b(?:at|a las|a la|around|sobre las)\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th))(\s+y (media|cuarto)|\s+menos cuarto)?/.exec(t);
  if (at) {
    const h = Number(at[1]);
    if (at[2]?.includes('media')) return fix(h, 30);
    if (at[2]?.includes('cuarto') && at[2].includes('menos')) return fix(h - 1, 45);
    if (at[2]?.includes('cuarto')) return fix(h, 15);
    return fix(h, 0);
  }
  const ap = /\b(\d{1,2})\s*(am|pm)\b/.exec(t);
  if (ap) return fix(Number(ap[1]), 0);
  return null;
}

export type Resolved = { date: Ymd | null; time: Hm | null };
export const resolveWhen = (text: string, now: Date, tz: string): Resolved => ({
  date: resolveDate(text, now, tz), time: resolveTime(text),
});

/** Date + optional time → proposal instants. No time → all-day (UTC midnight span). */
export function instants(date: Ymd, time: Hm | null, tz: string, durationMin = 60): Pick<Proposal, 'starts_at' | 'ends_at' | 'all_day'> {
  if (!time) {
    const next = addDays(date, 1);
    return {
      starts_at: new Date(Date.UTC(date.y, date.m - 1, date.d)).toISOString(),
      ends_at: new Date(Date.UTC(next.y, next.m - 1, next.d)).toISOString(),
      all_day: true,
    };
  }
  const start = zonedToUtc(date, time, tz);
  return { starts_at: start.toISOString(), ends_at: new Date(start.getTime() + durationMin * 60_000).toISOString() };
}

// ---- distress ---------------------------------------------------------------------------------

const DISTRESS = [
  /where am i/, /donde estoy/, /(i'?m|i am|im) (so |very |really )?(scared|afraid|frightened|lost|confused)/,
  /tengo (mucho )?miedo/, /estoy (perdida|perdido|asustada|asustado|confundida|confundido)/,
  /i (don'?t|do not) know (where|who)/, /no se (donde|quien|que)/, /(want|need) to go home/, /quiero (ir a )?(mi )?casa/,
  /\b(help me|ayudame|socorro)\b/, /nobody (is )?(here|coming)/, /no (hay|viene) nadie/,
];

/** Cheap keyword net; the model judges the subtler cases (e.g. asking for someone who has died). */
export const looksDistressed = (text: string): boolean => {
  const t = norm(text).replace(/[’']/g, "'");
  return DISTRESS.some((re) => re.test(t));
};

// ---- prompt + model output --------------------------------------------------------------------

export type PromptContext = {
  patientName: string;
  speaker: { name: string; relation: string | null } | null; // null = the patient
  mode: 'chat' | 'dictate';
  people: { name: string; relation: string | null }[];
  events: { title: string | null; starts_at: string; all_day: boolean; location: string | null }[];
  doses: { name: string; dose: string; time: string }[]; // today, 'HH:MM'
  now: Date;
  tz: string;
};

const fmtWhen = (iso: string, allDay: boolean, tz: string): string => {
  if (allDay) {
    const d = new Date(iso);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} (all day)`;
  }
  const lp = localParts(new Date(iso), tz);
  return `${lp.y}-${pad(lp.m)}-${pad(lp.d)} ${pad(lp.h)}:${pad(lp.mi)}`;
};

export function buildSystemPrompt(c: PromptContext): string {
  const lp = localParts(c.now, c.tz);
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][lp.weekday];
  const people = c.people.map((p) => `- ${p.name}${p.relation ? ` (${p.relation})` : ''}`).join('\n') || '- (nobody added yet)';
  const events = c.events.map((e) => `- ${fmtWhen(e.starts_at, e.all_day, c.tz)} ${e.title ?? '(no title)'}${e.location ? ` @ ${e.location}` : ''}`).join('\n') || '- (nothing)';
  const doses = c.doses.map((d) => `- ${d.time} ${d.name} ${d.dose}`).join('\n') || '- (none)';
  const who = c.mode === 'chat'
    ? `You are the gentle assistant of ${c.patientName}, an older person who may have memory loss. ${c.patientName} is speaking to you. `
      + 'Answer in one or two SHORT, warm, calm sentences, in the same language she used. Never alarming. '
      + 'If she asks about a person, a date, a medicine or what is on, answer ONLY from the data below. '
      + 'If the data does not say, answer "I\'m not sure" (in her language) — never guess a name, date or time.'
    : `${c.speaker ? `${c.speaker.name}${c.speaker.relation ? ` (${c.speaker.relation})` : ''}` : 'A family member'} is dictating a calendar event for ${c.patientName}. `
      + 'Extract it. Reply with one short confirmation sentence in the language spoken.';
  return [
    who,
    `Now: ${lp.y}-${pad(lp.m)}-${pad(lp.d)} ${pad(lp.h)}:${pad(lp.mi)}, ${dayName}, time zone ${c.tz}.`,
    `People in the circle:\n${people}`,
    `Events in the next 14 days (local time):\n${events}`,
    `${c.patientName}'s medicines today:\n${doses}`,
    'Reply with ONE JSON object only:',
    '{"reply": string, "distress": boolean, "event": null | {"title": string, "date": "YYYY-MM-DD" | null, "time": "HH:MM" | null, "duration_min": number | null, "location": string | null, "note": string | null}}',
    'Set "event" only when the speaker asks to add/remember/schedule something on the calendar (always in dictate mode). '
      + 'Resolve relative days ("next Tuesday", "el jueves", "the 3rd") from Now. If the day or the time is missing in chat mode, set event null and ASK for it in "reply". '
      + 'When "event" is set, "reply" is the yes/no question, e.g. "Add dentist on Tuesday at 11:00?". "title" is short (2-4 words), "note" holds extras like "bring the blood test".',
    `Set "distress" true if the speaker sounds lost, afraid or confused (e.g. "where am I", "I'm scared"), or asks for someone who has died or is not in the list above as living nearby. When distress, "reply" must be calm and reassuring and suggest calling family.`,
  ].join('\n\n');
}

export const FALLBACK_REPLY = "I'm not sure I understood. Could you say it again?";
const CALM_REPLY = "You're safe. I'm here with you. Let's call your family.";

const str = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);

/** Turns the model's JSON (untrusted) into a validated reply. Deterministic date/time parsing of the
 * speaker's own words wins over the model's guess. */
export function shapeResponse(
  raw: unknown, req: Pick<AssistantRequest, 'text' | 'mode'>, now: Date, tz: string,
): { reply: string; proposal?: Proposal; distress: boolean } {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const distress = o.distress === true || looksDistressed(req.text);
  let reply = str(o.reply, 400) ?? (distress ? CALM_REPLY : FALLBACK_REPLY);
  const ev = (o.event && typeof o.event === 'object' ? o.event : null) as Record<string, unknown> | null;
  if (!ev) return { reply, distress };

  const title = str(ev.title, 80);
  const own = resolveWhen(req.text, now, tz);
  const modelDate = typeof ev.date === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ev.date) : null;
  const date = own.date ?? (modelDate ? { y: Number(modelDate[1]), m: Number(modelDate[2]), d: Number(modelDate[3]) } : null);
  const modelTime = typeof ev.time === 'string' ? /^(\d{1,2}):(\d{2})$/.exec(ev.time) : null;
  const time = own.time ?? (modelTime && Number(modelTime[1]) < 24 && Number(modelTime[2]) < 60 ? { h: Number(modelTime[1]), mi: Number(modelTime[2]) } : null);
  const valid = date && date.m >= 1 && date.m <= 12 && date.d >= 1 && date.d <= daysInMonth(date.y, date.m);
  if (!title || !valid || (!time && req.mode === 'chat')) {
    // chat needs both day and time before asking Yes/No; otherwise the model's reply should be a question
    if (req.mode === 'chat' && reply.includes('?') === false) reply = FALLBACK_REPLY;
    return { reply, distress };
  }
  const dur = typeof ev.duration_min === 'number' && ev.duration_min > 0 && ev.duration_min <= 720 ? Math.round(ev.duration_min) : 60;
  const proposal: Proposal = { title, ...instants(date, time, tz, dur) };
  const location = str(ev.location, 120);
  const note = str(ev.note, 200);
  if (location) proposal.location = location;
  if (note) proposal.note = note;
  return { reply, proposal, distress };
}
