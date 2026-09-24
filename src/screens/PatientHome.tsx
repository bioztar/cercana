import React, { useEffect, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text';
import type { EventRow, Moment, Person, Session } from '../lib/types';
import { FeedItem } from '../components/FeedItem';
import { buildBriefing, type BriefingEvent } from '../lib/briefing';
import { birthdayPhrase, formatDate, greeting, upcomingBirthday } from '../lib/dates';
import { getFlag, setFlag } from '../lib/session';
import { say } from '../lib/speech';
import { scheduleBirthdayReminders } from '../lib/notify';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { HoldButton } from '../components/HoldButton';
import { colors, MAX_WIDTH, type, fonts } from '../theme';

const PAD = 20;
const GAP = 16;
let spokeThisOpen = false; // greeting/briefing is spoken once per app-open

type Props = {
  session: Session;
  people: Person[];
  events: EventRow[];
  moments: Moment[]; // the family feed, newest first
  loading: boolean;
  error: string | null;
  onOpenPerson: (id: string) => void;
  onSettings: () => void;
};

/** One row per real-world event: the same event on several people's calendars lists all owners. */
function briefingEvents(events: EventRow[], people: Person[]): BriefingEvent[] {
  const merged = new Map<string, BriefingEvent>();
  for (const e of events) {
    const owners = e.person_ids.map((id) => people.find((p) => p.id === id)?.name).filter((n): n is string => !!n);
    const key = `${e.uid}|${e.starts_at}`;
    const prev = merged.get(key);
    merged.set(key, {
      title: e.title ?? '(no title)', starts_at: e.starts_at, ends_at: e.ends_at, all_day: e.all_day,
      owners: [...new Set([...(prev?.owners ?? []), ...owners])],
    });
  }
  return [...merged.values()];
}

export function PatientHome({ session, people, events, moments, loading, error, onOpenPerson, onSettings }: Props) {
  const { width } = useWindowDimensions();
  const cols = width < 700 ? 2 : width < 1000 ? 3 : 4;
  // Pixel widths (not %): percent columns plus `gap` overflow the row and wrap early.
  const inner = Math.min(width, MAX_WIDTH) - 2 * PAD;
  const cardWidth = Math.floor((inner - GAP * (cols - 1)) / cols);
  const now = new Date();
  const hello = `${greeting(now)}, ${session.patientName}`;
  const dateLine = formatDate(now);

  const next = useMemo(() => upcomingBirthday(people, new Date(), 7), [people]);
  const bannerText = next
    ? birthdayPhrase(next.person.name, next.days, new Date(), next.birthday, next.person.relation)
    : null;
  const bannerFull = bannerText;

  const briefing = () =>
    buildBriefing({
      patientName: session.patientName,
      now: new Date(),
      events: briefingEvents(events, people),
      birthdayPhrase: bannerText,
    });

  // First open of the day: full briefing (greeting, today's events, next birthday). Later opens: greeting only.
  // Waits for people + events so the briefing never runs on half the data.
  useEffect(() => {
    if (loading || spokeThisOpen) return;
    spokeThisOpen = true;
    const key = 'briefing-day';
    const today = new Date().toDateString();
    void getFlag(key).then((seen) => {
      if (seen === today) return say(`${hello}. Today is ${dateLine}.`);
      void setFlag(key, today);
      say(briefing());
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- speak once per open, with the data present at that time
  }, [loading]);

  useEffect(() => {
    void scheduleBirthdayReminders(people);
  }, [people]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
      <View style={[s.header, cols === 2 && s.headerNarrow]}>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{hello}</Text>
          <Text style={s.date}>{dateLine}</Text>
        </View>
        <BigButton label="🔊 Hear today" tone="terracotta" onPress={() => say(briefing())} />
      </View>

      {next && bannerFull && (
        <Pressable accessibilityRole="button" accessibilityLabel={bannerFull} onPress={() => onOpenPerson(next.person.id)} style={s.banner}>
          <Avatar uri={next.person.photo_url} name={next.person.name} size={96} />
          <Text style={s.bannerText}>{bannerFull}</Text>
        </Pressable>
      )}

      <ErrorText message={error} />

      {people.length === 0 && !error && (
        <Text style={s.empty}>Your family will add the people you love here.</Text>
      )}

      <View style={s.grid}>
        {people.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`${p.name}${p.relation ? `, ${p.relation}` : ''}`}
            onPress={() => onOpenPerson(p.id)}
            style={[s.card, { width: cardWidth }]}
          >
            <Avatar uri={p.photo_url} name={p.name} size={Math.min(220, cardWidth - 28)} />
            <Text style={s.name} numberOfLines={2}>{p.name}</Text>
            {p.relation ? <Text style={s.relation} numberOfLines={2}>{p.relation}</Text> : null}
          </Pressable>
        ))}
      </View>

      {moments.length > 0 && (
        <View style={s.feed}>
          <Text style={s.feedTitle}>From your family</Text>
          {moments.map((m) => (
            <FeedItem key={m.id} moment={m} people={people} onOpenPerson={onOpenPerson} />
          ))}
        </View>
      )}

      <HoldButton label="Settings (for family)" onComplete={onSettings} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  wrap: { padding: PAD, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 },
  headerNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  hello: { fontSize: type.huge, fontFamily: fonts.display, color: colors.ink, lineHeight: 56 },
  date: { fontSize: type.title, color: colors.inkSoft, fontFamily: fonts.display, marginTop: 4 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.warm,
    borderRadius: 20, padding: 16, marginBottom: 24, borderWidth: 3, borderColor: colors.terracotta, minHeight: 64,
  },
  bannerText: { flex: 1, flexShrink: 1, fontSize: 28, fontFamily: fonts.display, color: colors.ink, lineHeight: 36 },
  empty: { fontSize: type.body, color: colors.inkSoft, marginVertical: 32, lineHeight: 32 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  card: {
    backgroundColor: colors.card, borderRadius: 20, padding: 12, alignItems: 'center',
    borderWidth: 2, borderColor: colors.line,
  },
  name: { fontSize: type.name, fontFamily: fonts.display, color: colors.ink, marginTop: 10, textAlign: 'center' },
  relation: { fontSize: type.label, color: colors.inkSoft, textAlign: 'center', marginTop: 2 },
  feed: { marginTop: 32, gap: 14 },
  feedTitle: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
});
