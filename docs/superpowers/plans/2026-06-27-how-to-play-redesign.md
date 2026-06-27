# How-to-Play Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename trick/round/bid terminology, show home screen first, rewrite the how-to-play carousel to 10 slides with 3 new scenes, add a waiting-room link, and add a "Let's Play" button to game-mode detail cards.

**Architecture:** All changes are frontend-only (React Native / Expo Router). The 10-slide carousel reuses the existing `SlideShell` shell with three new scene components. Terminology is updated in user-visible strings only — internal variable names are unchanged. Slides are defined as a plain array in `how-to-play.tsx`; scenes are co-located under `components/how-to-play/scenes/`.

**Tech Stack:** React Native, Expo Router, TypeScript, AsyncStorage, `COLORS` / `SUIT_SYMBOLS` from `utils/theme`.

## Global Constraints

- User-visible text only: rename `trick/tricks → round/rounds`, `round/rounds (deal cycle) → session/sessions`, `bid/bids → prediction/predictions`. Internal variable names (`bid`, `tricks_won`, etc.) are not changed.
- All new scene components live in `frontend/components/how-to-play/scenes/`.
- No new dependencies. No backend changes.
- Expo Router file-based routing — do not add or remove files in `app/`.
- No frontend test runner exists. Verification steps use `grep` for text checks and visual inspection via `expo start`.
- Commit after every task.

---

### Task 1: Terminology — rename all user-visible strings

**Files:**
- Modify: `frontend/utils/variations.ts`
- Modify: `frontend/components/how-to-play/scenes/BidScene.tsx`
- Modify: `frontend/components/how-to-play/scenes/TrumpRotationScene.tsx`
- Modify: `frontend/components/mode-carousels/ClassicSlides.tsx`
- Modify: `frontend/components/mode-carousels/FixedRoundsSlides.tsx`
- Modify: `frontend/components/mode-carousels/BidFirstSlides.tsx`

**Interfaces:**
- Produces: Updated `SCORE_ROWS`, `VARIATIONS`, and scene labels consumed by `ScoreScene`, game lobby, and mode carousels.

- [ ] **Step 1: Update `variations.ts`**

Replace the entire file content:

```typescript
export const VARIATIONS = [
  { key: 'v1',   name: 'Classic',          desc: 'Decreasing cards each session' },
  { key: 'v1.1', name: 'Fixed Sessions',   desc: 'Same cards every session' },
  { key: 'v2',   name: 'Trump Call',       desc: 'Call trump after half the deal' },
  { key: 'v3',   name: 'Prediction First', desc: 'Highest prediction picks trump' },
] as const;

export type VariationKey = typeof VARIATIONS[number]['key'];

export const SCORE_ROWS = [
  { label: 'Exact prediction',           value: '+prediction × 10 pts', positive: true  },
  { label: 'Miss prediction',            value: '−prediction × 10 pts', positive: false },
  { label: 'Zero prediction, 0 rounds',  value: '+25 pts',              positive: true  },
  { label: 'Zero prediction, any rounds',value: '−25 pts',              positive: false },
];

export const HAS_SEEN_HOW_TO_PLAY_KEY = 'hasSeenHowToPlay';
```

- [ ] **Step 2: Update `BidScene.tsx` label**

In `frontend/components/how-to-play/scenes/BidScene.tsx`, change line 11:

```tsx
// Before
<Text style={styles.label}>How many tricks will you win?</Text>

// After
<Text style={styles.label}>How many rounds will you win?</Text>
```

- [ ] **Step 3: Update `TrumpRotationScene.tsx` badge labels**

In `frontend/components/how-to-play/scenes/TrumpRotationScene.tsx`, replace the `ROTATION` array (lines 5–10):

```tsx
const ROTATION = [
  { sym: SUIT_SYMBOLS.hearts,   color: COLORS.suitRed,  label: 'Sn 1', active: false },
  { sym: SUIT_SYMBOLS.spades,   color: COLORS.text,     label: 'Sn 2', active: true  },
  { sym: SUIT_SYMBOLS.diamonds, color: COLORS.suitRed,  label: 'Sn 3', active: false },
  { sym: SUIT_SYMBOLS.clubs,    color: COLORS.text,     label: 'Sn 4', active: false },
];
```

