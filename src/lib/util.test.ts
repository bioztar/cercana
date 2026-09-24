import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCode, isValidCode, normalizeCode, whatsappUrl, telUrl,
  normalizeBirthdayInput, birthdayToInput, spokenPing,
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

test('spokenPing', () => {
  assert.equal(spokenPing('Anna', 'Thinking of you'), 'Anna says: Thinking of you');
});
