import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { FontsReady } from './src/components/Text';
import * as Notifications from 'expo-notifications';
import { setAudioModeAsync } from 'expo-audio';
import { demo, missingSettings } from './src/lib/config';
import { demoBoot } from './src/lib/demo';
import { getBriefSettings, listCheckins, listImportant, unclaimPerson } from './src/lib/api';
import { DemoRibbon } from './src/components/DemoRibbon';
import { clearSession, getFlag, loadSession, saveSession, setFlag } from './src/lib/session';
import { useCircle } from './src/lib/useCircle';
import {
  checkinEventFromNotificationData, initNotifications, isBriefNotificationData, pingFromNotificationData,
  registerForPush, requestWebNotificationPermission, scheduleImportantReminders, scheduleMorningBrief,
  showWebNotification,
} from './src/lib/notify';
import { cardText, dueCheckin, nextImportant, todaysImportantSentences } from './src/lib/important';
import { ImportantCard } from './src/components/ImportantCard';
import { briefNotificationBody, buildBriefing, countNewPhotos, mergeBriefingEvents, newPhotosPhrase, todaySentences } from './src/lib/briefing';
import { birthdayPhrase, upcomingBirthday } from './src/lib/dates';
import { say } from './src/lib/speech';
import { actorFor, can } from './src/lib/permissions';
import { parseJoinUrl } from './src/lib/util';
import type { BriefSettings, Checkin, ImportantEvent, Ping, Session } from './src/lib/types';
import { MissingConfig } from './src/screens/MissingConfig';
import { Welcome } from './src/screens/Welcome';
import { Join } from './src/screens/Join';
import { PatientHome } from './src/screens/PatientHome';
import { PersonScreen } from './src/screens/PersonScreen';
import { EventDetail } from './src/screens/EventDetail';
import { PingOverlay } from './src/screens/PingOverlay';
import { MomCheck } from './src/screens/MomCheck';
import { ImportantCreate } from './src/screens/ImportantCreate';
import { ImportantStatus } from './src/screens/ImportantStatus';
import { FamilyHome } from './src/screens/FamilyHome';
import { Settings } from './src/screens/Settings';
import { Thread } from './src/screens/Thread';
import { Share } from './src/screens/Share';
import { PhotoPick } from './src/screens/PhotoPick';
import { PhotoEvent } from './src/screens/PhotoEvent';
import { PhotoSend } from './src/screens/PhotoSend';
import { EventVoice } from './src/screens/EventVoice';
import { EventConfirm } from './src/screens/EventConfirm';
import { colors } from './src/theme';

type Route =
  | { name: 'home' }
  | { name: 'person'; id: string }
  | { name: 'event'; id: string }
  | { name: 'settings' }
  | { name: 'thread'; id: string }
  | { name: 'share' }
  | { name: 'photoPick' }
  | { name: 'photoEvent'; photos: string[] }
  | { name: 'photoSend'; photos: string[]; eventId: string | null; eventLabel: string | null }
  | { name: 'eventVoice' }
  | { name: 'eventConfirm'; transcript: string }
  | { name: 'important-create' } // cercana-care: temporary top-level entry point — FamilyHome/CalendarsTab
  | { name: 'important-status'; id: string }; // aren't ours to restructure; a real tab lands with cercana-design's merge.

initNotifications();
let spokeMorningBriefDemo = false; // mirrors PatientHome's spokeThisOpen: demo speaks the brief once

export default function App() {
  // Never block first render on fonts: text uses the system font until they arrive (or if they fail).
  const [loaded] = useFonts({
    Fraunces_500Medium, Fraunces_600SemiBold, AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold,
  });
  if (missingSettings.length > 0) return <MissingConfig names={missingSettings} />;
  return (
    <FontsReady.Provider value={loaded}>
      <Root />
    </FontsReady.Provider>
  );
}

