import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Moment, Person } from '../lib/types';
import { comingUp } from '../lib/briefing';
import { listMoments } from '../lib/api';
import { timeAgo } from '../lib/dates';
import { say } from '../lib/speech';
import { telUrl, whatsappUrl } from '../lib/util';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { FeedItem } from '../components/FeedItem';
import { authorOf } from '../lib/feed';
import { colors, type, fonts } from '../theme';

type Props = {
  person: Person;
  people: Person[]; // to show each moment's author
  circleId: string;
  refreshKey: number;
  events: EventRow[];
  onOpenPerson: (id: string) => void;
  onBack: () => void;
};

export function PersonScreen({ person, people, circleId, refreshKey, events, onOpenPerson, onBack }: Props) {
  const upcoming = comingUp(
    events.filter((e) => e.person_ids.includes(person.id)).map((e) => ({ ...e, title: e.title ?? '(no title)' })),
    new Date(),
    5,
    person.name,
  );
  const [moments, setMoments] = useState<Moment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const wa = whatsappUrl(person.phone);
  const tel = telUrl(person.phone);

  useEffect(() => {
    listMoments(circleId, person.id, 20)
      .then((m) => { setMoments(m); setError(null); })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [circleId, person.id, refreshKey]);

  const open = (url: string) => Linking.openURL(url).catch((e) => setError(String(e)));

  const tell = () => {
    const now = new Date();
    const head = `${person.name}${person.relation ? ` is ${person.relation}` : ''}.`;
    const recent = moments.slice(0, 3).filter((m) => m.body);
    const lines = recent.map(
      (m) => `${timeAgo(new Date(m.created_at), now)}, ${authorOf(m, people)?.name ?? m.author ?? 'someone'} said: ${m.body}`,
    );
    say(lines.length ? `${head} Here is what happened lately. ${lines.join('. ')}.` : `${head} There is nothing new yet.`);
  };

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <BigButton label="Back" tone="plain" onPress={onBack} style={s.back} />
      <View style={s.hero}>
        <Avatar uri={person.photo_url} name={person.name} size={280} />
        <Text style={s.name}>{person.name}</Text>
        {person.relation ? <Text style={s.relation}>{person.relation}</Text> : null}
      </View>

      <View style={s.actions}>
        {wa ? <BigButton label="Call on WhatsApp" onPress={() => open(wa)} /> : null}
        {tel ? <BigButton label="Phone call" tone="plain" onPress={() => open(tel)} /> : null}
        <BigButton label={`Tell me about ${person.name}`} tone="terracotta" onPress={tell} />
      </View>
      {wa ? <Text style={s.hint}>WhatsApp opens a chat, where you can also call.</Text> : null}

      <ErrorText message={error} />
      {upcoming.length > 0 && (
        <>
          <Text style={s.section}>Coming up</Text>
          {upcoming.map((c) => (
            <View key={`${c.event.id}`} style={[s.moment, c.ongoing && s.ongoing]}>
              <Text style={s.upcoming}>{c.phrase}</Text>
              {c.event.location ? <Text style={s.when}>{c.event.location}</Text> : null}
            </View>
          ))}
        </>
      )}
      <Text style={s.section}>Lately</Text>
      {moments.length === 0 && <Text style={s.body}>Nothing new yet.</Text>}
      {moments.map((m) => (
        <FeedItem key={m.id} moment={m} people={people} onOpenPerson={onOpenPerson} />
      ))}
      <BigButton label="Back" tone="plain" onPress={onBack} style={{ marginTop: 24 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: 20, paddingBottom: 48, maxWidth: 760, width: '100%', alignSelf: 'center', gap: 16 },
  back: { alignSelf: 'flex-start', minWidth: 160 },
  hero: { alignItems: 'center', gap: 8 },
  name: { fontSize: 48, fontFamily: fonts.display, color: colors.ink, textAlign: 'center' },
  relation: { fontSize: type.title - 6, color: colors.inkSoft, textAlign: 'center' },
  actions: { gap: 12 },
  hint: { fontSize: 18, color: colors.inkSoft, textAlign: 'center' },
  section: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink, marginTop: 16 },
  body: { fontSize: type.body, color: colors.ink, lineHeight: 32 },
  moment: { backgroundColor: colors.card, borderRadius: 16, padding: 16, gap: 10, borderWidth: 2, borderColor: colors.line },
  ongoing: { backgroundColor: colors.warm, borderColor: colors.terracotta },
  upcoming: { fontSize: 24, fontWeight: '700', color: colors.ink, lineHeight: 32 },
  when: { fontSize: 20, fontWeight: '700', color: colors.terracotta },
  photo: { width: '100%', height: 300, borderRadius: 12, backgroundColor: colors.line },
});
