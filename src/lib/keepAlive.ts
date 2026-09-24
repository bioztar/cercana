// ponytail: DEMO HACK, chosen knowingly by Vitaly (2026-09-24 Scope add 16:35) so arrivals can
// speak/play with the patient's phone LOCKED, ahead of a real push + Notification Service
// Extension mission (no EAS projectId yet). Loops a silent bundled clip for as long as the app
// runs so iOS keeps the JS runtime and the realtime socket alive while locked.
// Ceiling: battery drain; not App Store-safe on its own (Guideline 2.5.4 wants background audio
// to be audibly in use — ship this only with Vitaly's sign-off); killed outright if iOS
// terminates the app (low memory, force-quit, OS update). Upgrade path: drop this once remote
// push + an NSE can play the voice note as the notification sound.
import { Platform } from 'react-native';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { getFlag, setFlag } from './session';

const FLAG = 'keepListening';
let player: AudioPlayer | null = null;

/** Off only if the patient explicitly turned it off in Settings; on by default. */
export async function keepAliveEnabled(): Promise<boolean> {
  return (await getFlag(FLAG)) !== '0';
}

export async function setKeepAliveEnabled(on: boolean): Promise<void> {
  await setFlag(FLAG, on ? '1' : '0');
  if (on) await startKeepAlive();
  else stopKeepAlive();
}

/** Native only — web can't keep a tab's JS alive locked/backgrounded regardless. */
export async function startKeepAlive(): Promise<void> {
  if (Platform.OS === 'web' || player) return;
  await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'mixWithOthers' });
  player = createAudioPlayer(require('../../assets/silence.wav'));
  player.loop = true;
  player.volume = 0;
  player.play();
}

export function stopKeepAlive(): void {
  player?.pause();
  player?.remove();
  player = null;
}

/** An arrival is about to speak/play — don't fight the silent loop for the audio session. */
export function pauseKeepAlive(): void {
  player?.pause();
}

/** Arrival done — resume the loop that keeps the app alive while locked. */
export function resumeKeepAlive(): void {
  if (player) player.play();
}
