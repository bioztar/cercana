// Every permission decision in the app goes through `can()`. Pure: no React / RN imports.
// Enforcement is UI-only this week (no login, demo RLS). The next mission swaps in real auth + RLS
// and can reuse this module unchanged (same actor/action/target vocabulary).
//
//   lead    exactly one per circle; everything admins can, plus roles, hand-over and removing people
//   admin   edit ANY profile, invite, manage calendars, delete moments
//   member  edit ONLY their own profile; post moments and pings; add calendars linked to themselves
//   patient view-only (their phone has no editing UI at all)

export type MemberRole = 'lead' | 'admin' | 'member';

export type Actor =
  | { kind: 'patient' }
  | { kind: 'member'; id: string | null; role: MemberRole }; // id null = has not claimed a profile

export type PersonTarget = { id: string; role: MemberRole; claimed: boolean };

export type Action =
  | { type: 'person.add' }
  | { type: 'person.edit'; target: PersonTarget }
  | { type: 'person.remove'; target: PersonTarget }
  | { type: 'person.setRole'; target: PersonTarget; role: 'admin' | 'member' }
  | { type: 'lead.handover'; target: PersonTarget }
  | { type: 'invite.share' }
  | { type: 'calendar.add'; personIds: string[] }
  | { type: 'calendar.remove'; personIds: string[] }
  | { type: 'calendar.refresh' }
  | { type: 'moment.post' }
  | { type: 'moment.delete' }
  | { type: 'ping.send' }
  | { type: 'editBrief' } // morning brief settings: Mom (patient device) or lead/admin
  | { type: 'viewCheckin'; creatorId: string | null } // Mom's "Did you go?" answer: creator + lead/admin only
  | { type: 'medication.manage' }; // add/edit/deactivate Mom's medicines: lead/admin only

export type ActionType = Action['type'];

const isMember = (a: Actor): a is Extract<Actor, { kind: 'member' }> => a.kind === 'member';
const isStaff = (a: Actor) => isMember(a) && (a.role === 'lead' || a.role === 'admin');

/** A calendar is "theirs" when it is linked to people and every one of them is the actor. */
const onlySelf = (a: Actor, personIds: string[]) =>
  isMember(a) && a.id !== null && personIds.length > 0 && personIds.every((id) => id === a.id);

export function can(actor: Actor, action: Action): boolean {
  if (action.type === 'editBrief') return actor.kind === 'patient' || isStaff(actor); // Mom, or lead/admin
  if (!isMember(actor)) return false; // patient device: view-only otherwise

  switch (action.type) {
    case 'person.add':
    case 'invite.share':
    case 'calendar.refresh':
    case 'moment.delete':
    case 'medication.manage':
      return isStaff(actor);

    case 'person.edit':
      // Everyone can always edit their own profile; staff can edit any.
      return actor.id === action.target.id || isStaff(actor);

    case 'person.remove':
      // Lead only, and the lead profile itself is never removable (exactly one lead per circle).
      return actor.role === 'lead' && action.target.role !== 'lead';

    case 'person.setRole':
      return actor.role === 'lead' && action.target.role !== 'lead' && action.target.id !== actor.id;

    case 'lead.handover':
      // To another, real (claimed) person: a lead nobody can log in as would strand the circle.
      return actor.role === 'lead' && action.target.id !== actor.id && action.target.role !== 'lead' && action.target.claimed;

    case 'calendar.add':
    case 'calendar.remove':
      return isStaff(actor) || onlySelf(actor, action.personIds);

    case 'moment.post':
    case 'ping.send':
      return true;

    case 'viewCheckin':
      return isStaff(actor) || (actor.id !== null && actor.id === action.creatorId);
  }
}

/** Who is acting, from the session's claimed profile and the circle's people. */
export function actorFor(
  session: { role: 'patient' | 'family'; memberId?: string },
  people: { id: string; role: MemberRole }[],
): Actor {
  if (session.role === 'patient') return { kind: 'patient' };
  const me = session.memberId ? people.find((p) => p.id === session.memberId) : undefined;
  return { kind: 'member', id: me?.id ?? null, role: me?.role ?? 'member' };
}

export const ROLE_LABEL: Record<MemberRole, string> = { lead: 'Lead', admin: 'Admin', member: 'Member' };
