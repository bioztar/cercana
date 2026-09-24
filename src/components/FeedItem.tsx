import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { aboutOf, authorOf } from '../lib/feed';
import { timeAgo } from '../lib/dates';
import type { Moment, Person } from '../lib/types';
import { colors, type, fonts } from '../theme';
import { Avatar } from './ui';
import { VoicePlayer } from './VoicePlayer';

type Props = { moment: Moment; people: Person[]; onOpenPerson?: (id: string) => void };

/** One family moment for the patient: the author's face and name first, then what they shared. */
export function FeedItem({ moment: m, people, onOpenPerson }: Props) {
  const author = authorOf(m, people);
  const about = aboutOf(m, people);
  const name = author?.name ?? m.author ?? 'Someone';
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
      {about ? <Text style={s.about}>About {about.name}</Text> : null}
      {m.body ? <Text style={s.body}>{m.body}</Text> : null}
      {m.photo_url ? <Image accessibilityLabel="Photo" source={{ uri: m.photo_url }} style={s.photo} resizeMode="cover" /> : null}
      {m.audio_url ? <VoicePlayer url={m.audio_url} /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, gap: 10, borderWidth: 2, borderColor: colors.line },
  headBtn: { minHeight: 64 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: type.name - 4, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 18, color: colors.terracotta, fontWeight: '600' },
  about: { fontSize: 18, fontWeight: '700', color: colors.inkSoft },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  photo: { width: '100%', height: 280, borderRadius: 12, backgroundColor: colors.line },
});
