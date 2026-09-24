// Pure helpers (no RN imports — tested with node --test).

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

export function generateCode(random: () => number = Math.random, length = 6): string {
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return out;
}

/** Uppercases and strips spaces/dashes; maps look-alikes (0→O is invalid, so 0/1 are dropped by validation). */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export const isValidCode = (code: string) => new RegExp(`^[${CODE_ALPHABET}]{6}$`).test(code);

export function phoneDigits(phone: string | null | undefined): string {
  return (phone ?? '').replace(/\D/g, '');
}

export function whatsappUrl(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  return d.length >= 6 ? `https://wa.me/${d}` : null;
}

export function telUrl(phone: string | null | undefined): string | null {
  const d = phoneDigits(phone);
  if (d.length < 6) return null;
  return `tel:${(phone ?? '').trim().startsWith('+') ? '+' : ''}${d}`;
}

/**
 * Accepts "YYYY-MM-DD" or "MM-DD" (year unknown → stored as year 0004, a leap year so Feb 29 works).
 * Returns the ISO string for the `date` column, '' for empty input, or null when invalid.
 */
export function normalizeBirthdayInput(input: string): string | '' | null {
  const s = input.trim();
  if (s === '') return '';
  const m = /^(?:(\d{4})-)?(\d{1,2})-(\d{1,2})$/.exec(s);
  if (!m) return null;
  const year = m[1] ? Number(m[1]) : 4;
  const month = Number(m[2]);
  const day = Number(m[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (year >= 100 && (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day)) return null;
  if (year < 100 && (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(4, month, 0)).getUTCDate())) return null;
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

/** Inverse of the above for editing: "1990-03-05" or "03-05" when year unknown. */
export function birthdayToInput(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!m) return '';
  return Number(m[1]) < 1000 ? `${m[2]}-${m[3]}` : `${m[1]}-${m[2]}-${m[3]}`;
}

/**
 * Non-secret hint shown after an ICS URL is saved. iCloud/Outlook feed URLs end in a secret token,
 * so only a ".ics" file name (Google's "basic.ics") or the bare host is ever shown.
 */
export function urlHint(raw: string): string {
  const m = /^(?:https?|webcal):\/\/([^/?#]+)([^?#]*)/i.exec(raw.trim());
  if (!m) return '';
  const file = m[2].split('/').filter(Boolean).pop() ?? '';
  return /^[\w.-]{1,40}\.ics$/i.test(file) && !/^private-/i.test(file) ? `…/${file}` : m[1];
}

/** RFC 4122 v4 id. Hermes has no crypto.randomUUID, and calendars can't be read back after insert. */
export function uuidv4(random: () => number = Math.random): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Relations are stored from the patient's view ("your son"). Family-facing screens show them
 * third-person: "Maria's son". Anything not starting with "your " is returned as typed.
 */
export function familyRelation(relation: string | null | undefined, patientName: string): string | null {
  const r = relation?.trim();
  if (!r) return null;
  const m = /^your\s+(.+)$/i.exec(r);
  return m ? `${patientName}'s ${m[1]}` : r;
}

export const DEFAULT_APP_URL = 'https://cercana.pro7ocol.com';

/** https://cercana.pro7ocol.com/join/K7M4QX */
export function inviteUrl(code: string, base: string = DEFAULT_APP_URL): string {
  return `${base.replace(/\/+$/, '')}/join/${normalizeCode(code)}`;
}

/** Circle code from a web path or deep link ("/join/K7M4QX", "https://…/join/K7M4QX?x", "cercana://join/K7M4QX"). */
export function parseJoinUrl(url: string | null | undefined): string | null {
  const m = /(?:^|\/)join\/([A-Za-z0-9-]{6,8})(?:[/?#]|$)/.exec(url ?? '');
  if (!m) return null;
  const code = normalizeCode(m[1]);
  return isValidCode(code) ? code : null;
}

export function spokenPing(fromName: string, message: string): string {
  return `${fromName} says: ${message}`;
}
