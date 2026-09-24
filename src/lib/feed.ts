// Family Feed helpers. Pure: no React / RN imports.
import type { Moment, Person } from './types';

/** Who posted a moment: by id, or (older moments) by matching the author's name. */
export function authorOf(m: Pick<Moment, 'author_person_id' | 'author'>, people: Person[]): Person | null {
  if (m.author_person_id) {
    const byId = people.find((p) => p.id === m.author_person_id);
    if (byId) return byId;
  }
  const name = m.author?.trim().toLowerCase();
  return name ? people.find((p) => p.name.trim().toLowerCase() === name) ?? null : null;
}

/** Who a moment is about, when that is someone other than its author. */
export function aboutOf(m: Pick<Moment, 'person_id' | 'author_person_id' | 'author'>, people: Person[]): Person | null {
  if (!m.person_id) return null;
  const about = people.find((p) => p.id === m.person_id) ?? null;
  const author = authorOf(m, people);
  return about && about.id !== author?.id ? about : null;
}

/** A person's slice of the feed: moments about them or posted by them, newest first. */
export function sliceFor(personId: string, moments: Moment[]): Moment[] {
  return moments
    .filter((m) => m.person_id === personId || m.author_person_id === personId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}
