// React hooks that turn stored media paths into renderable signed URLs (see mediaCache.ts).
import { useEffect, useState } from 'react';
import { signMedia } from './api';
import { MediaUrlCache } from './mediaCache';

export const mediaUrls = new MediaUrlCache(signMedia);

/** A renderable URL for a stored media path (or a final URL): `undefined` while signing, `null` when
 * there is nothing to show (no src, or this circle may not read it). */
export function useMediaUrl(src: string | null | undefined): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(() => (src ? mediaUrls.peek(src) ?? undefined : null));
  useEffect(() => {
    if (!src) {
      setUrl(null);
      return;
    }
    const now = mediaUrls.peek(src);
    setUrl(now ?? undefined);
    if (now) return;
    let live = true;
    void mediaUrls.resolve(src).then((u) => { if (live) setUrl(u); });
    return () => { live = false; };
  }, [src]);
  return url;
}

/** Same for a list (e.g. a moment's photo strip); order preserved, unresolved entries dropped. */
export function useMediaUrls(srcs: readonly string[]): string[] {
  const key = srcs.join('\n');
  const [urls, setUrls] = useState<string[]>(() => srcs.map((s) => mediaUrls.peek(s)).filter((u): u is string => !!u));
  useEffect(() => {
    let live = true;
    void Promise.all(srcs.map((s) => mediaUrls.resolve(s))).then((all) => {
      if (live) setUrls(all.filter((u): u is string => !!u));
    });
    return () => { live = false; };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return urls;
}
