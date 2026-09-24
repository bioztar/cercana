// The one place that decides real vs demo data. Everything else imports from here.
import { demo } from './config';
import * as real from './api.real';
import * as fixtures from './demo';

const impl: typeof real = demo ? fixtures : real;

export const createCircle = impl.createCircle;
export const findCircleByCode = impl.findCircleByCode;
export const claimPerson = impl.claimPerson;
export const unclaimPerson = impl.unclaimPerson;
export const setPersonRole = impl.setPersonRole;
export const transferLead = impl.transferLead;
export const deleteMoment = impl.deleteMoment;
export const listPeople = impl.listPeople;
export const savePerson = impl.savePerson;
export const deletePerson = impl.deletePerson;
export const listMoments = impl.listMoments;
export const addMoment = impl.addMoment;
export const uploadMedia = impl.uploadMedia;
export const sendPing = impl.sendPing;
export const registerDevice = impl.registerDevice;
export const listCalendars = impl.listCalendars;
export const addCalendar = impl.addCalendar;
export const deleteCalendar = impl.deleteCalendar;
export const syncCalendars = impl.syncCalendars;
export const listEvents = impl.listEvents;
export const subscribeCircle = impl.subscribeCircle;

// ---- voice mission: Thread comments + "Tell the family" -------------------------------------
export const listComments = impl.listComments;
export const addComment = impl.addComment;
export const commentSummaries = impl.commentSummaries;
export const ensureFamilyCalendar = impl.ensureFamilyCalendar;
export const addEvent = impl.addEvent;
