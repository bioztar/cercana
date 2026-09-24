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

export function spokenPing(fromName: string, message: string): string {
  return `${fromName} says: ${message}`;
}
