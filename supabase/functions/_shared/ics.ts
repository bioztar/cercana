// ICS → flat event rows, with RRULE expansion. Pure: no Deno globals, no imports, so the edge
// function (npm:ical.js) and `node --test` (ical.js from node_modules) can both use it.
// The ical.js module is injected by the caller.

// deno-lint-ignore no-explicit-any
export type IcalLib = any;

export type IcsEvent = {
  uid: string;
  title: string;
  location: string | null;
  starts_at: string; // ISO. All-day events: UTC midnight of their date.
  ends_at: string; // All-day: exclusive (UTC midnight of the day after the last day).
  all_day: boolean;
};

const MAX_ITERATIONS = 20_000; // guards runaway rules (e.g. FREQ=SECONDLY); ~55 years of daily events

/** webcal:// → https://; only http(s) is allowed. Returns null for anything else. */
export function normalizeFeedUrl(raw: string): string | null {
  const url = raw.trim().replace(/^webcal:\/\//i, 'https://');
  return /^https?:\/\/[^\s/]+/i.test(url) ? url : null;
}

// deno-lint-ignore no-explicit-any
function toInstants(startT: any, endT: any): { starts_at: string; ends_at: string; all_day: boolean } {
  if (startT.isDate) {
    const s = Date.UTC(startT.year, startT.month - 1, startT.day);
    const e = endT ? Date.UTC(endT.year, endT.month - 1, endT.day) : s + 86_400_000;
    return {
      starts_at: new Date(s).toISOString(),
      ends_at: new Date(e > s ? e : s + 86_400_000).toISOString(),
      all_day: true,
    };
  }
  const s = startT.toJSDate();
  const e = endT ? endT.toJSDate() : s;
  return { starts_at: s.toISOString(), ends_at: (e < s ? s : e).toISOString(), all_day: false };
}

/**
 * Expands `text` into events overlapping [from, to). Recurrences are expanded (EXDATE and
 * RECURRENCE-ID overrides honoured); cancelled events are dropped; rows are unique per (uid, starts_at).
 */
export function expandIcs(ICAL: IcalLib, text: string, from: Date, to: Date): IcsEvent[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const tz of root.getAllSubcomponents('vtimezone')) {
    try {
      ICAL.TimezoneService.register(tz);
    } catch {
      /* unknown/odd timezone definition: fall back to ical.js defaults */
    }
  }

  const masters = new Map<string, IcalLib>();
  const overrides: IcalLib[] = [];
  for (const comp of root.getAllSubcomponents('vevent')) {
    if (comp.hasProperty('recurrence-id')) overrides.push(comp);
    else masters.set(String(comp.getFirstPropertyValue('uid')), new ICAL.Event(comp));
  }

  const out = new Map<string, IcsEvent>();
  const push = (uid: string, item: IcalLib, startT: IcalLib, endT: IcalLib) => {
    if (String(item.component.getFirstPropertyValue('status')).toUpperCase() === 'CANCELLED') return;
    const inst = toInstants(startT, endT);
    if (new Date(inst.starts_at) >= to || new Date(inst.ends_at) <= from) return;
    out.set(`${uid}|${inst.starts_at}`, {
      uid,
      title: (item.summary ?? '').toString().trim() || '(no title)',
      location: (item.location ?? '').toString().trim() || null,
      ...inst,
    });
  };

  for (const comp of overrides) {
    const master = masters.get(String(comp.getFirstPropertyValue('uid')));
    if (master) master.relateException(comp);
    else {
      // Orphan override: treat as a plain event.
      const ev = new ICAL.Event(comp);
      push(ev.uid, ev, ev.startDate, ev.endDate);
    }
  }

  for (const [uid, ev] of masters) {
    if (!ev.isRecurring()) {
      push(uid, ev, ev.startDate, ev.endDate);
      continue;
    }
    const it = ev.iterator();
    for (let n = 0; n < MAX_ITERATIONS; n++) {
      const next = it.next();
      if (!next) break;
      const d = ev.getOccurrenceDetails(next);
      if (d.startDate.toJSDate().getTime() > to.getTime() + 86_400_000) break; // a day of slack for floating times
      push(uid, d.item, d.startDate, d.endDate);
    }
  }

  return [...out.values()].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}
