import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatPositions, seatSize } from '../tableLayout';

const overlaps = (a: any, b: any, w: number, h: number) =>
  Math.abs(a.left - b.left) < w && Math.abs(a.top - b.top) < h;

test('returns one position per opponent, 1 through 6', () => {
  for (let n = 1; n <= 6; n++) {
    assert.equal(seatPositions(n, 380, 420, 96, 64).length, n);
  }
});

test('no two seats overlap at 6 opponents on a small phone', () => {
  const { width, height } = seatSize(6, 360);
  const pos = seatPositions(6, 360, 400, width, height);
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      assert.ok(!overlaps(pos[i], pos[j], width, height), `seats ${i} and ${j} overlap`);
    }
  }
});

test('all seats stay inside the stage', () => {
  const { width, height } = seatSize(6, 360);
  for (const p of seatPositions(6, 360, 400, width, height)) {
    assert.ok(p.left >= -1 && p.left + width <= 361, `left out of bounds: ${p.left}`);
    assert.ok(p.top >= -1 && p.top + height <= 401, `top out of bounds: ${p.top}`);
  }
});

test('single opponent sits top-center', () => {
  const [p] = seatPositions(1, 380, 420, 96, 64);
  assert.ok(Math.abs(p.left + 48 - 190) < 2, 'not horizontally centered');
  assert.ok(p.top < 100, 'not near the top');
});

test('layout is left-right symmetric', () => {
  const pos = seatPositions(4, 380, 420, 96, 64);
  const cx = 190;
  assert.ok(Math.abs((pos[0].left + 48 - cx) + (pos[3].left + 48 - cx)) < 2);
  assert.ok(Math.abs(pos[0].top - pos[3].top) < 2);
});
