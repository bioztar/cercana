import * as Speech from 'expo-speech';

/** Speak slowly and clearly; interrupts anything already being read. */
export function say(text: string): void {
  try {
    Speech.stop();
    Speech.speak(text, { rate: 0.9 });
  } catch (e) {
    console.warn('speech failed', e);
  }
}

export function stopSaying(): void {
  try {
    void Speech.stop();
  } catch {
    /* nothing speaking */
  }
}
