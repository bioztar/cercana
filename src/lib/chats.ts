// Pure logic for the 1:1 chats (Mom <-> one family member). No React / RN imports — see chats.test.ts.
import type { Message, Person } from './types.ts';

export type Viewer = 'patient' | 'family';

export type ChatSummary = { person: Person; last: Message | null; unread: number };

/** What a bubble or list row shows: typed text, else the voice note's transcript, else null. */
export function messageText(m: Pick<Message, 'body' | 'transcript'>): string | null {
  return m.body?.trim() || m.transcript?.trim() || null;
}

export function lastLine(m: Message): string {
  return messageText(m) ?? (m.audio_url ? '🎤 Voice message' : '');
}

/** One pair's messages, oldest first. */
export function threadMessages(messages: Message[], personId: string): Message[] {
  return messages.filter((m) => m.person_id === personId).sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/** Unread for the viewer = written by the other side and not opened yet. */
export const isUnreadFor = (m: Message, viewer: Viewer): boolean =>
  m.read_at === null && m.from_patient === (viewer === 'family');

/** Ids to stamp as read when `viewer` opens a thread. */
export function unreadIds(messages: Message[], personId: string, viewer: Viewer): string[] {
  return messages.filter((m) => m.person_id === personId && isUnreadFor(m, viewer)).map((m) => m.id);
}

/** Threads for the list: newest activity first, silent ones after (in people order). */
export function chatSummaries(people: Person[], messages: Message[], viewer: Viewer): ChatSummary[] {
  const rows = people.map((person) => {
    const t = threadMessages(messages, person.id);
    return { person, last: t[t.length - 1] ?? null, unread: t.filter((m) => isUnreadFor(m, viewer)).length };
  });
  const withLast = rows.filter((r) => r.last).sort((a, b) => b.last!.created_at.localeCompare(a.last!.created_at));
  return [...withLast, ...rows.filter((r) => !r.last)];
}

/** Whose threads this family device may see: everyone's for lead/admin, else only its own. */
export function visibleChatPeople(people: Person[], meId: string | null, canViewAll: boolean): Person[] {
  if (canViewAll) return people;
  return people.filter((p) => p.id === meId);
}
