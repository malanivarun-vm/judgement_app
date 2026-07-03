import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareMessage, parseRoomCodeParam } from '../utils/share';

test('buildShareMessage includes code and join link', () => {
  const msg = buildShareMessage('NLVW', 'https://judgement.vercel.app');
  assert.equal(
    msg,
    'Hey, join my Judgement game! 🃏\nRoom code: NLVW\nTap to join: https://judgement.vercel.app/?code=NLVW'
  );
});

test('buildShareMessage strips trailing slash from origin', () => {
  const msg = buildShareMessage('ABCD', 'https://judgement.vercel.app/');
  assert.ok(msg.endsWith('Tap to join: https://judgement.vercel.app/?code=ABCD'));
});

test('buildShareMessage omits link line when origin is empty', () => {
  const msg = buildShareMessage('NLVW', '');
  assert.equal(msg, 'Hey, join my Judgement game! 🃏\nRoom code: NLVW');
});

test('buildShareMessage uppercases the code', () => {
  const msg = buildShareMessage('nlvw', '');
  assert.ok(msg.includes('Room code: NLVW'));
});

test('parseRoomCodeParam accepts a valid 4-letter code', () => {
  assert.equal(parseRoomCodeParam('NLVW'), 'NLVW');
});

test('parseRoomCodeParam normalizes lowercase and whitespace', () => {
  assert.equal(parseRoomCodeParam('  nlvw '), 'NLVW');
});

test('parseRoomCodeParam takes first element of an array param', () => {
  assert.equal(parseRoomCodeParam(['abcd', 'zzzz']), 'ABCD');
});

test('parseRoomCodeParam rejects invalid values', () => {
  assert.equal(parseRoomCodeParam(undefined), null);
  assert.equal(parseRoomCodeParam(null), null);
  assert.equal(parseRoomCodeParam(''), null);
  assert.equal(parseRoomCodeParam('ABC'), null);
  assert.equal(parseRoomCodeParam('ABCDE'), null);
  assert.equal(parseRoomCodeParam('AB1D'), null);
  assert.equal(parseRoomCodeParam(42), null);
  assert.equal(parseRoomCodeParam([]), null);
});
