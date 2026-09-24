import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalendarPublic, Person } from '../lib/types';
import { addCalendar, deleteCalendar, listCalendars, syncCalendars } from '../lib/api';
import { timeAgo } from '../lib/dates';
import { BigButton, ErrorText, Field } from '../components/ui';
import { confirmDelete } from '../components/confirm';
import { colors } from '../theme';

type Props = { circleId: string; people: Person[]; onSynced: () => void };

function syncedAgo(iso: string, now = new Date()): string {
  const mins = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return timeAgo(new Date(iso), now);
}

export function CalendarsTab({ circleId, people, onSynced }: Props) {
  const [calendars, setCalendars] = useState<CalendarPublic[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setCalendars(await listCalendars(circleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [circleId]);

  useEffect(() => { void load(); }, [load]);

  const guard = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const refresh = () => guard(async () => {
    await syncCalendars({ circle_id: circleId });
    await load();
    onSynced();
  });

  const remove = (c: CalendarPublic) => guard(async () => {
    if (!(await confirmDelete(`Remove calendar "${c.label}"?`))) return;
    await deleteCalendar(c.id);
    await load();
    onSynced();
  });

  if (adding) {
    return (
      <AddCalendar
        circleId={circleId}
        people={people}
        onClose={() => setAdding(false)}
        onAdded={() => { setAdding(false); void load(); onSynced(); }}
      />
    );
  }

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? '?';

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.help}>
        Paste a calendar's public ICS address (Google: "Secret address in iCal format", iCloud: public calendar
        link, Outlook: published calendar). Its events then appear on the linked people's cards.
      </Text>
      <BigButton label="Add a calendar" onPress={() => setAdding(true)} />
      {calendars.length > 0 && <BigButton label="Refresh calendars" tone="plain" onPress={refresh} busy={busy} />}
      <ErrorText message={error} />
      {calendars.map((c) => (
        <View key={c.id} style={s.row}>
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{c.label}</Text>
            <Text style={s.sub}>
              {c.url_hint ?? 'calendar'}{' '}
              {c.last_error ? `✗ ${c.last_error}` : c.last_synced_at ? `✓ synced ${syncedAgo(c.last_synced_at)}` : '· not synced yet'}
            </Text>
            <Text style={s.sub}>
              {c.person_ids.length ? `For: ${c.person_ids.map(nameOf).join(', ')}` : 'Not linked to anyone yet'}
            </Text>
          </View>
          <Pressable onPress={() => remove(c)} accessibilityRole="button" style={s.del}>
            <Text style={s.delText}>Remove</Text>
          </Pressable>
        </View>
      ))}
      {calendars.length === 0 && <Text style={s.sub}>No calendars yet.</Text>}
    </View>
  );
}

function AddCalendar(props: { circleId: string; people: Person[]; onClose: () => void; onAdded: () => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setChosen((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const save = async () => {
    if (!label.trim()) return setError('Give the calendar a name, e.g. "Anna\'s calendar".');
    if (!/^(https?|webcal):\/\//i.test(url.trim())) return setError('The address must start with https:// or webcal://');
    if (chosen.length === 0) return setError('Tick at least one person this calendar belongs to.');
    setBusy(true);
    setError(null);
    try {
      const syncError = await addCalendar(props.circleId, label.trim(), url, chosen);
      if (syncError) setError(`Saved, but the first sync failed: ${syncError}. Remove it and add it again with a corrected address.`);
      else props.onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View>
      <Field label={'Name (e.g. "Anna\'s calendar")'} value={label} onChangeText={setLabel} />
      <Field label="ICS address (https:// or webcal://)" value={url} onChangeText={setUrl}
        autoCapitalize="none" autoCorrect={false} secureTextEntry keyboardType="url" />
      <Text style={s.label}>Whose events are these?</Text>
      <View style={s.chips}>
        {props.people.map((p) => (
          <Pressable key={p.id} onPress={() => toggle(p.id)} accessibilityRole="checkbox"
            accessibilityState={{ checked: chosen.includes(p.id) }}
            style={[s.chip, chosen.includes(p.id) && s.chipOn]}>
            <Text style={[s.chipText, chosen.includes(p.id) && { color: colors.white }]}>
              {chosen.includes(p.id) ? '✓ ' : ''}{p.name}
            </Text>
          </Pressable>
        ))}
      </View>
      {props.people.length === 0 && <Text style={s.sub}>Add people first, then link a calendar to them.</Text>}
      <ErrorText message={error} />
      <View style={{ gap: 12 }}>
        <BigButton label="Save and sync" onPress={save} busy={busy} />
        <BigButton label="Cancel" tone="plain" onPress={props.onClose} disabled={busy} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  help: { fontSize: 16, color: colors.inkSoft, lineHeight: 22 },
  label: { fontSize: 18, fontWeight: '600', color: colors.ink, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line,
  },
  name: { fontSize: 20, fontWeight: '700', color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft, marginTop: 2 },
  del: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  delText: { fontSize: 18, fontWeight: '700', color: colors.danger },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 24, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.card },
  chipOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  chipText: { fontSize: 18, fontWeight: '600', color: colors.ink },
});
