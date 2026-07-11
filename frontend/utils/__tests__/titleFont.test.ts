import { test } from 'node:test';
import assert from 'node:assert/strict';
import { titleFontSize, TITLE_NAMES } from '../titleFont';

test('cycles the three known names in order', () => {
  assert.deepEqual(TITLE_NAMES, ['Judgement', 'Kachuful', 'Oh Hell!']);
});

test('wide screens keep the full 52px title', () => {
  assert.equal(titleFontSize(430), 52);
  assert.equal(titleFontSize(800), 52);
});

test('narrow screens shrink the title below 52', () => {
  const narrow = titleFontSize(360);
  assert.ok(narrow < 52, `expected < 52, got ${narrow}`);
  assert.ok(narrow >= 40, `expected >= 40, got ${narrow}`);
});

test('longest name fits within available width at every size', () => {
  // Estimated rendered width of "Judgement": 9 chars * (0.7 * fontSize + 2 letterSpacing)
  // Available width: window width minus 40 hero padding minus 8 safety margin.
  for (let w = 320; w <= 500; w += 10) {
    const f = titleFontSize(w);
    const rendered = 9 * (0.7 * f + 2);
    assert.ok(rendered <= w - 48, `at width ${w}, fontSize ${f} renders ${rendered}px > ${w - 48}px`);
  }
});

test('never returns unreadably small or fractional sizes', () => {
  assert.ok(titleFontSize(200) >= 28);
  assert.equal(titleFontSize(365), Math.floor(titleFontSize(365)));
});
