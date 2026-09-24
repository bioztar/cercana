// Live speech-to-text while recording. Web only (Web Speech API, when the browser has it).
// Native: no maintained Expo-bundled recognizer, so recordings stay voice-only (transcript is '').

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export type Transcriber = { stop: () => Promise<string> };

/** Starts listening; returns null when unsupported. `onText` receives the running transcript. */
export function startTranscribing(onText?: (t: string) => void): Transcriber | null {
  const g = globalThis as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (!Ctor) return null;
  try {
    const rec = new Ctor();
    let text = '';
    let finished: () => void = () => {};
    const ended = new Promise<void>((res) => { finished = res; });
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = (globalThis as { navigator?: { language?: string } }).navigator?.language ?? 'en-US';
    rec.onresult = (e) => {
      text = Array.from(e.results).map((r) => r[0]?.transcript ?? '').join(' ').trim();
      onText?.(text);
    };
    rec.onerror = () => finished();
    rec.onend = () => finished();
    rec.start();
    return {
      stop: async () => {
        try { rec.stop(); } catch { /* already stopped */ }
        await Promise.race([ended, new Promise<void>((r) => setTimeout(r, 1200))]);
        return text;
      },
    };
  } catch (e) {
    console.warn('speech recognition unavailable', e);
    return null;
  }
}
