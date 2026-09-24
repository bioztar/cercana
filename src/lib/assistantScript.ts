// Scripted assistant replies for AssistantChat.tsx — no LLM, no network, no writes. Pure + tested;
// the real STT → LLM → TTS agent is a later mission (see 20260924-cercana-assistant-ui.md).
import { timeLabel } from './briefing.ts';
import { startOfDay, WEEKDAYS } from './dates.ts';
import { titleFromTranscript } from './voice.ts';
import type { EventRow, Person } from './types.ts';

export type AssistantCard = { title: string; when: string };
export type AssistantReply = { text: string; card?: AssistantCard };
export type AssistantContext = { people: Person[]; events: EventRow[] };

const pad = (n: number) => String(n).padStart(2, '0');

/** Next date (including today) whose weekday matches `target` (0=Sunday). */
function nextWeekday(target: number, now: Date): Date {
  const start = startOfDay(now);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    if (d.getDay() === target) return d;
  }
  return start;
}

/** "at 1:30" / "1:30pm" / "13:30" → 24h {h, m}, or null. */
function parseTime(lower: string): { h: number; m: number } | null {
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i.exec(lower);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return { h, m: min };
}

/** Weekday names, today/tomorrow, and a time if present → "Weekday HH:MM"; falls back to "Tomorrow 10:00". */
function parseWhen(lower: string, now: Date): string {
  let dayWord: string | null = null;
  if (/\btoday\b/.test(lower)) dayWord = 'Today';
  else if (/\btomorrow\b/.test(lower)) dayWord = 'Tomorrow';
  else {
    for (let i = 0; i < WEEKDAYS.length; i++) {
      if (lower.includes(WEEKDAYS[i].toLowerCase())) { dayWord = WEEKDAYS[i]; break; }
    }
  }
  const time = parseTime(lower);
  if (!dayWord && !time) return 'Tomorrow 10:00';
  const t = time ? `${pad(time.h)}:${pad(time.m)}` : '10:00';
  return `${dayWord ?? 'Tomorrow'} ${t}`;
}

/** Strips trigger words, day/time phrases → a short title, or "Reminder" if nothing is left. */
function parseTitle(text: string): string {
  const leadTrigger = /^(please\s+)?(can you\s+)?(remind me to|remember to|add|schedule|book|note)\s+/i;
  let t = text;
  let prev: string;
  do { prev = t; t = t.replace(leadTrigger, ''); } while (t !== prev); // "remind me to add lunch" → strip both
  t = t.replace(/\b(today|tomorrow)\b/gi, '');
  for (const w of WEEKDAYS) t = t.replace(new RegExp(`\\b${w}\\b`, 'gi'), '');
  t = t.replace(/\b(at|on)\s+\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi, '');
  t = t.replace(/\b(at|on)\s*$/i, '');
  return titleFromTranscript(t) || 'Reminder';
}

/** Scripted reply to one message from Carmen. Deterministic; safe to call on every keystroke/send. */
export function reply(text: string, now: Date, context: AssistantContext): AssistantReply {
  const lower = text.toLowerCase();

  if (/\b(add|remind|calendar|lunch|doctor|cita)\b/i.test(lower)) {
    const title = parseTitle(text);
    const when = parseWhen(lower, now);
    return { text: `Add ${title}, ${when}? Yes / No`, card: { title, when } };
  }

  const named = context.people.find((p) => lower.includes(p.name.toLowerCase()));
  if (named) return { text: `${named.name} is ${named.relation ?? 'in your family'}.` };
  if (/\b(who|family)\b/i.test(lower)) {
    const list = context.people.map((p) => `${p.name} (${p.relation ?? 'family'})`).join(', ');
    return { text: list ? `Your family: ${list}.` : "I don't see anyone in your circle yet." };
  }

  if (/\btoday\b/.test(lower) || lower.includes("what's on") || lower.includes('whats on')) {
    const today = startOfDay(now).getTime();
    const todays = context.events.filter((e) => startOfDay(new Date(e.starts_at)).getTime() === today);
    if (todays.length === 0) return { text: 'Nothing on the calendar today.' };
    const items = todays.map((e) => `${e.title ?? '(no title)'}${e.all_day ? '' : ` at ${timeLabel(new Date(e.starts_at))}`}`);
    return { text: `Today: ${items.join(', ')}.` };
  }

  return { text: "I'm here. I can add things to your calendar or tell your family something." };
}
