import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { aboutOf, authorOf } from '../lib/feed';
import type { AgendaItem } from '../lib/calendarView';
import { longDate } from '../lib/calendarView';
import { timeAgo } from '../lib/dates';
import type { Moment, Person } from '../lib/types';
import { colors, fonts, radius, TARGET, type } from '../theme';
import { Text } from './Text';
import { Avatar, BigButton } from './ui';
import { VoicePlayer } from './VoicePlayer';

type Props = {
  moment: Moment;
  people: Person[];
  onOpenPerson?: (id: string) => void;
  /** The event this moment belongs to, shown as a tappable chip. */
  event?: AgendaItem | null;
  onOpenEvent?: (item: AgendaItem) => void;
  // Contract for the voice mission: it renders the thread. Nothing is drawn while onOpenThread is absent.
  commentCount?: number;
  lastComment?: { author: string; text: string };
  onOpenThread?: (momentId: string) => void;
};

/** One family moment for the patient: the author's face and name first, then what they shared. */
export function FeedItem({
  moment: m, people, onOpenPerson, event, onOpenEvent, commentCount = 0, lastComment, onOpenThread,
}: Props) {
  const author = authorOf(m, people);
  const about = aboutOf(m, people);
  const name = author?.name ?? m.author ?? 'Someone';
  const extra = (m.photo_urls ?? []).slice(0, 2);
  const head = (
    <View style={s.head}>
      <Avatar uri={author?.photo_url} name={name} size={64} />
      <View style={{ flex: 1 }}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.sub}>
          {[author?.relation, timeAgo(new Date(m.created_at), new Date())].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </View>
  );
  return (
    <View style={s.card}>
      {author && onOpenPerson ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${name}${author.relation ? `, ${author.relation}` : ''}`}
          onPress={() => onOpenPerson(author.id)} style={s.headBtn}>
          {head}
        </Pressable>
      ) : head}
      {m.photo_url ? <Image accessibilityLabel="Photo" source={{ uri: m.photo_url }} style={s.photo} resizeMode="cover" /> : null}
      {extra.length > 0 && (
        <View style={s.row}>
          {extra.map((u) => (
            <Image key={u} accessibilityLabel="Photo" source={{ uri: u }} style={s.photoSmall} resizeMode="cover" />
          ))}
        </View>
      )}
      {m.body ? <Text style={s.body}>{m.body}</Text> : null}
      {about ? <Text style={s.about}>About {about.name}</Text> : null}
      {m.audio_url ? <VoicePlayer url={m.audio_url} /> : null}
      {event && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Event, ${longDate(event.firstDay)}: ${event.title}`}
          onPress={() => onOpenEvent?.(event)}
          disabled={!onOpenEvent}
          style={s.chip}
        >
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={s.chipKicker}>Event · {longDate(event.firstDay).split(', ')[1]}</Text>
            <Text style={s.chipTitle}>{event.title}</Text>
            <View style={s.faces}>
              {event.personIds.slice(0, 4).map((id) => {
                const p = people.find((x) => x.id === id);
                return p ? <Avatar key={id} uri={p.photo_url} name={p.name} size={28} group={people.map((x) => x.name)} /> : null;
              })}
            </View>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      )}
      {onOpenThread && (
        <View style={s.thread}>
          {commentCount > 0 && lastComment ? (
            <View>
              <Text style={s.count}>{commentCount} {commentCount === 1 ? 'comment' : 'comments'}</Text>
              <Text style={s.last}>{lastComment.author}: “{lastComment.text}”</Text>
            </View>
          ) : (
            <Text style={s.last}>No comments yet</Text>
          )}
          <BigButton label="🎤 Comment" tone="outline" onPress={() => onOpenThread(m.id)} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.xl, padding: 14, gap: 12, borderWidth: 1, borderColor: colors.line },
  headBtn: { minHeight: TARGET },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: type.name - 4, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 18, color: colors.inkSoft },
  about: { fontSize: 18, fontWeight: '700', color: colors.inkSoft },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  photo: { width: '100%', height: 240, borderRadius: radius.lg, backgroundColor: colors.line },
  row: { flexDirection: 'row', gap: 8 },
  photoSmall: { flex: 1, height: 130, borderRadius: radius.md, backgroundColor: colors.line },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.peachSoft,
    borderRadius: radius.lg, padding: 14, minHeight: TARGET,
  },
  chipKicker: { fontSize: 16, fontWeight: '700', color: colors.inkSoft },
  chipTitle: { fontSize: 22, fontFamily: fonts.display, color: colors.ink },
  faces: { flexDirection: 'row', gap: 4 },
  chevron: { fontSize: 32, color: colors.terracotta },
  thread: { gap: 10, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12 },
  count: { fontSize: 18, fontWeight: '700', color: colors.terracotta },
  last: { fontSize: 18, color: colors.inkSoft, lineHeight: 26 },
});
