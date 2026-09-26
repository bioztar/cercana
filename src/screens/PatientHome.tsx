import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from '../components/Text';
import { commentSummaries } from '../lib/api';
import { commentText } from '../lib/voice';
import type { BriefSettings, Checkin, CommentSummary, EventRow, ImportantEvent, Moment, Person, Session } from '../lib/types';
import { FeedItem } from '../components/FeedItem';
import { buildBriefing, type BriefingEvent } from '../lib/briefing';
import { agenda, momentEvent } from '../lib/calendarView';
import { birthdayPhrase, formatDate, greeting, upcomingBirthday, WEEKDAYS, MONTHS } from '../lib/dates';
import { getFlag, setFlag } from '../lib/session';
import { say } from '../lib/speech';
import { scheduleBirthdayReminders } from '../lib/notify';
import { Avatar, ErrorText } from '../components/ui';
import { MenuSheet } from '../components/MenuSheet';
import { PatientPeople } from './PatientPeople';
import { PatientCalendar } from './PatientCalendar';
import { ChatsTab } from './ChatsTab';
import { TalkToFamily } from './TalkToFamily';
import { AssistantChat } from './AssistantChat';
import type { PatientTab } from '../components/FamilyTabBar';
import { colors, fonts, MAX_WIDTH, type } from '../theme';

const PAD = 20;
let spokeThisOpen = false; // greeting/briefing is spoken once per app-open

type Props = {
  session: Session;
  /** Andrey's native tab bar (App.tsx) drives which tab is showing; drawn on web/Android, the
   * system UITabBar on iOS. */
  tab: PatientTab;
  people: Person[];
  events: EventRow[];
  moments: Moment[]; // the family feed, newest first
  important: ImportantEvent[];
  checkins: Checkin[];
  briefSettings: BriefSettings;
  loading: boolean;
  error: string | null;
  onOpenPerson: (id: string) => void;
  onOpenEvent?: (eventId: string) => void;
  /** Opens the Thread screen for a moment (comments + Mom's voice reply). Nothing is drawn without it. */
  onOpenThread?: (momentId: string) => void;
  onSettings: () => void;
  onSharePhotos: () => void; // ☰ menu: the fuller multi-photo + event-linking flow
  onAddEvent: () => void; // ☰ menu: event by voice
  /** cercana-care's important-update card, shown at the top of the feed; nothing renders when absent. */
  importantCard?: React.ReactNode;
  /** cercana-meds's "Medicines today" card, shown above importantCard; nothing renders without medicines. */
  medsCard?: React.ReactNode;
  /** cercana-visit's gentle doctor-visit summary, shown above medsCard; nothing renders when absent. */
  visitCard?: React.ReactNode;
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
  session, people, events, moments, important, checkins, briefSettings, loading, error, onOpenPerson, onOpenEvent,
  onOpenThread, onSettings, onSharePhotos, onAddEvent, importantCard, medsCard, visitCard, tab,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatting, setChatting] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, CommentSummary>>({});

  useEffect(() => {
    void commentSummaries(session.circleId).then(setSummaries).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refetch whenever the feed itself reloads
  }, [session.circleId, moments]);

  const now = new Date();
  const hello = `${greeting(now)}, ${session.patientName}`;
  const compactDate = `${WEEKDAYS[now.getDay()].slice(0, 3)} ${now.getDate()} ${MONTHS[now.getMonth()].slice(0, 3)}`;
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

  const menuItems = [
    { label: '🔊 Hear today', onPress: () => say(briefing()) },
    { label: '📷 Share photos', onPress: onSharePhotos },
    { label: '📅 Add an event', onPress: onAddEvent },
    { label: 'Settings (for family)', onPress: onSettings, hold: true },
  ];

  return (
    <View style={{ flex: 1 }}>
      {tab === 'Feed' && (
        <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={s.wrap}>
          <View style={s.header}>
            <Pressable accessibilityRole="button" accessibilityLabel="Menu" onPress={() => setMenuOpen(true)} style={s.menuBtn}>
              <Text style={s.menuIcon}>☰</Text>
            </Pressable>
            <View style={s.helloBox}>
              <Text style={s.hello}>{hello}</Text>
              <Text style={s.helloDate}>{compactDate}</Text>
            </View>
          </View>

          <ErrorText message={error} />

          {next && bannerText && (
            <Pressable accessibilityRole="button" accessibilityLabel={bannerText} onPress={() => onOpenPerson(next.person.id)} style={s.banner}>
              <Avatar uri={next.person.photo_url} name={next.person.name} size={72} />
              <Text style={s.bannerText}>{bannerText}</Text>
            </Pressable>
          )}

          {visitCard}
          {medsCard}
          {importantCard}

          {moments.length === 0 && !error ? (
            <Text style={s.empty}>Your family's news will show up here.</Text>
          ) : (
            <View style={s.feed}>
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
        </ScrollView>
      )}
      {tab === 'People' && <PatientPeople people={people} moments={moments} />}
      {tab === 'Calendar' && (
        <PatientCalendar events={events} people={people} important={important} checkins={checkins}
          onOpenEvent={onOpenEvent ?? (() => {})} />
      )}
      {tab === 'Chats' && <ChatsTab circleId={session.circleId} viewer="patient" people={people} actor={{ kind: 'patient' }} />}

      <Pressable accessibilityRole="button" accessibilityLabel="Send to family" onPress={() => setSending(true)} style={s.fab}>
        <Text style={s.fabIcon}>+</Text>
      </Pressable>

      <MenuSheet visible={menuOpen} onClose={() => setMenuOpen(false)} title="Menu" items={menuItems} />

      <Modal visible={sending} animationType="slide" onRequestClose={() => setSending(false)}>
        <TalkToFamily circleId={session.circleId} patientName={session.patientName}
          onSent={() => setSending(false)} onCancel={() => setSending(false)}
          onOpenAssistant={() => { setSending(false); setChatting(true); }} />
      </Modal>

      <Modal visible={chatting} animationType="slide" onRequestClose={() => setChatting(false)}>
        <AssistantChat circleId={session.circleId} onBack={() => setChatting(false)} />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { padding: PAD, paddingBottom: 48, maxWidth: MAX_WIDTH, width: '100%', alignSelf: 'center', gap: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingRight: 84 }, // clears the floating "+"
  menuBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  menuIcon: { fontSize: 32, color: colors.ink },
  helloBox: { flex: 1, minWidth: 0 },
  hello: { fontSize: 24, lineHeight: 30, fontFamily: fonts.display, color: colors.ink, flexShrink: 1 },
  helloDate: { fontSize: 18, lineHeight: 24, color: colors.inkSoft, marginTop: 2 },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 16, backgroundColor: colors.peach,
    borderRadius: 20, padding: 16, borderWidth: 3, borderColor: colors.terracotta, minHeight: 64,
  },
  bannerText: { flex: 1, flexShrink: 1, fontSize: 24, fontFamily: fonts.display, color: colors.ink, lineHeight: 31 },
  empty: { fontSize: type.body, color: colors.inkSoft, lineHeight: 32 },
  feed: { gap: 16 },
  fab: {
    position: 'absolute', top: 16, right: 16, width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.terracotta, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  fabIcon: { fontSize: 40, color: colors.white, fontWeight: '300', marginTop: -2 },
});
