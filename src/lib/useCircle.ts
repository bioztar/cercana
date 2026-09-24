import { useCallback, useEffect, useRef, useState } from 'react';
import { listPeople, subscribeCircle } from './api';
import type { Person, Ping } from './types';

/** People of a circle, kept fresh via realtime. `onPing` fires for every new ping in the circle. */
export function useCircle(circleId: string, onPing?: (p: Ping) => void) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0); // bumps on any realtime change, for dependent lists
  const pingRef = useRef(onPing);
  pingRef.current = onPing;

  const reload = useCallback(async () => {
    try {
      setPeople(await listPeople(circleId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [circleId]);

  useEffect(() => {
    void reload();
    return subscribeCircle(circleId, {
      onPing: (p) => pingRef.current?.(p),
      onChange: () => {
        setVersion((v) => v + 1);
        void reload();
      },
    });
  }, [circleId, reload]);

  return { people, loading, error, reload, version };
}
