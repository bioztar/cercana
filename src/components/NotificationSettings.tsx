import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Platform, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { BigButton } from './ui';
import { notificationStatus, turnOnNotifications, type NotificationStatus } from '../lib/notify';
import type { Role } from '../lib/types';
import { colors, fonts } from '../theme';

type Props = { circleId: string; role: Role; patientName: string };

/** Settings card: is this phone allowed to notify, can it get messages while closed, and a way to turn it on. */
export function NotificationSettings({ circleId, role, patientName }: Props) {
  const [status, setStatus] = useState<NotificationStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => void notificationStatus().then(setStatus).catch(() => {}), []);
  useEffect(() => {
    refresh();
    // Coming back from iPhone Settings: show the new state without leaving the screen.
    const sub = AppState.addEventListener('change', (st) => st === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  if (!status) return null;

  const turnOn = async () => {
    setBusy(true);
    try {
      setStatus(await turnOnNotifications(circleId, role));
    } finally {
      setBusy(false);
    }
  };

  const allowed = status.permission === 'granted';
  const permissionLine = {
    granted: 'On — this phone can show notifications.',
    denied: 'Off — notifications are blocked for Cercana.',
    undetermined: 'Not turned on yet.',
    unsupported: 'This browser cannot show notifications.',
  }[status.permission];
  const whatFor = role === 'patient'
    ? 'Messages from the family, birthday reminders and important events.'
    : `Birthday reminders and news about ${patientName}.`;

  return (
    <View style={s.card}>
      <Text style={s.title}>Notifications</Text>
      <Text style={s.sub}>{whatFor}</Text>

      <View style={s.row}>
        <View style={[s.dot, { backgroundColor: allowed ? colors.green : status.permission === 'denied' ? colors.danger : colors.line }]} />
        <Text style={s.rowText}>{permissionLine}</Text>
      </View>
      {Platform.OS !== 'web' ? (
        <View style={s.row}>
          <View style={[s.dot, { backgroundColor: allowed && status.pushConfigured ? colors.green : colors.line }]} />
          <Text style={s.rowText}>
            {status.pushConfigured
              ? allowed ? 'Messages arrive even when the app is closed.' : 'Turn on to get messages when the app is closed.'
              : 'Messages arrive only while Cercana is open — push is not set up for this app yet.'}
          </Text>
        </View>
      ) : null}

      {status.permission === 'undetermined' ? (
        <BigButton label="Turn on notifications" onPress={turnOn} busy={busy} />
      ) : null}
      {status.permission === 'denied' && Platform.OS !== 'web' ? (
        <>
          <Text style={s.hint}>iPhone only asks once. Turn them on in Settings → Cercana → Notifications.</Text>
          <BigButton label="Open iPhone Settings" tone="plain" onPress={() => void Linking.openSettings()} />
        </>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  title: { fontSize: 22, fontFamily: fonts.display, color: colors.ink },
  sub: { fontSize: 16, color: colors.inkSoft },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  rowText: { flex: 1, fontSize: 17, color: colors.ink },
  hint: { fontSize: 15, color: colors.inkSoft },
});
