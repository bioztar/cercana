import type { MemberRole } from './permissions';

export type { MemberRole };

/** Which kind of phone this is. Not to be confused with a person's MemberRole (lead/admin/member). */
export type Role = 'patient' | 'family';

export type Circle = { id: string; code: string; patient_name: string };

/** The person who sets up the circle becomes its lead. */
export type LeadInput = { name: string; relation?: string };
export type CreatedCircle = Circle & { lead_id: string | null };

export type Person = {
  id: string;
  circle_id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  photo_url: string | null;
  birthday: string | null;
  role: MemberRole;
  claimed: boolean; // a family member's device has picked this profile; false = someone who doesn't use the app
};

/** Editable profile fields. Role and claimed change only through their own API calls. */
export type PersonInput = Omit<Person, 'id' | 'circle_id' | 'role' | 'claimed'> & { id?: string };

export type Moment = {
  id: string;
  circle_id: string;
  person_id: string | null; // who it is about
  author_person_id: string | null; // who posted it
  author: string | null;
  body: string | null;
  photo_url: string | null;
  photo_urls?: string[]; // extra photos beyond photo_url (shown as a 2-up row); not stored yet
  audio_url: string | null;
  created_at: string;
  by_patient?: boolean; // Mom posted it herself ("Tell the family")
  event_id?: string | null; // explicit link to an events row (cercana-voice's column)
};

export type MomentInput = Pick<Moment, 'person_id' | 'author_person_id' | 'author' | 'body' | 'photo_url' | 'audio_url'> &
  Partial<Pick<Moment, 'by_patient' | 'event_id'>>;

export type Ping = {
  id: string;
  circle_id: string;
  from_name: string | null;
  person_id: string | null;
  message: string;
  created_at: string;
};

/** What clients may see of a calendar. The ICS URL is never readable (see supabase/schema.sql). */
export type CalendarPublic = {
  id: string;
  circle_id: string;
  label: string;
  url_hint: string | null;
  last_synced_at: string | null;
  last_error: string | null;
  person_ids: string[];
};

export type EventRow = {
  id: string;
  calendar_id: string;
  uid: string;
  title: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  person_ids: string[]; // people whose calendars carry this event
  created_by_person_id: string | null; // null = the patient created it herself (EventVoice)
  includes_patient: boolean; // Calendar's "For you" vs "Family" split (Vitaly, 2026-09-24 15:50)
};

export type Session = {
  role: Role;
  circleId: string;
  code: string;
  patientName: string;
  memberName: string; // patient's own name, or the family member's name
  memberId?: string; // family: the people.id this device claimed (no login: the device is the identity)
  relation?: string;
};

// ---- Thread comments and Mom's "Tell the family" ----------------------------------------------------
export type Comment = {
  id: string;
  moment_id: string;
  circle_id: string;
  author_person_id: string | null; // null = Mom
  author_name: string | null;
  body: string | null;
  audio_url: string | null;
  created_at: string;
};

export type CommentInput = Pick<Comment, 'moment_id' | 'author_person_id' | 'author_name' | 'body' | 'audio_url'>;

/** What a feed card shows under a moment: how many comments and the newest one. */
export type CommentSummary = { count: number; last: Comment };

export type NewEventInput = { title: string; starts_at: string; ends_at: string; all_day: boolean };

/** A finished voice recording: uploaded url, length, and what the device heard (may be empty). */
export type VoiceClip = { url: string; seconds: number; transcript: string };

// ---- Important events + "Did you go?" check-ins (cercana-care) ---------------------------------
export type ReminderKind = 'evening_before' | 'on_day' | 'check';
export type Reminder = { kind: ReminderKind; at: string }; // at = ISO instant

export type ImportantEvent = {
  id: string;
  circle_id: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  for_person: 'mom'; // Mom only for now
  created_by_person_id: string | null;
  reminders: Reminder[];
  created_at: string;
};

export type ImportantInput = Pick<ImportantEvent, 'title' | 'starts_at' | 'ends_at' | 'location' | 'created_by_person_id' | 'reminders'>;

export type CheckinAnswer = 'went' | 'missed' | 'rescheduled';

export type Checkin = {
  id: string;
  circle_id: string;
  important_event_id: string;
  answer: CheckinAnswer;
  note_audio_url: string | null;
  answered_at: string;
};

/** A phone calendar row ready to upsert into `events` (see src/lib/deviceCalendar.ts). */
export type DeviceEventRow = {
  uid: string;
  title: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
};

/** The scheduled morning brief, per circle (`circles.brief_time`/`brief_enabled`). `brief_time` is "HH:MM". */
export type BriefSettings = { brief_time: string; brief_enabled: boolean };

/** A connected iPhone calendar: our row id plus the device-local calendar id (stored in
 * `calendars.url_hint` for source:'device' rows) needed to re-sync it later. */
export type DeviceCalendarLink = { id: string; device_calendar_id: string };