- [ ] **Step 4: Update `ClassicSlides.tsx` body text**

In `frontend/components/mode-carousels/ClassicSlides.tsx`, update the body of the first slide:

```tsx
// Before
body: 'Everything you learned in How to Play applies here. Cards decrease each round, trump rotates, bid exactly. No surprises.',

// After
body: 'Everything you learned in How to Play applies here. Cards decrease each session, trump rotates, predict exactly. No surprises.',
```

- [ ] **Step 5: Update `FixedRoundsSlides.tsx` text**

In `frontend/components/mode-carousels/FixedRoundsSlides.tsx`:

```tsx
// Slide 1 heading (line 46) — before:
heading: 'The host sets the card count and round count.',
// after:
heading: 'The host sets the card count and session count.',

// Slide 1 body (line 47) — before:
body: 'Unlike Classic, the number of cards per round stays constant throughout the game. Good for shorter or custom-length sessions.',
// after:
body: 'Unlike Classic, the number of cards per session stays constant throughout the game. Good for shorter or custom-length games.',

// Slide 2 body (line 53) — before:
body: 'Same bidding rules, same trump rotation (♥ → ♠ → ♦ → ♣), same scoring. Only the deal structure changes.',
// after:
body: 'Same prediction rules, same trump rotation (♥ → ♠ → ♦ → ♣), same scoring. Only the deal structure changes.',
```

- [ ] **Step 6: Update `BidFirstSlides.tsx` visible text**

In `frontend/components/mode-carousels/BidFirstSlides.tsx` update only the user-visible strings (not variable names):

```tsx
// Line 35 — before:
<Text style={styles.winnerLabel}>Highest bidder picks trump</Text>
// after:
<Text style={styles.winnerLabel}>Highest prediction picks trump</Text>

// Line 45 — before:
<Text style={styles.winnerNote}>Sam bid 4 — Sam picks</Text>
// after:
<Text style={styles.winnerNote}>Sam predicted 4 — Sam picks</Text>

// Slide heading (line 100) — before:
heading: 'Everyone bids before trump is decided.',
// after:
heading: 'Everyone predicts before trump is decided.',

// Slide body (line 101) — before:
body: "You're bidding blind — trump is unknown when you place your bid. No one knows which suit will dominate.",
// after:
body: "You're predicting blind — trump is unknown when you make your prediction. No one knows which suit will dominate.",

// Slide heading (line 106) — before:
heading: 'The highest bidder picks trump.',
// after:
heading: 'The highest prediction picks trump.',

// Slide body (line 107) — before:
body: 'After all bids are locked, the player with the highest bid selects the trump suit. Then the second batch of cards is dealt and play begins.',
// after:
body: 'After all predictions are locked, the player with the highest prediction selects the trump suit. Then the second batch of cards is dealt and play begins.',
```

- [ ] **Step 7: Verify no old terminology remains in visible strings**

```bash
grep -rn "trick\|\" round\|'round\| bid\b\|bids\b\|Rd [0-9]" \
  frontend/utils/variations.ts \
  frontend/components/how-to-play/scenes/BidScene.tsx \
  frontend/components/how-to-play/scenes/TrumpRotationScene.tsx \
  frontend/components/mode-carousels/
```

Expected: zero matches for old strings in user-facing text. Internal variable names (`bid`, `bidRow`, etc.) will still appear — that is correct.

- [ ] **Step 8: Commit**

```bash
git add \
  frontend/utils/variations.ts \
  frontend/components/how-to-play/scenes/BidScene.tsx \
  frontend/components/how-to-play/scenes/TrumpRotationScene.tsx \
  frontend/components/mode-carousels/ClassicSlides.tsx \
  frontend/components/mode-carousels/FixedRoundsSlides.tsx \
  frontend/components/mode-carousels/BidFirstSlides.tsx
git commit -m "feat: rename trick→round, round→session, bid→prediction in all UI text"
```

---

### Task 2: Remove home-screen auto-redirect

**Files:**
- Modify: `frontend/app/index.tsx`

**Interfaces:**
- Produces: Home screen loads unconditionally; how-to-play is accessed only via the "How to Play →" link.

- [ ] **Step 1: Delete the auto-redirect `useEffect`**

