# Rolling Home Screen Title Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The home screen title cycles endlessly through Judgement → Kachuful → Oh Hell! with a vertical slot-machine roll, and never truncates on narrow phones.

**Architecture:** A pure `titleFontSize(width)` function in `frontend/utils/titleFont.ts` computes a font size that fits the longest name ("Judgement") at the given window width — this fixes the Android truncation bug where `adjustsFontSizeToFit` ignores `letterSpacing`. A `RollingTitle` component defined in `frontend/app/index.tsx` renders two absolutely positioned title texts inside a fixed-height clipped container and rolls between them with one `Animated.Value` (native driver). Spec: `docs/superpowers/specs/2026-07-11-rolling-title-design.md`.

**Tech Stack:** React Native (Expo), `Animated` API, `node:test` for the pure function.

## Global Constraints

- Names cycle in this exact order: `Judgement`, `Kachuful`, `Oh Hell!`
- Dwell ~2500ms per name, roll transition ~350ms.
- Max title font size stays 52 (current value); `letterSpacing: 2` is preserved.
- If OS reduce-motion is on, names swap instantly on the same rhythm (no roll).
- Hero layout height must not shift during transitions (fixed-height container).
- Only files listed below may change. Kicker, subtitle, meta rows untouched.
- `frontend/utils/titleFont.ts` must not import `react-native` (it runs under plain `node:test`).

---

### Task 1: `titleFontSize` pure function (TDD)

**Files:**
- Create: `frontend/utils/titleFont.ts`
- Test: `frontend/utils/__tests__/titleFont.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TITLE_NAMES: string[]` (the three names in cycle order) and `titleFontSize(windowWidth: number): number` — Task 2 imports both from `../utils/titleFont`.

- [ ] **Step 1: Write the failing test**

Create `frontend/utils/__tests__/titleFont.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && node --import tsx --test utils/__tests__/titleFont.test.ts`
Expected: FAIL — `Cannot find module '../titleFont'`

- [ ] **Step 3: Write minimal implementation**

Create `frontend/utils/titleFont.ts`:

```ts
// Names the game is known by, in home-screen cycle order.
export const TITLE_NAMES = ['Judgement', 'Kachuful', 'Oh Hell!'];

const LONGEST_NAME_LENGTH = 9; // "Judgement"
const LETTER_SPACING = 2; // must match styles.title in app/index.tsx
const CHAR_WIDTH_RATIO = 0.7; // approx glyph width per fontSize unit for the bold serif face
const MAX_FONT_SIZE = 52;
const MIN_FONT_SIZE = 28;
const HORIZONTAL_CHROME = 48; // heroPanel paddingHorizontal (20 * 2) + safety margin

// Android's adjustsFontSizeToFit ignores letterSpacing, so the title must be
// pre-sized to fit the longest name instead of relying on auto-shrink.
export function titleFontSize(windowWidth: number): number {
  const available = windowWidth - HORIZONTAL_CHROME;
  const fit = (available / LONGEST_NAME_LENGTH - LETTER_SPACING) / CHAR_WIDTH_RATIO;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.floor(fit)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && node --import tsx --test utils/__tests__/titleFont.test.ts`
Expected: PASS (5 tests)

Also run the full suite to confirm nothing else broke:
Run: `cd frontend && npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add frontend/utils/titleFont.ts frontend/utils/__tests__/titleFont.test.ts
git commit -m "feat: add titleFontSize sizing helper for home title"
```

---

### Task 2: RollingTitle component wired into the hero

**Files:**
- Modify: `frontend/app/index.tsx` (title at line ~341, styles.title at ~547)

**Interfaces:**
- Consumes: `TITLE_NAMES` and `titleFontSize(windowWidth: number): number` from `frontend/utils/titleFont.ts` (Task 1).
- Produces: `RollingTitle({ reduceMotion }: { reduceMotion: boolean })` component, used only inside this file.

- [ ] **Step 1: Add the import**

