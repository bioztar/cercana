import AsyncStorage from '@react-native-async-storage/async-storage';
import { demo } from './config';
import type { Session } from './types';

const KEY = 'cercana.session.v1';

// In demo mode nothing touches AsyncStorage: a demo visit must never overwrite or clear the
// visitor's real session on the same origin.

export async function loadSession(): Promise<Session | null> {
  if (demo) return null;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch (e) {
    console.warn('loadSession failed', e);
    return null;
  }
}

export async function saveSession(s: Session): Promise<void> {
  if (demo) return;
  await AsyncStorage.setItem(KEY, JSON.stringify(s));
}

export async function clearSession(): Promise<void> {
  if (demo) return;
  await AsyncStorage.removeItem(KEY);
}

/** Tiny key/value helpers for "spoke this today" style flags. */
export async function getFlag(key: string): Promise<string | null> {
  if (demo) return null;
  try {
    return await AsyncStorage.getItem(`cercana.${key}`);
  } catch {
    return null;
  }
}

export async function setFlag(key: string, value: string): Promise<void> {
  if (demo) return;
  try {
    await AsyncStorage.setItem(`cercana.${key}`, value);
  } catch (e) {
    console.warn('setFlag failed', e);
  }
}