/** After leaving the invite screen on web, drop /join/CODE from the address bar so a refresh doesn't return to it. */
function clearJoinPath() {
  if (Platform.OS !== 'web') return;
  try {
    const h = (globalThis as { history?: { replaceState: (d: unknown, t: string, url: string) => void } }).history;
    h?.replaceState(null, '', '/');
  } catch {
    /* address bar left as is */
  }
}

function Root() {
  const [session, setSession] = useState<Session | null | undefined>(undefined); // undefined = loading
  const [bootPerson, setBootPerson] = useState<string | undefined>(undefined);
  const [joinCode, setJoinCode] = useState<string | null>(null);

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
    const boot = demo ? demoBoot() : null; // ?demo=patient|family|join in any web build
    if (boot) {
      setBootPerson(boot.personId);
      setJoinCode(boot.joinCode ?? null);
      setSession(boot.session);
      return;
    }
    void loadSession().then(setSession);
  }, []);

  // Invite links: https://…/join/CODE on web, cercana://join/CODE on native.
  useEffect(() => {
    if (demo) return;
    void Linking.getInitialURL().then((u) => {
      const c = parseJoinUrl(u);
      if (c) setJoinCode(c);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      const c = parseJoinUrl(url);
      if (c) setJoinCode(c);
    });
    return () => sub.remove();
  }, []);

  const start = useCallback(async (s: Session) => {
    await saveSession(s);
    setJoinCode(null);
    clearJoinPath();
    setSession(s);
  }, []);

  const closeJoin = useCallback(() => {
    setJoinCode(null);
    clearJoinPath();
  }, []);

  const leave = useCallback(async (s: Session) => {
    if (s.role === 'family' && s.memberId) await unclaimPerson(s.memberId); // free the profile for re-claiming
    await clearSession();
    setSession(null);
  }, []);

  const alreadyIn = session && session.role === 'family' && session.code === joinCode;

  return (
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      {demo && <DemoRibbon />}
      {session === undefined ? (
        <View style={s.center}><ActivityIndicator size="large" color={colors.terracotta} /></View>
      ) : joinCode && !alreadyIn ? (
        <Join code={joinCode} onDone={start} onCancel={closeJoin} />
      ) : session === null ? (
        <Welcome onDone={start} onJoinCode={setJoinCode} />
      ) : (
        <CircleApp session={session} initialPersonId={bootPerson} onLeave={() => leave(session)} />
      )}
    </SafeAreaView>
  );
}

type CircleAppProps = { session: Session; initialPersonId?: string; onLeave: () => void };

