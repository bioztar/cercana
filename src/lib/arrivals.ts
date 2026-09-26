// Pure logic for "she hears it immediately": which realtime events announce, what gets spoken,
// and queue ordering/dedupe. No React / RN imports — see arrivals.test.ts.
import { authorOf } from './feed.ts';
import type { Comment, Message, Moment, Person } from './types.ts';

export type ArrivalKind = 'moment' | 'comment' | 'message';

export type Arrival = {
  id: string; // dedupe key, unique across moments and comments
  kind: ArrivalKind;
  name: string;
  relation: string | null;
  photoUrl: string | null; // sender's avatar
  mediaPhotoUrl: string | null; // photo attached to the post itself, if any
  audioUrl: string | null;
  body: string | null; // text shown on the card (voice notes have none — the card just plays)
  spoken: string;
  createdAt: string;
};

function personFor(personId: string | null, fallbackName: string | null, people: Person[]) {
  const p = personId ? people.find((x) => x.id === personId) : undefined;
  return { name: p?.name ?? fallbackName ?? 'Someone', relation: p?.relation ?? null, photoUrl: p?.photo_url ?? null };
}

export function spokenForMoment(name: string, m: Pick<Moment, 'audio_url' | 'body'>): string {
  if (m.audio_url) return `New voice message from ${name}.`;
  if (m.body) return `${name} says: ${m.body}`;
  return `${name} sent you a photo`;
}

export function spokenForComment(name: string, c: Pick<Comment, 'audio_url' | 'body'>): string {
  if (c.audio_url) return `${name} replied with a voice message.`;
  return `${name} replied: ${c.body ?? ''}`;
}

/** A new moment posted by someone else (not Mom herself, via "Tell the family"). Null when it's Mom's own post. */
export function arrivalFromMoment(m: Moment, people: Person[]): Arrival | null {
  if (m.by_patient) return null;
  const author = authorOf(m, people);
  const { name, relation, photoUrl } = personFor(author?.id ?? null, m.author, people);
  return {
    id: `moment:${m.id}`, kind: 'moment', name, relation, photoUrl,
    mediaPhotoUrl: m.photo_url, audioUrl: m.audio_url, body: m.audio_url ? null : m.body,
    spoken: spokenForMoment(name, m), createdAt: m.created_at,
  };
}

/** A family comment on one of Mom's posts. Null when the comment is Mom's own reply (author_person_id null). */
export function arrivalFromComment(c: Comment, people: Person[]): Arrival | null {
  if (c.author_person_id === null) return null;
  const { name, relation, photoUrl } = personFor(c.author_person_id, c.author_name, people);
  return {
    id: `comment:${c.id}`, kind: 'comment', name, relation, photoUrl,
    mediaPhotoUrl: null, audioUrl: c.audio_url, body: c.audio_url ? null : c.body,
    spoken: spokenForComment(name, c), createdAt: c.created_at,
  };
}

/** A chat message from a family member to Mom. Null when it is Mom's own message. */
export function arrivalFromMessage(m: Message, people: Person[]): Arrival | null {
  if (m.from_patient) return null;
  const { name, relation, photoUrl } = personFor(m.person_id, null, people);
  return {
    id: `message:${m.id}`, kind: 'message', name, relation, photoUrl,
    mediaPhotoUrl: null, audioUrl: m.audio_url, body: m.audio_url ? null : m.body,
    spoken: m.audio_url ? `New voice message from ${name}.` : `${name} says: ${m.body ?? ''}`, createdAt: m.created_at,
  };
}

/** Appends to the queue unless already seen (dedupe realtime + push double-delivery), or older than the
 * feed watermark from a previous session (re-subscribe must not replay history). Mutates `seen`. */
export function enqueueArrival(queue: Arrival[], seen: Set<string>, arrival: Arrival | null, sinceIso: string | null): Arrival[] {
  if (!arrival || seen.has(arrival.id)) return queue;
  if (sinceIso && arrival.createdAt <= sinceIso) return queue;
  seen.add(arrival.id);
  return [...queue, arrival];
}
