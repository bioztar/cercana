import { useCallback, useEffect, useState } from 'react';
import { listMessages, subscribeCircle } from './api';
import type { Message } from './types';

/** All chat messages of a circle, live. Failures (e.g. the table not migrated yet) leave the list empty. */
export function useMessages(circleId: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const reload = useCallback(async () => {
    try {
      setMessages(await listMessages(circleId));
    } catch (e) {
      console.warn('chats load failed', e);
    }
  }, [circleId]);
  useEffect(() => {
    void reload();
    return subscribeCircle(circleId, { onChange: () => void reload() });
  }, [circleId, reload]);
  return { messages, reload };
}