In `frontend/app/index.tsx`, remove lines 41–46 entirely:

```tsx
// DELETE these lines:
  useEffect(() => {
    AsyncStorage.getItem(HAS_SEEN_HOW_TO_PLAY_KEY).then((val) => {
      if (val !== 'true') {
        router.push('/how-to-play');
      }
    });
  }, []);
```

- [ ] **Step 2: Remove now-unused imports**

After the deletion, check if `AsyncStorage` and `HAS_SEEN_HOW_TO_PLAY_KEY` are still used elsewhere in the file.

```bash
grep -n "AsyncStorage\|HAS_SEEN_HOW_TO_PLAY_KEY" frontend/app/index.tsx
```

If neither appears in any remaining line (other than the import lines), remove both imports:

```tsx
// Remove these two import lines:
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';
```

- [ ] **Step 3: Verify**

```bash
grep -n "how-to-play\|HAS_SEEN\|AsyncStorage" frontend/app/index.tsx
```

Expected: zero matches (all references removed).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: show home screen first, remove how-to-play auto-redirect"
```

---

### Task 3: Add `doneLabel` prop to SlideShell

**Files:**
- Modify: `frontend/components/how-to-play/SlideShell.tsx`

**Interfaces:**
- Produces: `SlideShell` accepts optional `doneLabel?: string` (default `'Done'`). The Done button renders this label. Consumed by Task 4.

- [ ] **Step 1: Add prop to interface and destructure**

In `frontend/components/how-to-play/SlideShell.tsx`, update the `Props` interface (around line 6) and the function signature:

```tsx
interface Props {
  title: string;
  heading: string;
  body: string;
  scene?: React.ReactNode;
  totalSlides: number;
  currentSlide: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDone: () => void;
  doneUnlocked: boolean;
  isLast: boolean;
  isFirst: boolean;
  lockDone: boolean;
  headerLabel?: string;
  doneLabel?: string;           // ← add this line
}

