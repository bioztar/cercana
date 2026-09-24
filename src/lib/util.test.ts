import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCode, isValidCode, normalizeCode, whatsappUrl, telUrl,
  normalizeBirthdayInput, birthdayToInput, spokenPing, urlHint, uuidv4,
} from './util.ts';

test('generateCode: 6 chars, no 0/O/1/I', () => {
  for (let i = 0; i < 500; i++) {
    const c = generateCode();
    assert.equal(c.length, 6);
    assert.match(c, /^[^01OI]+$/);
    assert.ok(isValidCode(c));
  }
  assert.equal(generateCode(() => 0), 'AAAAAA');
});

test('normalizeCode', () => {
  assert.equal(normalizeCode(' k7m-4qx '), 'K7M4QX');
  assert.equal(isValidCode('K7M4Q0'), false);
});

test('whatsapp / tel urls', () => {
  assert.equal(whatsappUrl('+34 612 345 678'), 'https://wa.me/34612345678');
  assert.equal(whatsappUrl(''), null);
  assert.equal(whatsappUrl(null), null);
  assert.equal(telUrl('+34 612 345 678'), 'tel:+34612345678');
  assert.equal(telUrl('612345678'), 'tel:612345678');
});

test('birthday input', () => {
  assert.equal(normalizeBirthdayInput(''), '');
  assert.equal(normalizeBirthdayInput('1990-3-5'), '1990-03-05');
  assert.equal(normalizeBirthdayInput('03-05'), '0004-03-05');
  assert.equal(normalizeBirthdayInput('02-29'), '0004-02-29');
  assert.equal(normalizeBirthdayInput('2001-02-29'), null);
  assert.equal(normalizeBirthdayInput('13-01'), null);
  assert.equal(normalizeBirthdayInput('hello'), null);
  assert.equal(birthdayToInput('0004-03-05'), '03-05');
  assert.equal(birthdayToInput('1990-03-05'), '1990-03-05');
});

test('urlHint never reveals a token', () => {
  assert.equal(urlHint('https://calendar.google.com/calendar/ical/x%40gmail.com/private-abc123/basic.ics'), '…/basic.ics');
  assert.equal(urlHint('webcal://p01-caldav.icloud.com/published/2/MTIzNDU2Nzg5'), 'p01-caldav.icloud.com');
  assert.equal(urlHint('https://outlook.live.com/owa/calendar/abc/reachcalendar.ics'), '…/reachcalendar.ics');
  assert.equal(urlHint('https://example.com/private-SECRET.ics'), 'example.com');
  assert.equal(urlHint('nonsense'), '');
});

test('uuidv4 shape', () => {
  assert.match(uuidv4(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(uuidv4(), uuidv4());
});

test('spokenPing', () => {
  assert.equal(spokenPing('Anna', 'Thinking of you'), 'Anna says: Thinking of you');
});
