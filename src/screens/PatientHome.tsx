import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Text } from '../components/Text';
import { commentSummaries } from '../lib/api';
import { commentText } from '../lib/voice';
import type { CommentSummary, EventRow, Moment, Person, Session } from '../lib/types';
import { FeedItem } from '../components/FeedItem';
import { buildBriefing, type BriefingEvent } from '../lib/briefing';
import { agenda, momentEvent } from '../lib/calendarView';
import { birthdayPhrase, formatDate, greeting, upcomingBirthday } from '../lib/dates';
import { getFlag, setFlag } from '../lib/session';
import { say } from '../lib/speech';
import { scheduleBirthdayReminders } from '../lib/notify';
import { Avatar, BigButton, ErrorText } from '../components/ui';
import { HoldButton } from '../components/HoldButton';
import { colors, fonts, MAX_WIDTH, type } from '../theme';

const PAD = 20;
let spokeThisOpen = false; // greeting/briefing is spoken once per app-open

type Props = {
  session: Session;
  people: Person[];
  events: EventRow[];
  moments: Moment[]; // the family feed, newest first
  loading: boolean;
  error: string | null;
  onOpenPerson: (id: string) => void;
  onOpenEvent?: (eventId: string) => void;
  /** Opens the Thread screen for a moment (comments + Mom's voice reply). Nothing is drawn without it. */
  onOpenThread?: (momentId: string) => void;
  onSettings: () => void;
  /** cercana-voice renders the "Tell the family" share flow; the sticky button is hidden without it. */
  onTellFamily?: () => void;
  /** cercana-care's important-update card, shown above the feed; nothing renders when absent. */
  importantCard?: React.ReactNode;
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

export function PatientHome({
  session, people, events, moments, loading, error, onOpenPerson, onOpenEvent, onOpenThread, onSettings, onTellFamily,
  importantCard,
}: Props) {
  const { width } = useWindowDimensions();
  const narrow = width < 700;
  const [summaries, setSummaries] = useState<Record<string, CommentSummary>>({});

  useEffect(() => {
    void commentSummaries(session.circleId).then(setSummaries).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch whenever the feed itself reloads
  }, [session.circleId, moments]);

  const now = new Date();
  const hello = `${greeting(now)}, ${session.patientName}`;
  const dateLine = formatDate(now);

  const next = useMemo(() => upcomingBirthday(people, new Date(), 7), [people]);
  const bannerText = next
    ? birthdayPhrase(next.person.name, next.days, new Date(), next.birthday, next.person.relation)
    : null;

  // A wide window (six months back to six months ahead) so any moment in the feed can find its event.
  const agendaItems = useMemo(
    () => agenda(events, people, new Date(now.getFullYear(), now.getMonth() - 6, 1), new Date(now.getFullYear(), now.getMonth() + 6, 1)),
    [events, people],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `now` recomputed fresh each render is not a real dependency
  );

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

  /** Who wrote a comment, the way FeedItem's lastComment wants it. */
  const commentAuthor = (c: CommentSummary['last']) =>
    (c.author_person_id ? people.find((p) => p.id === c.author_person_id)?.name : null) ?? c.author_name ?? 'Someone';

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={[s.wrap, onTellFamily && s.wrapWithBar]}>
        <View style={[s.header, narrow && s.headerNarrow]}>
          <View style={{ flex: 1 }}>
            <Text style={[s.hello, narrow && s.helloNarrow]}>{hello}</Text>
            <Text style={[s.date, narrow && s.dateNarrow]}>{dateLine}</Text>
          </View>
          <BigButton label="🔊 Hear today" tone="terracotta" onPress={() => say(briefing())} />
        </View>

        {next && bannerText && (
          <Pressable accessibilityRole="button" accessibilityLabel={bannerText} onPress={() => onOpenPerson(next.person.id)} style={s.banner}>
            <Avatar uri={next.person.photo_url} name={next.person.name} size={narrow ? 72 : 96} />
            <Text style={s.bannerText}>{bannerText}</Text>
          </Pressable>
        )}

        <ErrorText message={error} />

        {people.length === 0 && !error && (
          <Text style={s.empty}>Your family will add the people you love here.</Text>
        )}

        {people.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.strip}>
            {people.map((p) => (
              <Pressable
                key={p.id}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}${p.relation ? `, ${p.relation}` : ''}`}
                onPress={() => onOpenPerson(p.id)}
                style={s.face}
              >
                <Avatar uri={p.photo_url} name={p.name} size={96} />
                <Text style={s.faceName} numberOfLines={1}>{p.name}</Text>
                {p.relation ? <Text style={s.faceRelation} numberOfLines={1}>{p.relation}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        )}

        {importantCard}

        {moments.length > 0 && (
          <View style={s.feed}>
            <Text style={s.feedTitle}>Feed</Text>
            {moments.map((m) => {
              const summary = summaries[m.id];
              return (
                <FeedItem
                  key={m.id}
                  moment={m}
                  people={people}
                  onOpenPerson={onOpenPerson}
                  event={momentEvent(m, agendaItems)}
                  onOpenEvent={onOpenEvent ? (it) => it.eventId && onOpenEvent(it.eventId) : undefined}
                  commentCount={summary?.count ?? 0}
                  lastComment={summary ? { author: commentAuthor(summary.last), text: commentText(summary.last) } : undefined}
                  onOpenThread={onOpenThread}
                />
              );
            })}
          </View>
        )}

        <HoldButton label="Settings (for family)" onComplete={onSettings} />
      </ScrollView>

      {onTellFamily && (
        <View style={s.stickyBar}>
          <BigButton label="🎤 Tell the family" tone="ink" onPress={onTellFamily} />
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: PAD, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: 24 },
  wrapWithBar: { paddingBottom: 120 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerNarrow: { flexDirection: 'column', alignItems: 'stretch' },
  hello: { fontSize: type.huge, fontFamily: fonts.display, color: colors.ink, lineHeight: 56 },
  date: { fontSize: type.title, color: colors.inkSoft, fontFamily: fonts.display, marginTop: 4 },
  // On a phone the full-size greeting pushed the faces below the first screen.
  helloNarrow: { fontSize: 40, lineHeight: 46 },
  dateNarrow: { fontSize: 28 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.peach,
    borderRadius: 20, padding: 16, borderWidth: 3, borderColor: colors.terracotta, minHeight: 64,
  },
  // 24 px keeps long words ("granddaughter") inside the banner next to the 96 px face on a phone.
  bannerText: { flex: 1, flexShrink: 1, fontSize: 24, fontFamily: fonts.display, color: colors.ink, lineHeight: 31 },
  empty: { fontSize: type.body, color: colors.inkSoft, lineHeight: 32 },
  strip: { gap: 20, paddingRight: 8 },
  face: { alignItems: 'center', width: 120 },
  faceName: { fontSize: type.label, fontFamily: fonts.display, color: colors.ink, marginTop: 10, textAlign: 'center' },
  faceRelation: { fontSize: 16, color: colors.inkSoft, textAlign: 'center', marginTop: 2 },
  feed: { gap: 16 },
  feedTitle: { fontSize: type.title, fontFamily: fonts.display, color: colors.ink },
  stickyBar: {
    position: 'absolute', left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: colors.line,
  },
});