export default function SlideShell({
  title, heading, body, scene,
  totalSlides, currentSlide,
  onNext, onBack, onSkip, onDone,
  doneUnlocked, isLast, isFirst, lockDone,
  headerLabel,
  doneLabel = 'Done',           // ← add this line
}: Props) {
```

- [ ] **Step 2: Use `doneLabel` in the button**

In the same file, find the Done button (around line 65) and replace the hardcoded `'Done'` string:

```tsx
// Before:
<Text style={[styles.nextBtnText, doneDisabled && styles.nextBtnTextDisabled]}>
  Done
</Text>

// After:
<Text style={[styles.nextBtnText, doneDisabled && styles.nextBtnTextDisabled]}>
  {doneLabel}
</Text>
```

- [ ] **Step 3: Verify the prop is threaded correctly**

```bash
grep -n "doneLabel\|Done" frontend/components/how-to-play/SlideShell.tsx
```

Expected: `doneLabel` appears in the interface, destructure default, and JSX. `'Done'` no longer appears as a bare string in JSX.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/how-to-play/SlideShell.tsx
git commit -m "feat: add optional doneLabel prop to SlideShell"
```

---

### Task 4: "Let's Play" button on game-mode detail cards

**Files:**
- Modify: `frontend/app/game-modes/[modeKey].tsx`

**Interfaces:**
- Consumes: `doneLabel` prop from Task 3's `SlideShell`.
- Produces: Last slide of each mode carousel shows "Let's Play →" button that navigates to `/`.

- [ ] **Step 1: Update `[modeKey].tsx`**

Replace the full file:

```tsx
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VARIATIONS } from '../../utils/variations';
import { slides as classicSlides } from '../../components/mode-carousels/ClassicSlides';
import { slides as fixedRoundsSlides } from '../../components/mode-carousels/FixedRoundsSlides';
import { slides as trumpCallSlides } from '../../components/mode-carousels/TrumpCallSlides';
import { slides as bidFirstSlides } from '../../components/mode-carousels/BidFirstSlides';
import SlideShell from '../../components/how-to-play/SlideShell';
import { ModeSlide } from '../../components/mode-carousels/types';

const SLIDE_MAP: Record<string, ModeSlide[]> = {
  'v1':   classicSlides,
  'v1.1': fixedRoundsSlides,
  'v2':   trumpCallSlides,
  'v3':   bidFirstSlides,
};

export default function ModeCarouselScreen() {
  const { modeKey } = useLocalSearchParams<{ modeKey: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState(0);

  const slides = SLIDE_MAP[modeKey] ?? classicSlides;
  const variation = VARIATIONS.find((v) => v.key === modeKey);
  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <SlideShell
      headerLabel="GAME MODES"
      title={variation?.name ?? ''}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={slides.length}
      currentSlide={current}
      onNext={() => setCurrent((c) => c + 1)}
      onBack={() => setCurrent((c) => Math.max(0, c - 1))}
      onSkip={() => router.back()}
      onDone={() => router.push('/')}
      doneLabel="Let's Play →"
      doneUnlocked={true}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={false}
    />
  );
}
```

- [ ] **Step 2: Verify**

```bash
grep -n "Let's Play\|router.push" frontend/app/game-modes/\[modeKey\].tsx
```

Expected: `"Let's Play →"` and `router.push('/')` both appear.

- [ ] **Step 3: Visual check**

Run `cd frontend && npx expo start`, open the app, tap "New to Judgement? How to Play →", navigate to "Choose Your Mode", tap any mode, swipe to its last card. Confirm the primary button reads "Let's Play →" and tapping it returns to the home screen.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/game-modes/\[modeKey\].tsx
git commit -m "feat: add Let's Play button to last slide of each game mode"
```

---

### Task 5: New scene — `GameStructureScene`

**Files:**
- Create: `frontend/components/how-to-play/scenes/GameStructureScene.tsx`

**Interfaces:**
- Produces: `GameStructureScene` — default export, no props. Renders a three-level hierarchy (Game → Sessions → Rounds) inside the sceneZone (200px height).

- [ ] **Step 1: Create the file**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';

export default function GameStructureScene() {
  return (
    <View style={styles.container}>
      <View style={[styles.box, styles.gameBox]}>
        <Text style={styles.gameLabel}>GAME</Text>
      </View>
      <Text style={styles.connector}>↓</Text>
      <View style={styles.row}>
        {['Sn 1', 'Sn 2', 'Sn 3', '…'].map((label) => (
          <View key={label} style={[styles.box, styles.sessionBox]}>
            <Text style={styles.sessionLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.connector}>↓</Text>
      <View style={styles.row}>
        {['R1', 'R2', 'R3', '…'].map((label) => (
          <View key={label} style={[styles.box, styles.roundBox]}>
            <Text style={styles.roundLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  box: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gameBox: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: 'rgba(212,175,55,0.5)',
  },
  gameLabel: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sessionBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.borderGlass,
  },
  sessionLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  roundBox: {
    width: 34,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: COLORS.borderGlass,
  },
  roundLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  connector: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
```

- [ ] **Step 2: Verify file exists**

```bash
ls frontend/components/how-to-play/scenes/GameStructureScene.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/how-to-play/scenes/GameStructureScene.tsx
git commit -m "feat: add GameStructureScene for how-to-play carousel"
```

---

### Task 6: New scene — `CardRankScene`

**Files:**
- Create: `frontend/components/how-to-play/scenes/CardRankScene.tsx`

**Interfaces:**
- Produces: `CardRankScene` — default export, no props. Renders A K Q J 10 … 2 as chips in a horizontal scroll; Ace is highlighted gold.

- [ ] **Step 1: Create the file**

```tsx
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../../utils/theme';

const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function CardRankScene() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {RANKS.map((rank, i) => (
        <React.Fragment key={rank}>
          <View style={[styles.chip, rank === 'A' && styles.chipHighlight]}>
            <Text style={[styles.rank, rank === 'A' && styles.rankHighlight]}>
              {rank}
            </Text>
          </View>
          {i < RANKS.length - 1 && (
            <Text style={styles.gt}>›</Text>
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 4,
  },
  chip: {
    width: 32,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipHighlight: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  rank: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rankHighlight: {
    color: COLORS.background,
  },
  gt: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});
```

- [ ] **Step 2: Verify file exists**

```bash
ls frontend/components/how-to-play/scenes/CardRankScene.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/how-to-play/scenes/CardRankScene.tsx
git commit -m "feat: add CardRankScene for how-to-play carousel"
```

---

### Task 7: New scene — `QuickRefScene`

**Files:**
- Create: `frontend/components/how-to-play/scenes/QuickRefScene.tsx`

**Interfaces:**
- Produces: `QuickRefScene` — default export, no props. Renders a compact four-section reference table within the 200px sceneZone.

- [ ] **Step 1: Create the file**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

export default function QuickRefScene() {
  return (
    <View style={styles.card}>
      {/* Scoring */}
      <View style={styles.section}>
        <Text style={styles.sectionHead}>SCORING</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.cell}>Exact prediction</Text>
            <Text style={styles.cell}>Miss prediction</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.cell, styles.positive]}>+pred × 10</Text>
            <Text style={[styles.cell, styles.negative]}>−pred × 10</Text>
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.cell}>Zero, 0 rounds</Text>
            <Text style={styles.cell}>Zero, any rounds</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.cell, styles.positive]}>+25 pts</Text>
            <Text style={[styles.cell, styles.negative]}>−25 pts</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Card rank */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>CARD RANK  </Text>
        <Text style={styles.cell}>A K Q J 10 9 … 2</Text>
      </View>

      <View style={styles.divider} />

      {/* Trump (Classic) */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>TRUMP (CLASSIC)  </Text>
        <Text style={styles.cell}>
          {SUIT_SYMBOLS.hearts} → {SUIT_SYMBOLS.spades} → {SUIT_SYMBOLS.diamonds} → {SUIT_SYMBOLS.clubs}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Dealer rule */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>DEALER  </Text>
        <Text style={styles.cell}>Can't match total predictions = rounds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  section: {
    gap: 2,
  },
  sectionHead: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cell: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  positive: {
    color: COLORS.success,
    fontWeight: '700',
  },
  negative: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGlass,
  },
});
```

- [ ] **Step 2: Verify file exists**

```bash
ls frontend/components/how-to-play/scenes/QuickRefScene.tsx
```

Expected: file listed.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/how-to-play/scenes/QuickRefScene.tsx
git commit -m "feat: add QuickRefScene cheat sheet for how-to-play carousel"
```

