import React, { useMemo } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Moment, Person } from '../lib/types';
import { agenda, eventMoments, longDate, type AgendaItem } from '../lib/calendarView';
import { authorOf } from '../lib/feed';
import { Avatar, BigButton } from '../components/ui';
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
};

export function EventDetail({ eventId, events, people, moments, onBack, onOpenPerson, onAddPhotos }: Props) {
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
  const photos = linked.flatMap((m) => [m.photo_url, ...(m.photo_urls ?? [])]).filter((u): u is string => !!u);
  const addedBy = linked.map((m) => authorOf(m, people)).find((p) => p);
  const commentTotal = linked.length; // stands in for a real comment count until cercana-voice's thread lands

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
                  <Avatar uri={p.photo_url} name={p.name} size={56} />
                  <Text style={s.personName}>{p.name}</Text>
                </Pressable>
              );
            })}
            {item.personIds.length === 0 && <Text style={s.body}>Nobody linked yet.</Text>}
          </View>
        </View>

        {photos.length > 0 && (
          <>
            <Text style={s.cardLabel}>
              Photos · {photos.length}{addedBy ? ` · from ${addedBy.name}` : ''}
            </Text>
            <Image accessibilityLabel="Photo" source={{ uri: photos[0] }} style={s.mainPhoto} resizeMode="cover" />
            {photos.length > 1 && (
              <View style={s.row}>
                {photos.slice(1, 3).map((u, i) => (
                  <Image key={i} accessibilityLabel="Photo" source={{ uri: u }} style={s.smallPhoto} resizeMode="cover" />
                ))}
              </View>
            )}
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
  people: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  person: { alignItems: 'center', gap: 6, minWidth: 64 },
  personName: { fontSize: typeFamily.small, fontWeight: '700', color: colors.ink },
  body: { fontSize: typeFamily.body, color: colors.inkSoft },
  mainPhoto: { width: '100%', height: 240, borderRadius: radius.lg, backgroundColor: colors.line },
  row: { flexDirection: 'row', gap: 8 },
  smallPhoto: { flex: 1, height: 130, borderRadius: radius.md, backgroundColor: colors.line },
  comments: { fontSize: typeFamily.label, fontWeight: '700', color: colors.terracotta },
  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
});
