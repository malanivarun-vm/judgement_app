import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bidStatus, scoreColor, BID_STATUS_COLORS } from '../bidStatus';

test('pending before any bid', () => {
  assert.equal(bidStatus(null, 0), 'pending');
});

test('chasing while under bid', () => {
  assert.equal(bidStatus(3, 1), 'chasing');
});

test('secured when tricks equal bid', () => {
  assert.equal(bidStatus(2, 2), 'secured');
  assert.equal(bidStatus(0, 0), 'secured');
});

test('busted when tricks exceed bid', () => {
  assert.equal(bidStatus(2, 3), 'busted');
  assert.equal(bidStatus(0, 1), 'busted');
});

test('every status has a color', () => {
  for (const s of ['pending', 'chasing', 'secured', 'busted'] as const) {
    assert.match(BID_STATUS_COLORS[s], /^#|^rgba/);
  }
});

test('scoreColor is red for negative, gold otherwise', () => {
  assert.notEqual(scoreColor(-30), scoreColor(0));
  assert.equal(scoreColor(0), scoreColor(25));
});