---

### Task 8: Rewrite how-to-play carousel (10 slides)

**Files:**
- Modify: `frontend/app/how-to-play.tsx`

**Interfaces:**
- Consumes: `GameStructureScene` (Task 5), `CardRankScene` (Task 6), `QuickRefScene` (Task 7).
- Produces: 10-slide carousel. Slide 10 (index 9) navigates to `/game-modes` via "Next →". No "Done" button appears (mode slide suppresses it via `isLast` override).

- [ ] **Step 1: Replace `how-to-play.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlideShell from '../components/how-to-play/SlideShell';
import IntroScene from '../components/how-to-play/scenes/IntroScene';
import GameStructureScene from '../components/how-to-play/scenes/GameStructureScene';
import BidScene from '../components/how-to-play/scenes/BidScene';
import CardRankScene from '../components/how-to-play/scenes/CardRankScene';
import TrumpRotationScene from '../components/how-to-play/scenes/TrumpRotationScene';
import TrickScene from '../components/how-to-play/scenes/TrickScene';
import ScoreScene from '../components/how-to-play/scenes/ScoreScene';
import QuickRefScene from '../components/how-to-play/scenes/QuickRefScene';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';

const SLIDES = [
  {
    title: "WHAT'S THE GOAL?",
    heading: "Predict exactly how many rounds you'll win.",
    body: "Every player declares their prediction before play. Hit it exactly and you score. Miss it and you don't. The player with the most points at the end of the game wins.",
    scene: <IntroScene />,
  },
  {
    title: 'HOW IS A GAME STRUCTURED?',
    heading: 'Game → Sessions → Rounds.',
    body: 'A game runs through multiple sessions. Each session deals a fixed number of cards — starting at the maximum, dropping by 1 each session down to 1. Inside each session everyone plays as many rounds as they have cards. If 52 doesn\'t divide evenly among players, the extra cards are set aside and not used.',
    scene: <GameStructureScene />,
  },
  {
    title: 'HOW DO I MAKE A PREDICTION?',
    heading: "Before each session, predict how many rounds you'll win.",
    body: "All players declare after seeing their cards. The goal is to match your prediction exactly — not exceed it, not fall short.",
    scene: <BidScene />,
  },
  {
    title: 'HOW DO CARDS RANK?',
    heading: 'Ace is high. 2 is low.',
    body: "A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2. Suit doesn't affect rank — except when trump changes everything.",
    scene: <CardRankScene />,
  },
  {
    title: 'WHAT IS THE TRUMP SUIT?',
    heading: 'Trump beats every other suit.',
    body: 'One suit is designated trump each session. Any trump card beats any non-trump card regardless of rank. In Classic mode trump rotates every session: ♥ → ♠ → ♦ → ♣.',
    scene: <TrumpRotationScene />,
  },
  {
    title: 'HOW DO I WIN A ROUND?',
    heading: 'Lead any card. Follow suit if you can.',
    body: "Can't follow suit? Play trump or any card. Highest trump wins. No trump played? Highest card of the lead suit wins.",
    scene: <TrickScene />,
  },
  {
    title: 'HOW DOES SCORING WORK?',
    heading: 'Exact predictions score. Misses punish.',
    body: 'Hit your prediction exactly — earn points. Miss — lose points. Predict zero and take no rounds for a big bonus.',
    scene: <ScoreScene />,
  },
  {
    title: 'WHAT SPECIAL RULES SHOULD I KNOW?',
    heading: "The dealer can't let everyone break even.",
    body: "The dealer predicts last and is blocked from any number that would make total predictions equal the rounds in that session. Someone has to be wrong.",
    scene: undefined,
  },
  {
    title: 'QUICK REFERENCE',
    heading: 'Keep this handy.',
    body: '',
    scene: <QuickRefScene />,
  },
  {
    title: "YOU'RE READY",
    heading: 'Four ways to play Judgement.',
    body: 'The host picks a mode before the game starts. Tap below to explore what makes each one different.',
    scene: undefined,
  },
];

export default function HowToPlayScreen() {
  const router = useRouter();
  const { lockDone: lockDoneParam } = useLocalSearchParams<{ lockDone?: string }>();
  const lockDone = lockDoneParam !== 'false';
  const [current, setCurrent] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);

  const advance = useCallback(() => {
    const next = current + 1;
    setCurrent(next);
    setMaxSeen((prev) => Math.max(prev, next));
  }, [current]);

  const back = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);

  const exit = useCallback(async () => {
    await AsyncStorage.setItem(HAS_SEEN_HOW_TO_PLAY_KEY, 'true');
    router.back();
  }, [router]);

  const goToModes = useCallback(() => {
    advance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/game-modes' as any);
  }, [advance, router]);

  const slide = SLIDES[current];
  const isModeSlide = current === 9;
  // Suppress Done button on the mode slide so "Next →" fires goToModes instead.
  const isLast = current === SLIDES.length - 1 && !isModeSlide;

  return (
    <SlideShell
      title={slide.title}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={SLIDES.length}
      currentSlide={current}
      onNext={isModeSlide ? goToModes : advance}
      onBack={back}
      onSkip={exit}
      onDone={exit}
      doneUnlocked={maxSeen >= SLIDES.length - 1}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={lockDone}
    />
  );
}
```

