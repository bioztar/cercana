import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Calendar from 'expo-calendar';
import type { Person } from '../lib/types';
import { addDeviceCalendar, deleteCalendar, listDeviceCalendars, upsertDeviceEvents } from '../lib/api';
import { toEventRows } from '../lib/deviceCalendar';
import { BigButton, ErrorText } from '../components/ui';
import { CalendarPeople } from './CalendarPeople';
import { colors } from '../theme';

type Props = { circleId: string; people: Person[]; onClose: () => void; onConnected: () => void };

const SYNC_DAYS = 60;

/** Family, iOS only: connect an iPhone calendar so its events show up for the whole family.
 * Matches design/mockups/CalConnect.png + CalPeople.png (step 2, see CalendarPeople.tsx). */
export function CalendarConnect({ circleId, people, onClose, onConnected }: Props) {
  const [calendars, setCalendars] = useState<Calendar.ExpoCalendar[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 'intro' (read-only explainer, before the OS prompt) → 'pick' → 'people'. Read-only, no write-back (Vitaly, 2026-09-24 14:50).
  const [step, setStep] = useState<'intro' | 'pick' | 'people'>('intro');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requestAccess = async () => {
    setStep('pick');
    setLoading(true);
    try {
      const perm = await Calendar.requestCalendarPermissions();
      if (perm.status !== 'granted') { setError('Calendar access was not granted.'); return; }
      const cals = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
      setCalendars(cals);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  // Declared before the early returns below: the 'people' step returns before any later line runs,
  // so a handler defined further down was never initialised and tapping Connect crashed the app.
  const connect = async (cal: Calendar.ExpoCalendar, personIds: string[]) => {
    setBusy(true);
    setError(null);
    try {
      const calendarId = await addDeviceCalendar(circleId, cal.title, cal.id, personIds);
      try {
        await syncDeviceCalendar(cal, calendarId, circleId);
      } catch (e) {
        // Don't leave an empty calendar behind for the family: every retry used to add another one.
        await deleteCalendar(calendarId).catch(() => {});
        throw e;
      }
      onConnected();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS !== 'ios') {
    return (
      <View style={s.wrap}>
        <Text style={s.title}>Connect a calendar</Text>
        <Text style={s.sub}>Connecting an iPhone calendar is available in the iPhone app.</Text>
        <BigButton label="Back" tone="plain" onPress={onClose} />
      </View>
    );
  }

  if (step === 'intro') {
    return (
      <View style={s.wrap}>
        <Pressable onPress={onClose} accessibilityRole="button" style={s.back}>
          <Text style={s.backText}>‹ Settings</Text>
        </Pressable>
        <Text style={s.title}>Connect a calendar</Text>
        <Text style={s.sub}>
          Cercana reads the calendar you choose so your family sees what's coming up. We never change it — nothing is
          ever added, edited or deleted on your iPhone calendar.
        </Text>
        <BigButton label="Continue" onPress={requestAccess} />
      </View>
    );
  }

  const selected = calendars.find((c) => c.id === selectedId) ?? null;

  if (step === 'people' && selected) {
    return (
      <View style={s.wrap}>
        <CalendarPeople
          calendarLabel={selected.title}
          people={people}
          busy={busy}
          onBack={() => setStep('pick')}
          onConnect={(personIds) => void connect(selected, personIds)}
        />
        <ErrorText message={error} />
      </View>
    );
  }

  return (
    <View style={s.wrap}>
      <Pressable onPress={onClose} accessibilityRole="button" style={s.back}>
        <Text style={s.backText}>‹ Settings</Text>
      </Pressable>
      <Text style={s.title}>Connect a calendar</Text>
      <Text style={s.sub}>Events from the Apple calendar you pick will show up for the whole family</Text>
      <ErrorText message={error} />
      {loading ? (
        <Text style={s.sub}>Loading your calendars…</Text>
      ) : (
        <View style={s.list}>
          <Text style={s.listTitle}>Calendars on this iPhone</Text>
          {calendars.map((c) => (
            <Pressable key={c.id} onPress={() => setSelectedId(c.id)} accessibilityRole="radio"
              accessibilityState={{ checked: c.id === selectedId }} style={s.row}>
              <View style={[s.dot, { backgroundColor: c.color ?? colors.terracotta }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.rowTitle}>{c.title}</Text>
                <Text style={s.rowSub}>{c.source?.name ?? 'iPhone'}</Text>
              </View>
              <View style={[s.check, c.id === selectedId && s.checkOn]}>
                {c.id === selectedId ? <Text style={s.checkMark}>✓</Text> : null}
              </View>
            </Pressable>
          ))}
          {calendars.length === 0 ? <Text style={s.sub}>No calendars found on this iPhone.</Text> : null}
        </View>
      )}
      <BigButton label="Next" onPress={() => setStep('people')} disabled={!selected} />
    </View>
  );
}

/** Pushes the next `SYNC_DAYS` days of `cal`'s events into `events` (upsert by uid + start). */
export async function syncDeviceCalendar(cal: Calendar.ExpoCalendar, calendarId: string, circleId: string): Promise<void> {
  const from = new Date();
  const to = new Date(from.getTime() + SYNC_DAYS * 86_400_000);
  const events = await cal.listEvents(from, to);
  await upsertDeviceEvents(circleId, calendarId, toEventRows(events));
}

/** Re-syncs every connected device calendar. Call on app open and pull-to-refresh (family, iOS). */
export async function syncAllDeviceCalendars(circleId: string): Promise<void> {
  if (Platform.OS !== 'ios') return;
  for (const link of await listDeviceCalendars(circleId)) {
    try {
      const cal = await Calendar.ExpoCalendar.get(link.device_calendar_id);
      await syncDeviceCalendar(cal, link.id, circleId);
    } catch (e) {
      console.warn('device calendar sync failed', link.id, e); // e.g. the calendar was removed on the phone
    }
  }
}

const s = StyleSheet.create({
  wrap: { maxWidth: 480, width: '100%', alignSelf: 'center' },
  back: { minHeight: 44, justifyContent: 'center', marginBottom: 4 },
  backText: { fontSize: 18, color: colors.terracotta, fontWeight: '700' },
  title: { fontSize: 26, fontWeight: '800', color: colors.ink, marginBottom: 6 },
  sub: { fontSize: 15, color: colors.inkSoft, marginBottom: 16, lineHeight: 21 },
  list: { gap: 4, marginBottom: 20 },
  listTitle: { fontSize: 14, fontWeight: '700', color: colors.inkSoft, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 6,
  },
  dot: { width: 14, height: 14, borderRadius: 7 },
  rowTitle: { fontSize: 17, fontWeight: '700', color: colors.ink },
  rowSub: { fontSize: 13, color: colors.inkSoft },
  check: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  checkMark: { color: colors.white, fontWeight: '800', fontSize: 13 },
});
