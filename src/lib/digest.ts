// Pure helpers for the digest trend bars. No React / RN imports so `node --test` can run it.
import type { Digest, DigestMetrics } from './types.ts';

export const TREND_DAYS = 14;

export type TrendKey = 'questions' | 'repeatRate' | 'night' | 'dosesMissed';

export const TRENDS: { key: TrendKey; label: string; percent?: boolean }[] = [
  { key: 'questions', label: 'Questions asked' },
  { key: 'repeatRate', label: 'Repeated questions', percent: true },
  { key: 'night', label: 'Active at night' },
  { key: 'dosesMissed', label: 'Medicines missed' },
];

export type TrendBar = { day: string; value: number | null; ratio: number }; // ratio 0..1 of the series max

export const formatTrend = (v: number, percent?: boolean): string => (percent ? `${Math.round(v * 100)}%` : String(v));

const addDay = (day: string, n: number): string => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};

/** The last `days` days ending at the newest digest, oldest first; days without a digest are null. */
export function trendBars(digests: Digest[], key: keyof DigestMetrics, days = TREND_DAYS): TrendBar[] {
  if (digests.length === 0) return [];
  const byDay = new Map(digests.map((d) => [d.day, d.metrics[key]]));
  const last = digests.reduce((a, d) => (d.day > a ? d.day : a), digests[0].day);
  const series = Array.from({ length: days }, (_, i) => {
    const day = addDay(last, i - (days - 1));
    return { day, value: byDay.get(day) ?? null };
  });
  const max = Math.max(0, ...series.map((s) => s.value ?? 0));
  return series.map((s) => ({ ...s, ratio: s.value && max ? s.value / max : 0 }));
}

/** The newest digest, or null. */
export const latestDigest = (digests: Digest[]): Digest | null =>
  digests.reduce<Digest | null>((a, d) => (!a || d.day > a.day ? d : a), null);