function CircleApp({ session, initialPersonId, onLeave }: CircleAppProps) {
  const isPatient = session.role === 'patient';
  const [route, setRoute] = useState<Route>(initialPersonId ? { name: 'person', id: initialPersonId } : { name: 'home' });
  const [ping, setPing] = useState<Ping | null>(null);
  const [seen] = useState(() => new Set<string>());

  const showPing = useCallback((p: Ping) => {
    if (seen.has(p.id)) return; // realtime and push can both deliver the same ping
    seen.add(p.id);
    setPing(p);
    showWebNotification(`${p.from_name ?? 'Someone'} says`, p.message);
  }, [seen]);

  const { people, events, moments, loading, error, version, reload, reloadEvents } = useCircle(
    session.circleId,
    isPatient ? showPing : undefined,
  );
  const actor = useMemo(() => actorFor(session, people), [session, people]);

  // cercana-care: important events + check-ins, refetched whenever realtime bumps `version`.
  const [important, setImportant] = useState<ImportantEvent[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const reloadImportant = useCallback(async () => {
    const [ev, ck] = await Promise.all([listImportant(session.circleId), listCheckins(session.circleId)]);
    setImportant(ev);
    setCheckins(ck);
  }, [session.circleId]);
  useEffect(() => { void reloadImportant(); }, [reloadImportant, version]);

  const [momCheckEvent, setMomCheckEvent] = useState<ImportantEvent | null>(null);
  const [tick, setTick] = useState(0); // forces the due check below to re-run as the clock passes reminder times
  useEffect(() => {
    if (!isPatient) return;
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, [isPatient]);
  useEffect(() => {
    if (!isPatient) return;
    const due = dueCheckin(important, checkins, new Date());
    if (due) setMomCheckEvent((cur) => cur ?? due); // don't reopen over an answer the patient just gave
  }, [isPatient, important, checkins, tick]);
  useEffect(() => {
    if (isPatient) void scheduleImportantReminders(important, checkins);
  }, [isPatient, important, checkins]);

  // cercana-care: scheduled morning brief (brief_time / brief_enabled, see the Scope-add 14:25).
  const [briefSettings, setBriefSettings] = useState<BriefSettings>({ brief_time: '09:00', brief_enabled: true });
  const [lastSeenFeedAt, setLastSeenFeedAt] = useState<string | null>(null);
  useEffect(() => {
    if (!isPatient) return;
    void getBriefSettings(session.circleId).then(setBriefSettings);
  }, [isPatient, session.circleId, version]);
  useEffect(() => {
    if (!isPatient) return;
    void (async () => {
      const prev = demo ? new Date(0).toISOString() : await getFlag('lastSeenFeedAt');
      setLastSeenFeedAt(prev);
      if (!demo) await setFlag('lastSeenFeedAt', new Date().toISOString());
    })(); // once per app open, like a feed "seen" watermark
  }, [isPatient]);

  /** The full spoken brief and its short notification `items`, in the order set by briefing.ts. */
  const composeBrief = useCallback((sinceIso: string | null) => {
    const briefingEvents = mergeBriefingEvents(events, people);
    const leadLines = todaysImportantSentences(important, new Date());
    const familyLines = todaySentences(briefingEvents, new Date());
    const bday = upcomingBirthday(people, new Date(), 1); // today/tomorrow only, for the brief
    const bdayPhrase = bday ? birthdayPhrase(bday.person.name, bday.days, new Date(), bday.birthday, bday.person.relation) : null;
    const newPhotos = countNewPhotos(moments, sinceIso ? new Date(sinceIso) : null);
    const full = buildBriefing({
      patientName: session.patientName, now: new Date(), events: briefingEvents,
      leadLines, birthdayPhrase: bdayPhrase, newPhotosPhrase: newPhotosPhrase(newPhotos),
    });
    return { full, items: [...leadLines, ...familyLines], newPhotos };
  }, [events, people, important, moments, session.patientName]);

  // Native: (re)schedule the daily local notification whenever its content or the time/on-off changes.
  useEffect(() => {
    if (!isPatient) return;
    const { items, newPhotos } = composeBrief(lastSeenFeedAt);
    void scheduleMorningBrief(session.patientName, items, newPhotos, briefSettings);
  }, [isPatient, composeBrief, lastSeenFeedAt, briefSettings, session.patientName]);

  // Web: no local notifications — speak the brief in-app when the page happens to be open at brief_time.
  // Demo: speaks it once so the feature is visible without waiting for the clock (see composeBrief above).
  useEffect(() => {
    if (!isPatient || Platform.OS !== 'web') return;
    if (demo) {
      if (spokeMorningBriefDemo) return;
      spokeMorningBriefDemo = true;
      say(composeBrief(lastSeenFeedAt).full);
      return;
    }
    if (!briefSettings.brief_enabled) return;
    const [h, m] = briefSettings.brief_time.split(':').map(Number);
    const now = new Date();
    if (now.getHours() !== h || now.getMinutes() !== m) return;
    void getFlag('morning-brief-day').then(async (seen) => {
      const today = now.toDateString();
      if (seen === today) return;
      await setFlag('morning-brief-day', today);
      say(composeBrief(lastSeenFeedAt).full);
    });
  }, [isPatient, tick, briefSettings, composeBrief, lastSeenFeedAt]);

  useEffect(() => {
    if (!isPatient || demo) return; // demo: no push registration, no browser permission prompt
    void registerForPush(session.circleId, 'patient');
    requestWebNotificationPermission();
    if (Platform.OS === 'web') return; // tap-to-open push is native only; web uses realtime + Notification
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const data = r.notification.request.content.data;
      const p = pingFromNotificationData(data);
      if (p) { showPing(p); return; }
      const checkEventId = checkinEventFromNotificationData(data);
      if (checkEventId) { setMomCheckEvent(important.find((e) => e.id === checkEventId) ?? null); return; }
      if (isBriefNotificationData(data)) say(composeBrief(lastSeenFeedAt).full);
    });
    const last = Notifications.getLastNotificationResponse();
    const initial = last && pingFromNotificationData(last.notification.request.content.data);
    if (initial) showPing(initial);
    return () => sub.remove();
  }, [isPatient, session.circleId, showPing, important, composeBrief, lastSeenFeedAt]);

  const home = () => setRoute({ name: 'home' });
  const openPerson = (id: string) => setRoute({ name: 'person', id });
  const openEvent = (id: string) => setRoute({ name: 'event', id });

  let body: React.ReactNode;
  if (route.name === 'settings') {
    body = (
      <Settings session={session} canInvite={isPatient || can(actor, { type: 'invite.share' })} onBack={home} onLeave={onLeave}
        canEditBrief={can(actor, { type: 'editBrief' })} onHearBrief={() => say(composeBrief(lastSeenFeedAt).full)} />
    );
  } else if (!isPatient && route.name === 'important-create') {
    body = (
      <View style={s.panel}>
        <ImportantCreate circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null}
          onClose={home} onSaved={() => { void reloadImportant(); home(); }} />
      </View>
    );
  } else if (!isPatient && route.name === 'important-status') {
    const ev = important.find((e) => e.id === route.id);
    body = ev ? (
      <View style={s.panel}>
        <ImportantStatus event={ev} checkin={checkins.find((c) => c.important_event_id === ev.id) ?? null}
          people={people} onBack={home} />
      </View>
    ) : null;
  } else if (!isPatient) {
    body = (
      <View style={{ gap: 16 }}>
        <ImportantPanel events={important} checkins={checkins}
          onNew={() => setRoute({ name: 'important-create' })}
          onOpen={(id) => setRoute({ name: 'important-status', id })} />
        <FamilyHome session={session} actor={actor} people={people} events={events} moments={moments} error={error}
          version={version} reload={reload} reloadEvents={reloadEvents} onSettings={() => setRoute({ name: 'settings' })} />
      </View>
    );
  } else if (route.name === 'person' && people.some((p) => p.id === route.id)) {
    const person = people.find((p) => p.id === route.id)!;
    body = (
      <PersonScreen person={person} circleId={session.circleId} refreshKey={version} events={events}
        people={people} onOpenPerson={openPerson} onBack={home} />
    );
  } else if (route.name === 'event') {
    body = (
      <EventDetail eventId={route.id} events={events} people={people} moments={moments}
        onBack={home} onOpenPerson={openPerson} />
    );
  } else if (route.name === 'thread' && moments.some((m) => m.id === route.id)) {
    body = (
      <Thread moment={moments.find((m) => m.id === route.id)!} people={people} events={events}
        authorId={actor.kind === 'member' ? actor.id : null} authorName={session.memberName}
        isPatient={isPatient} onBack={home} />
    );
  } else if (route.name === 'share') {
    body = (
      <Share circleId={session.circleId} patientName={session.patientName} onPosted={home}
        onPhotos={() => setRoute({ name: 'photoPick' })} onEvent={() => setRoute({ name: 'eventVoice' })} onCancel={home} />
    );
  } else if (route.name === 'eventVoice') {
    body = (
      <EventVoice onDone={(transcript) => setRoute({ name: 'eventConfirm', transcript })} onCancel={home} />
    );
  } else if (route.name === 'eventConfirm') {
    body = (
      <EventConfirm circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null}
        transcript={route.transcript} onSaved={home} onBack={() => setRoute({ name: 'eventVoice' })} />
    );
  } else if (route.name === 'photoPick') {
    body = (
      <PhotoPick onNext={(photos) => setRoute({ name: 'photoEvent', photos })} onCancel={() => setRoute({ name: 'share' })} />
    );
  } else if (route.name === 'photoEvent') {
    body = (
      <PhotoEvent circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null} events={events}
        onNext={(eventId, eventLabel) => setRoute({ name: 'photoSend', photos: route.photos, eventId, eventLabel })}
        onBack={() => setRoute({ name: 'photoPick' })} />
    );
  } else if (route.name === 'photoSend') {
    body = (
      <PhotoSend circleId={session.circleId} patientName={session.patientName} photos={route.photos}
        eventId={route.eventId} eventLabel={route.eventLabel} onSent={home} onBack={() => setRoute({ name: 'photoEvent', photos: route.photos })} />
    );
  } else {
    body = (
      <PatientHome session={session} people={people} events={events} moments={moments} loading={loading} error={error}
        onOpenPerson={openPerson} onOpenEvent={openEvent} onOpenThread={(id) => setRoute({ name: 'thread', id })}
        onTellFamily={() => setRoute({ name: 'share' })} onSettings={() => setRoute({ name: 'settings' })}
        importantCard={
          <ImportantCard event={nextImportant(important, new Date())}
            due={!!dueCheckin(important, checkins, new Date())}
            onOpenCheck={() => setMomCheckEvent(nextImportant(important, new Date()))} />
        } />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {body}
      {isPatient && ping && <PingOverlay ping={ping} people={people} onDismiss={() => setPing(null)} />}
      {isPatient && momCheckEvent && (
        <MomCheck circleId={session.circleId} event={momCheckEvent}
          existing={checkins.find((c) => c.important_event_id === momCheckEvent.id) ?? null}
          onDone={() => { setMomCheckEvent(null); void reloadImportant(); }} />
      )}
    </View>
  );
}

