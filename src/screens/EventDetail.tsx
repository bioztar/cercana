import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Moment, Person } from '../lib/types';
import { agenda, eventMoments, longDate, type AgendaItem } from '../lib/calendarView';
import { authorOf } from '../lib/feed';
import { setEventIncludesPatient } from '../lib/api';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { colors, fonts, radius, TARGET, typeFamily } from '../theme';

type Props = {
  eventId: string;
  events: EventRow[];
  people: Person[];
  moments: Moment[];
  onBack: () => void;
  onOpenPerson: (id: string) => void;
  /** cercana-voice/cercana-care may wire this to the photo-add flow; the button hides without it. */
  onAddPhotos?: () => void;
  /** Family only (Vitaly, 2026-09-24 15:50): patient's own name, shown on the "<patient> takes
   * part" toggle. Nothing renders without it — Mom's own EventDetail has no such control. */
  patientName?: string;
  onEventsChanged?: () => void;
};

export function EventDetail({
  eventId, events, people, moments, onBack, onOpenPerson, onAddPhotos, patientName, onEventsChanged,
}: Props) {
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const item = useMemo(() => {
    const now = new Date();
    const items = agenda(events, [], new Date(now.getFullYear() - 1, 0, 1), new Date(now.getFullYear() + 1, 11, 31));
    return items.find((it): it is AgendaItem => it.eventId === eventId) ?? null;
  }, [events, eventId]);

  if (!item) {
    return (
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
        <BigButton label="‹ Feed" tone="plain" onPress={onBack} style={s.back} />
        <Text style={s.body}>This event is no longer available.</Text>
      </ScrollView>
    );
  }

  const linked = eventMoments(item, moments).sort((a, b) => b.created_at.localeCompare(a.created_at));
  // One stream, newest first, each photo tagged with its own author (Vitaly's decision 2026-09-24) —
  // several people's photos of the same event interleave by moment, not grouped by person.
  const photos = linked.flatMap((m) => {
    const author = authorOf(m, people)?.name ?? m.author ?? 'Someone';
    return [m.photo_url, ...(m.photo_urls ?? [])].filter((u): u is string => !!u).map((url) => ({ url, author }));
  });
  const addedBy = linked.map((m) => authorOf(m, people)).find((p) => p);
  const commentTotal = linked.length; // stands in for a real comment count until cercana-voice's thread lands

  const toggleIncludesPatient = async () => {
    if (!item.eventId) return;
    setToggling(true);
    setToggleError(null);
    try {
      await setEventIncludesPatient(item.eventId, !item.includesPatient);
      onEventsChanged?.();
    } catch {
      // ICS events aren't client-writable (RLS rejects it) — the calendar's own default still applies.
      setToggleError("This event syncs automatically and can't be changed here.");
    } finally {
      setToggling(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[s.wrap, onAddPhotos && s.wrapWithBar]}>
        <Pressable accessibilityRole="button" onPress={onBack} style={s.back}>
          <Text style={s.backText}>‹ Feed</Text>
        </Pressable>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.sub}>
          {longDate(item.firstDay)}{addedBy ? ` · added by ${addedBy.name}` : ''}
        </Text>

        <View style={s.card}>
          <Text style={s.cardLabel}>Who was there</Text>
          <View style={s.people}>
            {item.personIds.map((id) => {
              const p = people.find((x) => x.id === id);
              if (!p) return null;
              return (
                <Pressable key={id} accessibilityRole="button" onPress={() => onOpenPerson(p.id)} style={s.person}>
                  <Avatar uri={p.photo_url} name={p.name} size={56} group={people.map((x) => x.name)} />
                  <Text style={s.personName}>{p.name}</Text>
                </Pressable>
              );
            })}
            {item.personIds.length === 0 && <Text style={s.body}>Nobody linked yet.</Text>}
          </View>
        </View>

        {patientName && (
          <View style={s.card}>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: !!item.includesPatient }}
              onPress={toggleIncludesPatient} disabled={toggling} style={s.takesPartRow}>
              <Text style={s.cardLabel}>{item.includesPatient ? '✓ ' : ''}{patientName} takes part</Text>
            </Pressable>
            <ErrorText message={toggleError} />
          </View>
        )}

        {photos.length > 0 && (
          <>
            <Text style={s.cardLabel}>Photos · {photos.length}</Text>
            {photos.map((p, i) => (
              <View key={i} style={s.photoRow}>
                <Image accessibilityLabel={`Photo from ${p.author}`} source={{ uri: p.url }} style={s.streamPhoto} resizeMode="cover" />
                <Text style={s.photoAuthor}>{p.author}</Text>
              </View>
            ))}
          </>
        )}

        {commentTotal > 0 && <Text style={s.comments}>💬 {commentTotal} {commentTotal === 1 ? 'comment' : 'comments'}</Text>}
      </ScrollView>
      {onAddPhotos && (
        <View style={s.stickyBar}>
          <BigButton label="📷 Add your photos" tone="ink" onPress={onAddPhotos} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, gap: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  wrapWithBar: { paddingBottom: 120 },
  back: { alignSelf: 'flex-start', minHeight: TARGET, justifyContent: 'center' },
  backText: { fontSize: typeFamily.label, fontWeight: '700', color: colors.terracotta },
  title: { fontSize: 32, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: typeFamily.body, color: colors.inkSoft },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 12, borderWidth: 1, borderColor: colors.line },
  cardLabel: { fontSize: typeFamily.label, fontWeight: '700', color: colors.ink },
  takesPartRow: { minHeight: TARGET },
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  person: { alignItems: 'center', gap: 6, minWidth: 64 },
  personName: { fontSize: typeFamily.small, fontWeight: '700', color: colors.ink },
  body: { fontSize: typeFamily.body, color: colors.inkSoft },
  photoRow: { gap: 6 },
  streamPhoto: { width: '100%', height: 240, borderRadius: radius.lg, backgroundColor: colors.line },
  photoAuthor: { fontSize: typeFamily.small, fontWeight: '700', color: colors.inkSoft },
  comments: { fontSize: typeFamily.label, fontWeight: '700', color: colors.terracotta },
  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
});
