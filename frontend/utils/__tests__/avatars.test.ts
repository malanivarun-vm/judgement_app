import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AVATARS, pickRandomAvatar, sanitizeAvatar } from '../avatars';

test('AVATARS is a fixed set of 12 unique emoji', () => {
  assert.equal(AVATARS.length, 12);
  assert.equal(new Set(AVATARS).size, 12);
});

test('pickRandomAvatar always returns a member of the set', () => {
  for (let i = 0; i < 50; i++) {
    assert.ok((AVATARS as readonly string[]).includes(pickRandomAvatar()));
  }
});

test('sanitizeAvatar accepts set members and rejects everything else', () => {
  assert.equal(sanitizeAvatar('🦊'), '🦊');
  assert.equal(sanitizeAvatar('💩'), '');
  assert.equal(sanitizeAvatar('<script>'), '');
  assert.equal(sanitizeAvatar(null), '');
  assert.equal(sanitizeAvatar(undefined), '');
  assert.equal(sanitizeAvatar(42), '');
});
