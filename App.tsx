import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Fraunces_500Medium, Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';
import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { FontsReady } from './src/components/Text';
import * as Notifications from 'expo-notifications';
import { setAudioModeAsync } from 'expo-audio';
import { demo, missingSettings } from './src/lib/config';
import { demoBoot, demoTriggerArrival } from './src/lib/demo';
import { arrivalFromComment, arrivalFromMoment, enqueueArrival, type Arrival } from './src/lib/arrivals';
import { ArrivalOverlay } from './src/components/ArrivalOverlay';
import { keepAliveEnabled, startKeepAlive, stopKeepAlive } from './src/lib/keepAlive';
import {
  findCircleByCode, getBriefSettings, listCheckins, listImportant, listMedicationLogs, listMedications,
  unclaimPerson,
} from './src/lib/api';
import { DemoRibbon } from './src/components/DemoRibbon';
import { clearSession, getFlag, loadSession, saveSession, setFlag } from './src/lib/session';
import { useCircle } from './src/lib/useCircle';
import {
  checkinEventFromNotificationData, initNotifications, isBriefNotificationData, pingFromNotificationData,
  notifyArrival, registerForPush, requestWebNotificationPermission, scheduleImportantReminders,
  scheduleMedicationReminders, scheduleMorningBrief, showWebNotification,
} from './src/lib/notify';
import { dueCheckin, nextImportant, todaysImportantSentences } from './src/lib/important';
import { dueDoseNow, snoozeUntil, todaysDoses, type Dose } from './src/lib/meds';
import { ImportantCard } from './src/components/ImportantCard';
import { MedsCard } from './src/components/MedsCard';
import { briefNotificationBody, buildBriefing, countNewPhotos, mergeBriefingEvents, newPhotosPhrase, todaySentences } from './src/lib/briefing';
import { birthdayPhrase, upcomingBirthday } from './src/lib/dates';
import { say } from './src/lib/speech';
import { actorFor, can } from './src/lib/permissions';
import { parseJoinUrl } from './src/lib/util';
import type {
  AssistantProposal, BriefSettings, Checkin, Comment, ImportantEvent, Medication, MedicationLog, Moment, Person, Ping, Session,
} from './src/lib/types';
import { MissingConfig } from './src/screens/MissingConfig';
import { Welcome } from './src/screens/Welcome';
import { Join } from './src/screens/Join';
import { PatientHome } from './src/screens/PatientHome';
import { PersonScreen } from './src/screens/PersonScreen';
import { EventDetail } from './src/screens/EventDetail';
import { PingOverlay } from './src/screens/PingOverlay';
import { MomCheck } from './src/screens/MomCheck';
import { MedsCheck } from './src/screens/MedsCheck';
import { ImportantCreate } from './src/screens/ImportantCreate';
import { ImportantStatus } from './src/screens/ImportantStatus';
import { MedicationsManage } from './src/screens/MedicationsManage';
import { CalendarConnect, syncAllDeviceCalendars } from './src/screens/CalendarConnect';
import { FamilyHome } from './src/screens/FamilyHome';
import { Settings } from './src/screens/Settings';
import { Thread } from './src/screens/Thread';
import { Share } from './src/screens/Share';
import { PhotoPick } from './src/screens/PhotoPick';
import { PhotoEvent } from './src/screens/PhotoEvent';
import { PhotoSend } from './src/screens/PhotoSend';
import { EventVoice } from './src/screens/EventVoice';
import { EventConfirm } from './src/screens/EventConfirm';
import { FAMILY_TABS, PATIENT_TABS, type FamilyTab, type PatientTab } from './src/components/FamilyTabBar';
import { NativeFamilyTabs } from './src/components/NativeFamilyTabs';
import type { FamilyHomeTab } from './src/screens/FamilyHome';
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
  | { name: 'eventConfirm'; transcript: string; proposal: AssistantProposal | null }
  | { name: 'important-create' } // cercana-care: temporary top-level entry point — FamilyHome/CalendarsTab
  | { name: 'important-status'; id: string } // aren't ours to restructure; a real tab lands with cercana-design's merge.
  | { name: 'calendar-connect' }
  | { name: 'medications' }; // cercana-meds: add/edit/deactivate, same temporary top-level pattern

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

  // The session caches `patientName` from whenever this device joined; Andrey's re-cast (Maria →
  // Carmen) showed as "Family of Maria" until the app refreshed it (Vitaly, 2026-09-24 15:50).
  useEffect(() => {
    if (demo || !session) return;
    void findCircleByCode(session.code).then((circle) => {
      if (circle && circle.patient_name !== session.patientName) {
        const updated = { ...session, patientName: circle.patient_name };
        void saveSession(updated);
        setSession(updated);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session load, not on every session-derived update
  }, [session?.code]);

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

  // Arrivals (src/lib/arrivals.ts): new moments/comments spoken + auto-played the instant they land.
  // `lastSeenFeedAt` is declared here (not lower, with the rest of the brief state) so the realtime
  // handlers below can close over its latest value without a resubscribe.
  const [lastSeenFeedAt, setLastSeenFeedAt] = useState<string | null>(null);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [seenArrivals] = useState(() => new Set<string>());
  const peopleRef = useRef<Person[]>([]);
  const announce = useCallback((a: Arrival | null) => {
    setArrivals((q) => enqueueArrival(q, seenArrivals, a, lastSeenFeedAt));
    if (a) void notifyArrival(a.name, a.spoken);
  }, [seenArrivals, lastSeenFeedAt]);
  const onMomentInsert = useCallback((m: Moment) => announce(arrivalFromMoment(m, peopleRef.current)), [announce]);
  const onCommentInsert = useCallback((c: Comment) => announce(arrivalFromComment(c, peopleRef.current)), [announce]);

  const { people, events, moments, loading, error, version, reload, reloadEvents } = useCircle(
    session.circleId,
    isPatient ? { onPing: showPing, onMomentInsert, onCommentInsert } : undefined,
  );
  peopleRef.current = people;
  const actor = useMemo(() => actorFor(session, people), [session, people]);

  // Demo: a fixture arrival 5s after load (?demo=patient), so ArrivalOverlay can be screenshotted
  // without a second device.
  useEffect(() => {
    if (!isPatient || !demo) return;
    const t = setTimeout(() => void demoTriggerArrival(), 5000);
    return () => clearTimeout(t);
  }, [isPatient]);

  // Scope add 16:35 (Vitaly, DEMO HACK — see src/lib/keepAlive.ts): patient session keeps a silent
  // audio loop running so arrivals still speak/play with the phone locked.
  useEffect(() => {
    if (!isPatient || demo) return; // demo has no real background session to keep alive
    void keepAliveEnabled().then((on) => { if (on) void startKeepAlive(); });
    return () => stopKeepAlive();
  }, [isPatient]);

  // cercana-care: important events + check-ins, refetched whenever realtime bumps `version`.
  const [important, setImportant] = useState<ImportantEvent[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const reloadImportant = useCallback(async () => {
    const [ev, ck] = await Promise.all([listImportant(session.circleId), listCheckins(session.circleId)]);
    setImportant(ev);
    setCheckins(ck);
  }, [session.circleId]);
  useEffect(() => { void reloadImportant(); }, [reloadImportant, version]);

  // cercana-meds: medicines + their "Did you take it?" logs, refetched alongside the important events.
  const [medications, setMedications] = useState<Medication[]>([]);
  const [medicationLogs, setMedicationLogs] = useState<MedicationLog[]>([]);
  const reloadMedications = useCallback(async () => {
    const [meds, logs] = await Promise.all([listMedications(session.circleId), listMedicationLogs(session.circleId)]);
    setMedications(meds);
    setMedicationLogs(logs);
  }, [session.circleId]);
  useEffect(() => { void reloadMedications(); }, [reloadMedications, version]);

  // cercana-care: re-sync connected iPhone calendars on family app open and whenever the app
  // comes back from the background (iOS only; no-op elsewhere). One sync at a time.
  const deviceSyncing = useRef(false);
  useEffect(() => {
    if (isPatient) return;
    const sync = () => {
      if (deviceSyncing.current) return;
      deviceSyncing.current = true;
      void syncAllDeviceCalendars(session.circleId)
        .then(() => reloadEvents())
        .finally(() => { deviceSyncing.current = false; });
    };
    sync();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => sub.remove();
  }, [isPatient, session.circleId]);

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

  // cercana-meds: the doses due right now, and the full-screen "Did you take it?" for the earliest
  // one — same on-tick + on-app-open pattern as momCheckEvent above, with a local-only 30-min snooze
  // ("Not yet") that never reopens the same dose within that window.
  const [medsCheckDose, setMedsCheckDose] = useState<Dose | null>(null);
  const [snoozedUntil, setSnoozedUntil] = useState<Record<string, string>>({});
  const todaysDosesNow = useMemo(() => todaysDoses(medications, medicationLogs, new Date()), [medications, medicationLogs, tick]);
  useEffect(() => {
    if (!isPatient) return;
    const due = dueDoseNow(todaysDosesNow, new Date(), snoozedUntil);
    if (due) setMedsCheckDose((cur) => cur ?? due);
  }, [isPatient, todaysDosesNow, snoozedUntil, tick]);
  useEffect(() => {
    if (isPatient) void scheduleMedicationReminders(medications);
  }, [isPatient, medications]);

  // cercana-care: scheduled morning brief (brief_time / brief_enabled, see the Scope-add 14:25).
  const [briefSettings, setBriefSettings] = useState<BriefSettings>({ brief_time: '09:00', brief_enabled: true });
  useEffect(() => {
    // Both roles: the patient side speaks the brief, the family dashboard shows its time and offers
    // a preview.
    void getBriefSettings(session.circleId).then(setBriefSettings);
  }, [session.circleId, version]);
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
  const [familyTab, setFamilyTab] = useState<FamilyHomeTab>('Today');
  const selectFamilyTab = (t: FamilyTab) => {
    if (t === 'Settings') return setRoute({ name: 'settings' });
    setFamilyTab(t);
    home();
  };
  const activeFamilyTab: FamilyTab = route.name === 'settings' ? 'Settings' : familyTab;
  // Carmen's tab bar (Vitaly, 2026-09-24 15:50/15:55): Feed/People/Calendar/Chats content switches
  // inside PatientHome itself; "Tell family" became the floating "+" there, not a tab.
  const [patientTab, setPatientTab] = useState<PatientTab>('Feed');
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
      <Panel>
        <ImportantCreate circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null}
          onClose={home} onSaved={() => { void reloadImportant(); home(); }} />
      </Panel>
    );
  } else if (!isPatient && route.name === 'important-status') {
    const ev = important.find((e) => e.id === route.id);
    body = ev ? (
      <Panel>
        <ImportantStatus event={ev} checkin={checkins.find((c) => c.important_event_id === ev.id) ?? null}
          people={people} canView={can(actor, { type: 'viewCheckin', creatorId: ev.created_by_person_id })} onBack={home} />
      </Panel>
    ) : null;
  } else if (!isPatient && route.name === 'calendar-connect') {
    body = (
      <Panel>
        <CalendarConnect circleId={session.circleId} people={people} onClose={home}
          onConnected={() => { void reloadEvents(); home(); }} />
      </Panel>
    );
  } else if (!isPatient && route.name === 'medications') {
    body = (
      <Panel>
        <MedicationsManage circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null}
          medications={medications} onClose={home} onChanged={() => void reloadMedications()} />
      </Panel>
    );
  } else if (!isPatient && route.name !== 'eventVoice' && route.name !== 'eventConfirm') {
    body = (
      <FamilyHome session={session} actor={actor} people={people} events={events} moments={moments} error={error}
        version={version} reload={reload} reloadEvents={reloadEvents} tab={familyTab}
        important={important} checkins={checkins} briefSettings={briefSettings}
        medications={medications} medicationLogs={medicationLogs} onManageMedications={() => setRoute({ name: 'medications' })}
        onDictate={() => setRoute({ name: 'eventVoice' })}
        onNewImportant={() => setRoute({ name: 'important-create' })}
        onOpenImportant={(id) => setRoute({ name: 'important-status', id })}
        onHearBrief={() => say(composeBrief(null).full)}
        onConnectDeviceCalendar={() => setRoute({ name: 'calendar-connect' })} onSelectTab={setFamilyTab} />
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
    const voice = (
      <EventVoice circleId={session.circleId} speakerPersonId={actor.kind === 'member' ? actor.id : null}
        patientName={session.patientName} family={!isPatient}
        onDone={(transcript, proposal) => setRoute({ name: 'eventConfirm', transcript, proposal })} onCancel={home} />
    );
    body = isPatient ? voice : <Panel>{voice}</Panel>;
  } else if (route.name === 'eventConfirm') {
    const confirm = (
      <EventConfirm circleId={session.circleId} createdByPersonId={actor.kind === 'member' ? actor.id : null}
        transcript={route.transcript} proposal={route.proposal} onSaved={home} onBack={() => setRoute({ name: 'eventVoice' })} />
    );
    body = isPatient ? confirm : <Panel>{confirm}</Panel>;
  } else if (route.name === 'photoPick') {
    body = (
      <PhotoPick onNext={(photos) => setRoute({ name: 'photoEvent', photos })} onCancel={home} />
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
      <PatientHome session={session} people={people} events={events} moments={moments} important={important}
        checkins={checkins} briefSettings={briefSettings} loading={loading} error={error} tab={patientTab}
        onOpenPerson={openPerson} onOpenEvent={openEvent} onOpenThread={(id) => setRoute({ name: 'thread', id })}
        onSettings={() => setRoute({ name: 'settings' })}
        onSharePhotos={() => setRoute({ name: 'photoPick' })} onAddEvent={() => setRoute({ name: 'eventVoice' })}
        importantCard={
          <ImportantCard event={nextImportant(important, new Date())}
            due={!!dueCheckin(important, checkins, new Date())}
            onOpenCheck={() => setMomCheckEvent(nextImportant(important, new Date()))} />
        }
        medsCard={<MedsCard doses={todaysDosesNow} onOpenCheck={setMedsCheckDose} />} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {isPatient ? (
        <NativeFamilyTabs tabs={PATIENT_TABS} active={patientTab} onSelect={setPatientTab} large>{body}</NativeFamilyTabs>
      ) : (
        <NativeFamilyTabs tabs={FAMILY_TABS} active={activeFamilyTab} onSelect={selectFamilyTab}>{body}</NativeFamilyTabs>
      )}
      {isPatient && ping && <PingOverlay ping={ping} people={people} onDismiss={() => setPing(null)} />}
      {isPatient && !ping && !momCheckEvent && !medsCheckDose && arrivals[0] && (
        <ArrivalOverlay arrival={arrivals[0]} onDismiss={() => setArrivals((q) => q.slice(1))} />
      )}
      {isPatient && !ping && momCheckEvent && (
        <MomCheck circleId={session.circleId} event={momCheckEvent}
          existing={checkins.find((c) => c.important_event_id === momCheckEvent.id) ?? null}
          onDone={() => { setMomCheckEvent(null); void reloadImportant(); }} />
      )}
      {isPatient && !ping && !momCheckEvent && medsCheckDose && (
        <MedsCheck circleId={session.circleId} dose={medsCheckDose}
          onSnooze={() => setSnoozedUntil((m) => ({ ...m, [medsCheckDose.key]: snoozeUntil(new Date()) }))}
          onDone={() => { setMedsCheckDose(null); void reloadMedications(); }} />
      )}
    </View>
  );
}

/** A full-screen card that scrolls: long content (an iPhone with a dozen calendars) must not push its buttons off-screen. */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
      <View style={s.panel}>{children}</View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  panel: {
    maxWidth: 820, width: '100%', alignSelf: 'center', backgroundColor: colors.card, borderRadius: 16,
    borderWidth: 1, borderColor: colors.line, padding: 16, margin: 16, marginBottom: 0,
  },
});