- [ ] **Step 2: Verify slide count and imports**

```bash
grep -c "title:" frontend/app/how-to-play.tsx
```

Expected: `10`

```bash
grep "import.*Scene" frontend/app/how-to-play.tsx
```

Expected: 8 scene imports (Intro, GameStructure, Bid, CardRank, TrumpRotation, Trick, Score, QuickRef).

- [ ] **Step 3: Visual end-to-end check**

Run `cd frontend && npx expo start`. Open the app and tap "How to Play →":
1. Slide 1: suits scene, "Predict exactly how many rounds you'll win."
2. Slide 2: hierarchy diagram, "Game → Sessions → Rounds."
3. Slide 3: bid picker, label reads "How many rounds will you win?"
4. Slide 4: rank strip, Ace chip highlighted gold.
5. Slide 5: trump rotation, badges read "Sn 1 / Sn 2 / Sn 3 / Sn 4".
6. Slide 6: trick scene, cards on table.
7. Slide 7: score table, rows read "Exact prediction" / "Miss prediction".
8. Slide 8: no scene, dealer rule text.
9. Slide 9: quick reference table.
10. Slide 10: "Next →" navigates to game-modes screen (not "Done").
Progress dots: 10 total.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/how-to-play.tsx
git commit -m "feat: rewrite how-to-play to 10-slide carousel with new scenes and updated terminology"
```

---

### Task 9: Waiting-room "How to Play" link

**Files:**
- Modify: `frontend/app/game.tsx`

**Interfaces:**
- Produces: A "How to Play →" text link visible to all players in the lobby (waiting phase), below the start/wait controls. Tapping opens `/how-to-play?lockDone=false`.

- [ ] **Step 1: Add the link in the waiting phase JSX**

In `frontend/app/game.tsx`, find the waiting phase block. The section currently ends with (around line 499–503):

```tsx
          {!isHost && (
            <Text style={styles.waitText}>Waiting for host to start...</Text>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
```

Add the "How to Play →" link immediately before the `{error}` line so it appears for **all** players (host and non-host):

```tsx
          {!isHost && (
            <Text style={styles.waitText}>Waiting for host to start...</Text>
          )}

          <TouchableOpacity
            style={styles.howToPlayLobbyLink}
            onPress={() => router.push('/how-to-play?lockDone=false' as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.howToPlayLobbyText}>
              New here?{'  '}
              <Text style={styles.howToPlayLobbyAction}>How to Play →</Text>
            </Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
```

- [ ] **Step 2: Add the styles**

In `game.tsx`, find the `StyleSheet.create({...})` block. Append these three entries before the closing `}`:

```tsx
  howToPlayLobbyLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 6,
  },
  howToPlayLobbyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
  },
  howToPlayLobbyAction: {
    color: 'rgba(212,175,55,0.8)',
    fontWeight: '600',
  },
