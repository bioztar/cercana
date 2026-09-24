import { useCallback, useEffect, useRef, useState } from 'react';
import { listEvents, listMoments, listPeople, subscribeCircle } from './api';
import type { Comment, EventRow, Moment, Person, Ping } from './types';

const EVENT_REFRESH_MS = 10 * 60 * 1000; // calendars are synced server-side every ~30 min
const FEED_SIZE = 40;

export type CircleHandlers = {
  onPing?: (p: Ping) => void;
  /** A new moment/comment row, straight off the wire (see src/lib/arrivals.ts). */
  onMomentInsert?: (m: Moment) => void;
  onCommentInsert?: (c: Comment) => void;
};

/** People, calendar events and the family feed of a circle, kept fresh via realtime. */
export function useCircle(circleId: string, handlers?: CircleHandlers) {
  const [people, setPeople] = useState<Person[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumps on any realtime change, for dependent lists
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const reloadEvents = useCallback(async () => {
    try {
      setEvents(await listEvents(circleId));
    } catch (e) {
      console.warn('events load failed', e); // the app works without calendars; do not block the screen
    }
  }, [circleId]);

  const reload = useCallback(async () => {
    try {
      const [p, m] = await Promise.all([listPeople(circleId), listMoments(circleId, undefined, FEED_SIZE)]);
      setPeople(p);
      setMoments(m);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [circleId]);

  useEffect(() => {
    // `loading` covers every first load, so the spoken briefing never runs on partial data.
    void Promise.all([reload(), reloadEvents()]).then(() => setLoading(false));
    const timer = setInterval(() => void reloadEvents(), EVENT_REFRESH_MS);
    const unsubscribe = subscribeCircle(circleId, {
      onPing: (p) => handlersRef.current?.onPing?.(p),
      onMomentInsert: (m) => handlersRef.current?.onMomentInsert?.(m),
      onCommentInsert: (c) => handlersRef.current?.onCommentInsert?.(c),
      onChange: () => {
        setVersion((v) => v + 1);
        void reload();
      },
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
    };
  }, [circleId, reload, reloadEvents]);

  return { people, events, moments, loading, error, reload, reloadEvents, version };
}
