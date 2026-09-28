// Storage paths → short-lived signed URLs: batching + cache, with no React or Supabase import so it
// can be unit-tested with node (mediaCache.test.ts). The hooks live in mediaUrl.ts.
// Rows store object PATHS (`<circle>/<photo|audio>/<file>`, or a pre-lockdown `photo/...`); anything
// that already has a scheme (https:, blob:, file:, data:) is a final URL and passes through untouched.

const TTL_MS = 60 * 60 * 1000; // = READ_TTL_SECONDS of the media function
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // re-sign a little before the URL expires
const MAX_BATCH = 100;

export const isFinalUrl = (src: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(src);

export type Signer = (paths: string[]) => Promise<Record<string, string>>;

export class MediaUrlCache {
  private cache = new Map<string, { url: string; expires: number }>();
  private waiting = new Map<string, { resolve: (url: string | null) => void }[]>();
  private queue = new Set<string>();
  private flushing: Promise<void> | null = null;
  private readonly sign: Signer;
  private readonly now: () => number;

  constructor(sign: Signer, now: () => number = Date.now) {
    this.sign = sign;
    this.now = now;
  }

  /** The cached URL when it is still fresh, else null (no network). */
  peek(src: string | null | undefined): string | null {
    if (!src) return null;
    if (isFinalUrl(src)) return src;
    const hit = this.cache.get(src);
    return hit && hit.expires - REFRESH_MARGIN_MS > this.now() ? hit.url : null;
  }

  /** Resolves to a URL, or null when this circle may not read the path. Requests made in the same tick share one call. */
  resolve(src: string): Promise<string | null> {
    const fresh = this.peek(src);
    if (fresh) return Promise.resolve(fresh);
    return new Promise((resolve) => {
      const list = this.waiting.get(src) ?? [];
      list.push({ resolve });
      this.waiting.set(src, list);
      this.queue.add(src);
      this.flushing ??= Promise.resolve().then(() => this.flush());
    });
  }

  private async flush(): Promise<void> {
    this.flushing = null;
    const paths = [...this.queue];
    this.queue.clear();
    for (let i = 0; i < paths.length; i += MAX_BATCH) {
      const batch = paths.slice(i, i + MAX_BATCH);
      let urls: Record<string, string> = {};
      try {
        urls = await this.sign(batch);
      } catch (e) {
        console.warn('signMedia failed', e instanceof Error ? e.message : e);
      }
      const expires = this.now() + TTL_MS;
      for (const p of batch) {
        const url = urls[p] ?? null;
        if (url) this.cache.set(p, { url, expires });
        for (const w of this.waiting.get(p) ?? []) w.resolve(url);
        this.waiting.delete(p);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}
