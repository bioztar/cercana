import test from 'node:test';
import assert from 'node:assert/strict';
import { avatarInitials } from './avatar.ts';

test('avatarInitials: single letter with no collision', () => {
  assert.equal(avatarInitials('Anna', ['Anna', 'Pedro', 'Carmen']), 'A');
  assert.equal(avatarInitials('Pedro', []), 'P');
  assert.equal(avatarInitials('', ['Anna']), '?');
});

test('avatarInitials: two letters when someone else shares the first letter', () => {
  assert.equal(avatarInitials('Masha', ['Masha', 'Maxim']), 'Ma');
  assert.equal(avatarInitials('Maxim', ['Masha', 'Maxim']), 'Mx');
});

test('avatarInitials: ignores itself in the group', () => {
  assert.equal(avatarInitials('Anna', ['Anna']), 'A');
});
