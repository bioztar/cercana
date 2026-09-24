import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Platform, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { setAudioModeAsync } from 'expo-audio';
import { demo, missingSettings } from './src/lib/config';
import { demoBoot } from './src/lib/demo';
import { unclaimPerson } from './src/lib/api';
import { DemoRibbon } from './src/components/DemoRibbon';
import { clearSession, loadSession, saveSession } from './src/lib/session';
import { useCircle } from './src/lib/useCircle';
import {
  initNotifications, pingFromNotificationData, registerForPush,
  requestWebNotificationPermission, showWebNotification,
} from './src/lib/notify';
import { actorFor, can } from './src/lib/permissions';
import { parseJoinUrl } from './src/lib/util';
import type { Ping, Session } from './src/lib/types';
import { MissingConfig } from './src/screens/MissingConfig';
import { Welcome } from './src/screens/Welcome';
import { Join } from './src/screens/Join';
import { PatientHome } from './src/screens/PatientHome';
import { PersonScreen } from './src/screens/PersonScreen';
import { PingOverlay } from './src/screens/PingOverlay';
import { FamilyHome } from './src/screens/FamilyHome';
import { Settings } from './src/screens/Settings';
import { colors } from './src/theme';

type Route = { name: 'home' } | { name: 'person'; id: string } | { name: 'settings' };

initNotifications();

export default function App() {
  if (missingSettings.length > 0) return <MissingConfig names={missingSettings} />;
  return <Root />;
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

  useEffect(() => {
    if (!isPatient || demo) return; // demo: no push registration, no browser permission prompt
    void registerForPush(session.circleId, 'patient');
    requestWebNotificationPermission();
    if (Platform.OS === 'web') return; // tap-to-open push is native only; web uses realtime + Notification
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const p = pingFromNotificationData(r.notification.request.content.data);
      if (p) showPing(p);
    });
    const last = Notifications.getLastNotificationResponse();
    const initial = last && pingFromNotificationData(last.notification.request.content.data);
    if (initial) showPing(initial);
    return () => sub.remove();
  }, [isPatient, session.circleId, showPing]);

  const home = () => setRoute({ name: 'home' });
  const openPerson = (id: string) => setRoute({ name: 'person', id });

  let body: React.ReactNode;
  if (route.name === 'settings') {
    body = (
      <Settings session={session} canInvite={isPatient || can(actor, { type: 'invite.share' })} onBack={home} onLeave={onLeave} />
    );
  } else if (!isPatient) {
    body = (
      <FamilyHome session={session} actor={actor} people={people} error={error} version={version} reload={reload}
        reloadEvents={reloadEvents} onSettings={() => setRoute({ name: 'settings' })} />
    );
  } else if (route.name === 'person' && people.some((p) => p.id === route.id)) {
    const person = people.find((p) => p.id === route.id)!;
    body = (
      <PersonScreen person={person} circleId={session.circleId} refreshKey={version} events={events}
        people={people} onOpenPerson={openPerson} onBack={home} />
    );
  } else {
    body = (
      <PatientHome session={session} people={people} events={events} moments={moments} loading={loading} error={error}
        onOpenPerson={openPerson} onSettings={() => setRoute({ name: 'settings' })} />
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {body}
      {isPatient && ping && <PingOverlay ping={ping} people={people} onDismiss={() => setPing(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