In `frontend/app/index.tsx`, after the existing `theme` import (line 21), add:

```ts
import { TITLE_NAMES, titleFontSize } from '../utils/titleFont';
```

- [ ] **Step 2: Add the RollingTitle component at module scope**

Insert above `export default function HomeScreen()` (after `generateId`, line ~32):

```tsx
const TITLE_DWELL_MS = 2500;
const TITLE_ROLL_MS = 350;

function RollingTitle({ reduceMotion }: { reduceMotion: boolean }) {
  const { width } = useWindowDimensions();
  const fontSize = titleFontSize(width);
  const lineHeight = Math.ceil(fontSize * 1.3);
  const [index, setIndex] = useState(0);
  const roll = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let cancelled = false;
    const timer = setInterval(() => {
      if (reduceMotion) {
        setIndex((i) => (i + 1) % TITLE_NAMES.length);
        return;
      }
      Animated.timing(roll, {
        toValue: 1,
        duration: TITLE_ROLL_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished || cancelled) return;
        roll.setValue(0);
        setIndex((i) => (i + 1) % TITLE_NAMES.length);
      });
    }, TITLE_DWELL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      roll.stopAnimation();
      roll.setValue(0);
    };
  }, [reduceMotion, roll]);

  const current = TITLE_NAMES[index];
  const next = TITLE_NAMES[(index + 1) % TITLE_NAMES.length];
  const sizing = { fontSize, lineHeight };

  return (
    <View
      style={[styles.titleRoller, { height: lineHeight }]}
      accessible
      accessibilityRole="header"
      accessibilityLabel="Judgement, also known as Kachuful and Oh Hell!"
    >
      <Animated.Text
        style={[
          styles.title,
          styles.titleRolling,
          sizing,
          { transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [0, -lineHeight] }) }] },
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
        importantForAccessibility="no-hide-descendants"
      >
        {current}
      </Animated.Text>
      {!reduceMotion && (
        <Animated.Text
          style={[
            styles.title,
            styles.titleRolling,
            sizing,
            { transform: [{ translateY: roll.interpolate({ inputRange: [0, 1], outputRange: [lineHeight, 0] }) }] },
          ]}
          adjustsFontSizeToFit
          numberOfLines={1}
          importantForAccessibility="no-hide-descendants"
        >
          {next}
        </Animated.Text>
      )}
    </View>
  );
}
```

- [ ] **Step 3: Replace the static title**

At line ~341, replace:

```tsx
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>Judgement</Text>
```

with:

```tsx
            <RollingTitle reduceMotion={reduceMotion} />
```

- [ ] **Step 4: Add the two new styles**

In the `StyleSheet.create` block, next to `title:` (~line 547), remove `fontSize: 52,` from `title` (it is now passed inline) and add:

```ts
  titleRoller: {
    width: '100%',
    overflow: 'hidden',
    marginBottom: 2,
  },
  titleRolling: {
    position: 'absolute',
    left: 0,
    right: 0,
    marginBottom: 0,
  },
```

Also remove `marginBottom: 2,` from `title` (the roller container now carries it).

- [ ] **Step 5: Typecheck and run the suite**

Run: `cd frontend && npx tsc --noEmit`
Expected: no errors.

Run: `cd frontend && npm test`
Expected: all tests pass.

- [ ] **Step 6: Manual verification on device/emulator**

Start the app (Expo). Verify per the spec:
- Title rolls Judgement → Kachuful → Oh Hell! → Judgement, upward slot-machine motion, ~2.5s per name.
- On a narrow device (or emulator at 360dp width), "Judgement" renders fully — no "Judgem…".
- The hero (subtitle, meta row) does not move vertically during transitions.
- Navigate to How to Play and back: exactly one rotation running (no speed-up from stacked timers).
- With OS reduce-motion enabled, names swap instantly without sliding.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: rolling home title cycling Judgement/Kachuful/Oh Hell!"
```
