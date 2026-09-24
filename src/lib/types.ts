export type Role = 'patient' | 'family';

export type Circle = { id: string; code: string; patient_name: string };

export type Person = {
  id: string;
  circle_id: string;
  name: string;
  relation: string | null;
  phone: string | null;
  photo_url: string | null;
  birthday: string | null;
};

export type PersonInput = Omit<Person, 'id' | 'circle_id'> & { id?: string };

export type Moment = {
  id: string;
  circle_id: string;
  person_id: string | null;
  author: string | null;
  body: string | null;
  photo_url: string | null;
  audio_url: string | null;
  created_at: string;
};

export type MomentInput = Pick<Moment, 'person_id' | 'author' | 'body' | 'photo_url' | 'audio_url'>;

export type Ping = {
  id: string;
  circle_id: string;
  from_name: string | null;
  person_id: string | null;
  message: string;
  created_at: string;
};

export type Session = {
  role: Role;
  circleId: string;
  code: string;
  patientName: string;
  memberName: string; // patient's own name, or the family member's name
  relation?: string;
};