```

- [ ] **Step 3: Verify**

```bash
grep -n "How to Play\|howToPlayLobby\|lockDone=false" frontend/app/game.tsx
```

Expected: the link text, style names, and the `lockDone=false` param all appear.

- [ ] **Step 4: Visual check**

Open the app, create a room as a player. In the lobby (waiting state), verify:
- "New here?  How to Play →" link appears below the start/wait area.
- Tapping opens the how-to-play carousel.
- The "Skip" button exits back to the lobby without completing the carousel.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "feat: add How to Play link in waiting room lobby"
```

---

## Self-Review

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| trick→round, round→session, bid→prediction in all UI text | Task 1 |
| TrumpRotationScene "Rd→" → "Sn→" | Task 1 Step 3 |
| SCORE_ROWS labels updated | Task 1 Step 1 |
| VARIATIONS descriptions updated | Task 1 Step 1 |
| Mode carousel text updated | Task 1 Steps 4–6 |
| Home screen loads first (remove auto-redirect) | Task 2 |
| SlideShell `doneLabel` prop | Task 3 |
| "Let's Play →" on last game-mode slide, navigates to `/` | Task 4 |
| `GameStructureScene` | Task 5 |
| `CardRankScene` | Task 6 |
| `QuickRefScene` | Task 7 |
| 10-slide SLIDES array | Task 8 |
| `isModeSlide = current === 9` | Task 8 |
| `isLast` suppressed on mode slide | Task 8 |
| End goal in slide 1 body | Task 8 |
| Card leftover note in slide 2 body | Task 8 |
| Waiting-room "How to Play →" link with `lockDone=false` | Task 9 |

All spec requirements covered.

### Type / name consistency

- `GameStructureScene`, `CardRankScene`, `QuickRefScene`: names match across Task 5/6/7 (create) and Task 8 (import).
- `doneLabel` prop: defined in Task 3, consumed in Task 4.
- `isModeSlide`: index `9` in Task 8 matches slide 10 being index 9 (0-based, 10 total).
- `VARIATIONS` key `'v1.1'` name changed to `'Fixed Sessions'` in Task 1 — check `FixedRoundsSlides.tsx` heading references `'Fixed Rounds'` in its title context. The mode name shown in game lobby comes from `VARIATIONS[].name` (Task 1 updates this). `FixedRoundsSlides.tsx` heading text is updated in Task 1 Step 5. Consistent.

### No placeholder scan

No TBDs, TODOs, or vague steps found. Every step contains actual code or an exact command.