/** Temporary family-side entry point for important events (see the Route comment above). */
function ImportantPanel(
  { events, checkins, onNew, onOpen }: { events: ImportantEvent[]; checkins: Checkin[]; onNew: () => void; onOpen: (id: string) => void },
) {
  const next = nextImportant(events, new Date());
  return (
    <View style={s.panel}>
      <Text style={s.panelTitle}>Important events</Text>
      {next ? (
        <Pressable onPress={() => onOpen(next.id)} accessibilityRole="button" style={s.panelRow}>
          <Text style={s.panelRowText}>{cardText(next, new Date())}</Text>
          {checkins.some((c) => c.important_event_id === next.id) ? <Text style={s.panelDone}>✓ answered</Text> : null}
        </Pressable>
      ) : (
        <Text style={s.panelEmpty}>No important events yet.</Text>
      )}
      <Pressable onPress={onNew} accessibilityRole="button" style={s.panelAdd}>
        <Text style={s.panelAddText}>+ New important event</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: {
    maxWidth: 820, width: '100%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.line, padding: 16, margin: 16, marginBottom: 0,
  },
  panelTitle: { fontSize: 16, fontWeight: '700', color: colors.inkSoft, marginBottom: 8 },
  panelRow: { paddingVertical: 6 },
  panelRowText: { fontSize: 18, fontWeight: '700', color: colors.ink },
  panelDone: { fontSize: 14, color: colors.green, fontWeight: '700', marginTop: 2 },
  panelEmpty: { fontSize: 16, color: colors.inkSoft },
  panelAdd: { marginTop: 10, minHeight: 44, justifyContent: 'center' },
  panelAddText: { fontSize: 16, color: colors.terracotta, fontWeight: '700' },
});
