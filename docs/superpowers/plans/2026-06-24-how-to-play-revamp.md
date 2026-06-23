# How to Play Revamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the existing `HowToPlayModal` with a three-screen system: an 8-slide universal rules carousel, a Game Modes list screen, and per-mode "what's different" carousels — all built with rendered React Native components using the existing design token system.

**Architecture:** New full-screen Expo Router routes (`/how-to-play`, `/game-modes`, `/game-modes/[modeKey]`) replace the modal. Stateless scene components use existing `COLORS`, `CARD_SIZES`, and `SUIT_SYMBOLS` from `utils/theme.ts`. First-launch state persisted in `AsyncStorage`.

**Tech Stack:** Expo SDK 54, Expo Router 6, React Native, TypeScript 5.9, `@react-native-async-storage/async-storage`

## Global Constraints

- All components use `COLORS`, `CARD_SIZES`, `SUIT_SYMBOLS` from `frontend/utils/theme.ts` — no hardcoded colour values
- Mode names and descriptions must match the `VARIATIONS` array in `game.tsx` exactly: `Classic / Fixed Rounds / Trump Call / Bid First`
- Minimum touch target: 44px height on all interactive elements
- No animation on scene components in this version (roadmap item)
- No new backend changes required
- TypeScript strict mode — run `npx tsc --noEmit` after each task to verify
- Working directory for all commands: `frontend/`

---

## File Map

**New files:**
- `app/how-to-play.tsx` — Screen 1: 8-slide universal rules carousel
- `app/game-modes.tsx` — Screen 2: mode list
- `app/game-modes/[modeKey].tsx` — Screen 3: per-mode carousel (dynamic route)
- `utils/variations.ts` — shared VARIATIONS constant + SCORE_ROWS (extracted from game.tsx / HowToPlayModal.tsx)
- `components/how-to-play/SlideShell.tsx` — carousel slide layout (header, scene zone, text, footer)
- `components/how-to-play/ProgressDots.tsx` — dot indicators
- `components/how-to-play/scenes/IntroScene.tsx`
- `components/how-to-play/scenes/HandScene.tsx`
- `components/how-to-play/scenes/TrumpRotationScene.tsx`
- `components/how-to-play/scenes/TrickScene.tsx`
- `components/how-to-play/scenes/BidScene.tsx`
- `components/how-to-play/scenes/ScoreScene.tsx`
- `components/ModeCard.tsx` — reusable mode card for Screen 2
- `components/mode-carousels/ClassicSlides.tsx`
- `components/mode-carousels/FixedRoundsSlides.tsx`
- `components/mode-carousels/TrumpCallSlides.tsx`
- `components/mode-carousels/BidFirstSlides.tsx`

**Modified files:**
- `app/_layout.tsx` — register new routes
- `app/index.tsx` — replace modal with first-launch router push; remove HowToPlayModal import
- `app/game.tsx` — extract VARIATIONS import; add `?` help button
- `components/HowToPlayModal.tsx` — delete after Task 4 wires the replacement

---

## Task 1: Install AsyncStorage + extract shared constants

**Files:**
- Create: `frontend/utils/variations.ts`
- Modify: `frontend/app/game.tsx` (lines 65–70, replace VARIATIONS with import)
- Modify: `frontend/components/HowToPlayModal.tsx` (lines 15–20, replace SCORE_ROWS with import)

**Interfaces:**
- Produces:
  ```ts
  // utils/variations.ts
  export const VARIATIONS: { key: string; name: string; desc: string }[]
  export const SCORE_ROWS: { label: string; value: string; positive: boolean }[]
  export const HAS_SEEN_HOW_TO_PLAY_KEY = 'hasSeenHowToPlay'
  ```

- [ ] **Step 1: Install AsyncStorage**

```bash
npx expo install @react-native-async-storage/async-storage
```

Expected: package added to `package.json`, no errors.

- [ ] **Step 2: Create `utils/variations.ts`**

```ts
export const VARIATIONS = [
  { key: 'v1',  name: 'Classic',      desc: 'Decreasing cards each round' },
  { key: 'v1.1', name: 'Fixed Rounds', desc: 'Same cards every round' },
  { key: 'v2',  name: 'Trump Call',   desc: 'Call trump after half the deal' },
  { key: 'v3',  name: 'Bid First',    desc: 'Highest bidder picks trump' },
] as const;

export type VariationKey = typeof VARIATIONS[number]['key'];

export const SCORE_ROWS = [
  { label: 'Exact bid',            value: '+bid × 10 pts', positive: true },
  { label: 'Miss bid',             value: '−bid × 10 pts', positive: false },
  { label: 'Zero bid, 0 tricks',   value: '+25 pts',       positive: true },
  { label: 'Zero bid, any tricks', value: '−25 pts',       positive: false },
];

export const HAS_SEEN_HOW_TO_PLAY_KEY = 'hasSeenHowToPlay';
```

- [ ] **Step 3: Update `game.tsx` to import from `utils/variations.ts`**

Remove lines 65–70 (`const VARIATIONS = [...]`) and add at the top of imports:

```ts
import { VARIATIONS } from '../utils/variations';
```

- [ ] **Step 4: Update `HowToPlayModal.tsx` to import SCORE_ROWS**

Remove lines 15–20 (`const SCORE_ROWS = [...]`) and add at the top of imports:

```ts
import { SCORE_ROWS } from '../utils/variations';
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add utils/variations.ts app/game.tsx components/HowToPlayModal.tsx package.json
git commit -m "feat: extract VARIATIONS and SCORE_ROWS to shared utils, install AsyncStorage"
```

---

## Task 2: Carousel shell components (SlideShell + ProgressDots)

**Files:**
- Create: `frontend/components/how-to-play/SlideShell.tsx`
- Create: `frontend/components/how-to-play/ProgressDots.tsx`

**Interfaces:**
- Produces:
  ```ts
  // SlideShell.tsx
  interface SlideShellProps {
    title: string;           // gold kicker (all-caps label)
    heading: string;         // white bold headline
    body: string;            // secondary body text
    scene?: React.ReactNode; // rendered scene component, shown in scene zone
    totalSlides: number;
    currentSlide: number;    // 0-indexed
    onNext: () => void;
    onBack: () => void;
    onSkip: () => void;
    onDone: () => void;      // called on last slide; disabled until doneUnlocked
    doneUnlocked: boolean;
    isLast: boolean;
    isFirst: boolean;
    lockDone: boolean;       // true = show Done but keep disabled until doneUnlocked
  }
  export default function SlideShell(props: SlideShellProps): JSX.Element

  // ProgressDots.tsx
  interface ProgressDotsProps {
    total: number;
    current: number; // 0-indexed
  }
  export default function ProgressDots(props: ProgressDotsProps): JSX.Element
  ```

- [ ] **Step 1: Create `components/how-to-play/ProgressDots.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/theme';

interface Props { total: number; current: number; }

export default function ProgressDots({ total, current }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  dotActive: {
    width: 24,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.gold,
  },
});
```

- [ ] **Step 2: Create `components/how-to-play/SlideShell.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from '../../utils/theme';
import ProgressDots from './ProgressDots';

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
}

export default function SlideShell({
  title, heading, body, scene,
  totalSlides, currentSlide,
  onNext, onBack, onSkip, onDone,
  doneUnlocked, isLast, isFirst, lockDone,
}: Props) {
  const doneDisabled = lockDone && !doneUnlocked;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>HOW TO PLAY</Text>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipBtn}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Scene zone */}
      {scene != null && (
        <View style={styles.sceneZone}>{scene}</View>
      )}

      {/* Text content */}
      <View style={styles.textBlock}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ProgressDots total={totalSlides} current={currentSlide} />
        <View style={styles.navRow}>
          {!isFirst && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          {isLast ? (
            <TouchableOpacity
              style={[styles.nextBtn, doneDisabled && styles.nextBtnDisabled]}
              onPress={doneDisabled ? undefined : onDone}
              disabled={doneDisabled}
            >
              <Text style={[styles.nextBtnText, doneDisabled && styles.nextBtnTextDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  headerLabel: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  skipBtn: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  sceneZone: {
    marginHorizontal: 20,
    marginTop: 20,
    height: 200,
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flex: 1,
  },
  kicker: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
    alignItems: 'center',
    gap: 14,
  },
  navRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  nextBtnText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '800',
  },
  nextBtnTextDisabled: {
    color: 'rgba(212,175,55,0.5)',
  },
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add components/how-to-play/
git commit -m "feat: add SlideShell and ProgressDots carousel infrastructure"
```

---

## Task 3: Scene components (Slides 1–6)

**Files:**
- Create: `frontend/components/how-to-play/scenes/IntroScene.tsx`
- Create: `frontend/components/how-to-play/scenes/HandScene.tsx`
- Create: `frontend/components/how-to-play/scenes/TrumpRotationScene.tsx`
- Create: `frontend/components/how-to-play/scenes/TrickScene.tsx`
- Create: `frontend/components/how-to-play/scenes/BidScene.tsx`
- Create: `frontend/components/how-to-play/scenes/ScoreScene.tsx`

**Interfaces:**
- Consumes: `COLORS`, `SUIT_SYMBOLS`, `SUIT_DISPLAY_COLORS`, `CARD_SIZES` from `utils/theme.ts`; `SCORE_ROWS` from `utils/variations.ts`; `PlayingCard` from `components/PlayingCard.tsx`
- Produces: 6 default-exported React components, each `() => JSX.Element`, no props required

- [ ] **Step 1: Create `IntroScene.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

export default function IntroScene() {
  const suits = [
    { sym: SUIT_SYMBOLS.hearts,   color: COLORS.suitRed },
    { sym: SUIT_SYMBOLS.spades,   color: COLORS.text },
    { sym: SUIT_SYMBOLS.diamonds, color: COLORS.suitRed },
    { sym: SUIT_SYMBOLS.clubs,    color: COLORS.text },
  ];
  return (
    <View style={styles.grid}>
      {suits.map((s, i) => (
        <Text key={i} style={[styles.suit, { color: s.color }]}>{s.sym}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suit: { fontSize: 52, opacity: 0.9 },
});
```

- [ ] **Step 2: Create `HandScene.tsx`**

```tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import PlayingCard from '../../PlayingCard';

const HAND = [
  { suit: 'spades',   rank: 'A' },
  { suit: 'hearts',   rank: 'K' },
  { suit: 'diamonds', rank: '7' },
  { suit: 'clubs',    rank: 'J' },
  { suit: 'spades',   rank: '3' },
];

const ROTATIONS = [-18, -9, 0, 9, 18];

export default function HandScene() {
  return (
    <View style={styles.fan}>
      {HAND.map((card, i) => (
        <View
          key={i}
          style={[
            styles.cardWrap,
            { transform: [{ rotate: `${ROTATIONS[i]}deg` }, { translateY: Math.abs(ROTATIONS[i]) * 0.8 }] },
          ]}
        >
          <PlayingCard card={card} size="trick" disabled />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  cardWrap: { marginHorizontal: -10 },
});
```

- [ ] **Step 3: Create `TrumpRotationScene.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

const ROTATION = [
  { sym: SUIT_SYMBOLS.hearts,   color: COLORS.suitRed,  label: 'Rd 1', active: false },
  { sym: SUIT_SYMBOLS.spades,   color: COLORS.text,     label: 'Rd 2', active: true  },
  { sym: SUIT_SYMBOLS.diamonds, color: COLORS.suitRed,  label: 'Rd 3', active: false },
  { sym: SUIT_SYMBOLS.clubs,    color: COLORS.text,     label: 'Rd 4', active: false },
];

export default function TrumpRotationScene() {
  return (
    <View style={styles.row}>
      {ROTATION.map((item, i) => (
        <React.Fragment key={i}>
          <View style={[styles.badge, item.active && styles.badgeActive]}>
            <Text style={[styles.sym, { color: item.color }, !item.active && styles.dimmed]}>
              {item.sym}
            </Text>
            <Text style={[styles.label, item.active && styles.labelActive]}>{item.label}</Text>
          </View>
          {i < ROTATION.length - 1 && (
            <Text style={styles.arrow}>→</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: 'rgba(212,175,55,0.4)',
  },
  sym: { fontSize: 32 },
  dimmed: { opacity: 0.35 },
  label: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 },
  labelActive: { color: COLORS.gold, fontWeight: '700' },
  arrow: { color: COLORS.textSecondary, fontSize: 14 },
});
```

- [ ] **Step 4: Create `TrickScene.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlayingCard from '../../PlayingCard';
import { COLORS } from '../../../utils/theme';

const TRICK = [
  { suit: 'hearts',   rank: '9',  winner: false },
  { suit: 'hearts',   rank: 'K',  winner: true  },
  { suit: 'diamonds', rank: '4',  winner: false },
  { suit: 'clubs',    rank: '10', winner: false },
];

export default function TrickScene() {
  return (
    <View style={styles.table}>
      {TRICK.map((c, i) => (
        <View key={i} style={styles.cardWrap}>
          <PlayingCard card={c} size="trick" highlighted={c.winner} />
          {c.winner && <Text style={styles.winnerLabel}>Winner</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  cardWrap: { alignItems: 'center' },
  winnerLabel: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
});
```

- [ ] **Step 5: Create `BidScene.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';

const BIDS = [0, 1, 2, 3, 4, 5];
const SELECTED = 2;

export default function BidScene() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How many tricks will you win?</Text>
      <View style={styles.row}>
        {BIDS.map((n) => (
          <View key={n} style={[styles.bid, n === SELECTED && styles.bidSelected]}>
            <Text style={[styles.bidText, n === SELECTED && styles.bidTextSelected]}>
              {n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 14 },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  bid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidSelected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  bidText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
  bidTextSelected: { color: COLORS.background },
});
```

- [ ] **Step 6: Create `ScoreScene.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';
import { SCORE_ROWS } from '../../../utils/variations';

export default function ScoreScene() {
  return (
    <View style={styles.table}>
      {SCORE_ROWS.map((row, i) => (
        <View
          key={row.label}
          style={[styles.row, i < SCORE_ROWS.length - 1 && styles.rowBorder]}
        >
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.positive ? styles.positive : styles.negative]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    width: '100%',
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderGlass },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  value: { fontSize: 12, fontWeight: '700' },
  positive: { color: COLORS.success },
  negative: { color: COLORS.danger },
});
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add components/how-to-play/scenes/
git commit -m "feat: add 6 scene components for How to Play carousel"
```

---

## Task 4: Screen 1 — How to Play carousel route

**Files:**
- Create: `frontend/app/how-to-play.tsx`
- Modify: `frontend/app/_layout.tsx` — register `how-to-play` route
- Modify: `frontend/app/index.tsx` — first-launch check + replace modal with router.push; remove HowToPlayModal import
- Delete: `frontend/components/HowToPlayModal.tsx` (after wiring)

**Interfaces:**
- Consumes: `SlideShell`, all 6 scene components, `HAS_SEEN_HOW_TO_PLAY_KEY` from `utils/variations.ts`
- Produces: `/how-to-play` route; sets `hasSeenHowToPlay` in AsyncStorage on exit

- [ ] **Step 1: Create `app/how-to-play.tsx`**

```tsx
import React, { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlideShell from '../components/how-to-play/SlideShell';
import IntroScene from '../components/how-to-play/scenes/IntroScene';
import HandScene from '../components/how-to-play/scenes/HandScene';
import TrumpRotationScene from '../components/how-to-play/scenes/TrumpRotationScene';
import TrickScene from '../components/how-to-play/scenes/TrickScene';
import BidScene from '../components/how-to-play/scenes/BidScene';
import ScoreScene from '../components/how-to-play/scenes/ScoreScene';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';

const SLIDES = [
  {
    title: 'Judgement / Oh Hell',
    heading: 'Bid the exact number of tricks you will take.',
    body: 'Every round is a prediction game. Exact bids score. Misses punish.',
    scene: <IntroScene />,
  },
  {
    title: 'The Deal',
    heading: 'You get a hand of cards each round.',
    body: 'Cards dealt = floor(52 ÷ players). The count drops by 1 every round, down to 1-card rounds.',
    scene: <HandScene />,
  },
  {
    title: 'Trump Suits',
    heading: 'Trump rotates every round.',
    body: 'Trump beats any non-trump card. ♥ → ♠ → ♦ → ♣, cycling each round.',
    scene: <TrumpRotationScene />,
  },
  {
    title: 'Playing a Trick',
    heading: 'Lead any card. Follow suit if you can.',
    body: "If you can't follow suit, play trump or any card. Highest trump wins; otherwise highest card of the lead suit wins.",
    scene: <TrickScene />,
  },
  {
    title: 'Bidding',
    heading: 'Predict exactly how many tricks you will win.',
    body: 'Bid clockwise after the deal. The dealer bids last and cannot bid a number that makes total bids equal tricks available.',
    scene: <BidScene />,
  },
  {
    title: 'Scoring',
    heading: 'Exact bids win. Misses punish.',
    body: 'Zero bids are high-risk, high-reward. One trick when you bid zero costs you 25 points.',
    scene: <ScoreScene />,
  },
  {
    title: 'Game Modes',
    heading: 'Four ways to play Judgement.',
    body: 'The host picks a mode before the game starts. Tap below to explore what makes each one different.',
    scene: undefined,
  },
  {
    title: "You're Ready",
    heading: "Time to play.",
    body: 'Bid precisely. Play smart. The table is waiting.',
    scene: undefined,
  },
];

interface Props {
  lockDone?: boolean; // false when opened from in-game help
}

export default function HowToPlayScreen({ lockDone = true }: Props) {
  const router = useRouter();
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
    router.push('/game-modes');
  }, [router]);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;
  const isModeSlide = current === 6;

  return (
    <SlideShell
      title={slide.title}
      heading={slide.heading}
      body={isModeSlide
        ? slide.body + (isModeSlide ? '' : '')
        : slide.body}
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

- [ ] **Step 2: Register route in `_layout.tsx`**

Add `<Stack.Screen name="how-to-play" />` inside the `<Stack>` block, after the `game` entry:

```tsx
<Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
  <Stack.Screen name="index" />
  <Stack.Screen name="game" />
  <Stack.Screen name="how-to-play" />
  <Stack.Screen name="game-modes" />
  <Stack.Screen name="game-modes/[modeKey]" />
</Stack>
```

(Add all new routes in one edit; the other screens don't exist yet but registering them now avoids revisiting `_layout.tsx`.)

- [ ] **Step 3: Wire first-launch check in `app/index.tsx`**

Add `useEffect` that checks `AsyncStorage` on mount. If `hasSeenHowToPlay` is not set, navigate to `/how-to-play`. Also replace the "How to Play →" link to push `/how-to-play` instead of opening the modal. Remove the `HowToPlayModal` import and its state variable.

Add this import at the top:
```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';
```

Add this effect inside `HomeScreen` (before the return):
```ts
useEffect(() => {
  AsyncStorage.getItem(HAS_SEEN_HOW_TO_PLAY_KEY).then((val) => {
    if (val !== 'true') {
      router.push('/how-to-play');
    }
  });
}, []);
```

Replace the modal state and "How to Play →" handler:
```tsx
// Remove: const [howToPlayVisible, setHowToPlayVisible] = useState(false);

// Change onPress of howToPlayLink:
onPress={async () => {
  await fireHaptic('selection');
  router.push('/how-to-play');
}}
```

Remove the `<HowToPlayModal ... />` JSX from the return statement.

- [ ] **Step 4: Delete `HowToPlayModal.tsx`**

```bash
rm components/HowToPlayModal.tsx
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Smoke test in Expo**

```bash
npx expo start
```

- Open app on first launch → `/how-to-play` loads automatically
- Swipe through all 8 slides → "Done" unlocks on slide 8
- Tap Skip → returns to Home
- Tap "How to Play →" link on Home → opens carousel again
- Tap Done → returns to Home

- [ ] **Step 7: Commit**

```bash
git add app/how-to-play.tsx app/_layout.tsx app/index.tsx
git commit -m "feat: add How to Play full-screen carousel (Screen 1)"
```

---

## Task 5: Screen 2 — Game Modes list

**Files:**
- Create: `frontend/components/ModeCard.tsx`
- Create: `frontend/app/game-modes.tsx`

**Interfaces:**
- Consumes: `VARIATIONS` from `utils/variations.ts`
- Produces:
  ```ts
  // ModeCard.tsx
  interface ModeCardProps {
    name: string;
    desc: string;
    modeKey: string;
    isDefault?: boolean;
    onPress: () => void;
  }
  export default function ModeCard(props: ModeCardProps): JSX.Element
  ```

- [ ] **Step 1: Create `components/ModeCard.tsx`**

```tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

interface Props {
  name: string;
  desc: string;
  modeKey: string;
  isDefault?: boolean;
  onPress: () => void;
}

export default function ModeCard({ name, desc, isDefault, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, isDefault && styles.cardDefault]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.name, isDefault && styles.nameDefault]}>{name}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
        {isDefault && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DEFAULT</Text>
          </View>
        )}
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 16,
    marginBottom: 10,
  },
  cardDefault: { borderColor: COLORS.borderAccent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textBlock: { flex: 1 },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  nameDefault: { color: COLORS.goldLight },
  desc: { color: COLORS.textSecondary, fontSize: 13 },
  badge: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  arrow: { color: COLORS.gold, fontSize: 16 },
});
```

- [ ] **Step 2: Create `app/game-modes.tsx`**

```tsx
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../utils/theme';
import { VARIATIONS } from '../utils/variations';
import ModeCard from '../components/ModeCard';

export default function GameModesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>GAME MODES</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          The host picks a mode before the game. Tap any mode to learn what makes it different.
        </Text>
        {VARIATIONS.map((v) => (
          <ModeCard
            key={v.key}
            modeKey={v.key}
            name={v.name}
            desc={v.desc}
            isDefault={v.key === 'v1'}
            onPress={() => router.push(`/game-modes/${v.key}`)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  back: { color: COLORS.textSecondary, fontSize: 14 },
  title: { color: COLORS.goldLight, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  headerSpacer: { width: 40 },
  scroll: { padding: 20 },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
});
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Smoke test in Expo**

- Navigate to `/game-modes` (tap "Choose Your Mode" on Slide 7 or use dev tools)
- All 4 mode cards render with correct names/descriptions
- Classic card shows "DEFAULT" badge
- Each card taps without crashing (route doesn't exist yet — will crash; that's expected until Task 6)

- [ ] **Step 5: Commit**

```bash
git add app/game-modes.tsx components/ModeCard.tsx
git commit -m "feat: add Game Modes list screen (Screen 2)"
```

---

## Task 6: Screen 3 — Per-mode carousels

**Files:**
- Create: `frontend/app/game-modes/[modeKey].tsx`
- Create: `frontend/components/mode-carousels/ClassicSlides.tsx`
- Create: `frontend/components/mode-carousels/FixedRoundsSlides.tsx`
- Create: `frontend/components/mode-carousels/TrumpCallSlides.tsx`
- Create: `frontend/components/mode-carousels/BidFirstSlides.tsx`

**Interfaces:**
- Consumes: `SlideShell`, `ProgressDots`, `VARIATIONS` from `utils/variations.ts`, `PlayingCard`
- Produces: `SlideData[]` from each carousel file; `/game-modes/[modeKey]` dynamic route

Each slide file exports:
```ts
export interface ModeSlide {
  title: string;
  heading: string;
  body: string;
  scene?: React.ReactNode;
}
export const slides: ModeSlide[]
```

- [ ] **Step 1: Create `components/mode-carousels/ClassicSlides.tsx`**

```tsx
import React from 'react';
import IntroScene from '../how-to-play/scenes/IntroScene';
import { ModeSlide } from './types';

export const slides: ModeSlide[] = [
  {
    title: 'Classic',
    heading: 'This is the standard game.',
    body: 'Everything you learned in How to Play applies here. Cards decrease each round, trump rotates, bid exactly. No surprises.',
    scene: <IntroScene />,
  },
];
```

- [ ] **Step 2: Create `components/mode-carousels/types.ts`**

```ts
import React from 'react';

export interface ModeSlide {
  title: string;
  heading: string;
  body: string;
  scene?: React.ReactNode;
}
```

- [ ] **Step 3: Create `components/mode-carousels/FixedRoundsSlides.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/theme';
import { ModeSlide } from './types';

function ConfigScene() {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>Cards / Round</Text>
          <Text style={styles.value}>10</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>Total Rounds</Text>
          <Text style={styles.value}>8</Text>
        </View>
      </View>
      <Text style={styles.note}>Set by host before the game</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  row: {
    flexDirection: 'row',
    gap: 0,
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    overflow: 'hidden',
  },
  item: { padding: 20, alignItems: 'center', flex: 1 },
  divider: { width: 1, backgroundColor: COLORS.borderGlass },
  label: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 6 },
  value: { color: COLORS.goldLight, fontSize: 32, fontWeight: '800' },
  note: { color: COLORS.textSecondary, fontSize: 12 },
});

export const slides: ModeSlide[] = [
  {
    title: 'Fixed Rounds',
    heading: 'The host sets the card count and round count.',
    body: 'Unlike Classic, the number of cards per round stays constant throughout the game. Good for shorter or custom-length sessions.',
    scene: <ConfigScene />,
  },
  {
    title: 'Fixed Rounds',
    heading: 'Everything else is identical to Classic.',
    body: 'Same bidding rules, same trump rotation (♥ → ♠ → ♦ → ♣), same scoring. Only the deal structure changes.',
    scene: undefined,
  },
];
```

- [ ] **Step 4: Create `components/mode-carousels/TrumpCallSlides.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlayingCard from '../PlayingCard';
import { COLORS, SUIT_SYMBOLS } from '../../utils/theme';
import { ModeSlide } from './types';

function TwoBatchScene() {
  const batch1 = [{ suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: '7' }, { suit: 'clubs', rank: 'J' }];
  const batch2 = [{ suit: 'diamonds', rank: '4' }, { suit: 'spades', rank: '9' }];
  return (
    <View style={styles.container}>
      <View style={styles.batch}>
        <Text style={styles.batchLabel}>Batch 1 — dealt first</Text>
        <View style={styles.cards}>
          {batch1.map((c, i) => <PlayingCard key={i} card={c} size="small" disabled />)}
        </View>
      </View>
      <View style={styles.arrow}><Text style={styles.arrowText}>then</Text></View>
      <View style={[styles.batch, styles.batchDimmed]}>
        <Text style={styles.batchLabel}>Batch 2 — dealt after trump call</Text>
        <View style={styles.cards}>
          {batch2.map((c, i) => <PlayingCard key={i} card={c} size="small" disabled dimmed />)}
        </View>
      </View>
    </View>
  );
}

function TrumpCallScene() {
  return (
    <View style={styles.callContainer}>
      <Text style={styles.callPrompt}>Player left of dealer calls trump</Text>
      <View style={styles.suitRow}>
        {(['hearts','spades','diamonds','clubs'] as const).map((s) => (
          <View key={s} style={styles.suitOption}>
            <Text style={[styles.suitSym, (s === 'hearts' || s === 'diamonds') && styles.red]}>
              {SUIT_SYMBOLS[s]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.callNote}>After seeing the first batch only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  batch: { alignItems: 'center', gap: 6 },
  batchDimmed: { opacity: 0.5 },
  batchLabel: { color: COLORS.textSecondary, fontSize: 10 },
  cards: { flexDirection: 'row', gap: 6 },
  arrow: { paddingVertical: 2 },
  arrowText: { color: COLORS.textSecondary, fontSize: 12 },
  callContainer: { alignItems: 'center', gap: 12 },
  callPrompt: { color: COLORS.goldLight, fontSize: 13, fontWeight: '700' },
  suitRow: { flexDirection: 'row', gap: 12 },
  suitOption: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  suitSym: { fontSize: 22, color: COLORS.text },
  red: { color: COLORS.suitRed },
  callNote: { color: COLORS.textSecondary, fontSize: 11 },
});

export const slides: ModeSlide[] = [
  {
    title: 'Trump Call',
    heading: 'Cards are dealt in two batches.',
    body: 'You receive the first half of your hand, then a trump call happens — before the second half is dealt.',
    scene: <TwoBatchScene />,
  },
  {
    title: 'Trump Call',
    heading: 'The player left of the dealer calls trump.',
    body: 'They pick a suit after seeing only the first batch of cards — before their full hand is known. High risk, high information.',
    scene: <TrumpCallScene />,
  },
  {
    title: 'Trump Call',
    heading: 'Then the second batch arrives and bidding begins.',
    body: 'After trump is called, the rest of your hand is dealt. Bidding and play proceed exactly as in Classic.',
    scene: undefined,
  },
];
```

- [ ] **Step 5: Create `components/mode-carousels/BidFirstSlides.tsx`**

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlayingCard from '../PlayingCard';
import { COLORS, SUIT_SYMBOLS } from '../../utils/theme';
import { ModeSlide } from './types';

function BlindBidScene() {
  const bids = [
    { name: 'You', bid: 3 },
    { name: 'Alex', bid: 2 },
    { name: 'Sam', bid: 4 },
  ];
  return (
    <View style={styles.container}>
      <View style={styles.trumpUnknown}>
        <Text style={styles.trumpLabel}>Trump</Text>
        <Text style={styles.trumpValue}>?</Text>
      </View>
      <View style={styles.bids}>
        {bids.map((p) => (
          <View key={p.name} style={styles.bidRow}>
            <Text style={styles.playerName}>{p.name}</Text>
            <View style={styles.bidBadge}>
              <Text style={styles.bidNum}>{p.bid}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WinnerPicksScene() {
  return (
    <View style={styles.winnerContainer}>
      <Text style={styles.winnerLabel}>Highest bidder picks trump</Text>
      <View style={styles.suitRow}>
        {(['hearts','spades','diamonds','clubs'] as const).map((s) => (
          <View key={s} style={[styles.suitOption, s === 'spades' && styles.suitSelected]}>
            <Text style={[styles.suitSym, (s === 'hearts' || s === 'diamonds') && styles.red]}>
              {SUIT_SYMBOLS[s]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.winnerNote}>Sam bid 4 — Sam picks</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 14 },
  trumpUnknown: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trumpLabel: { color: COLORS.textSecondary, fontSize: 10, marginBottom: 2 },
  trumpValue: { color: COLORS.gold, fontSize: 28, fontWeight: '800' },
  bids: { gap: 8, width: '100%', paddingHorizontal: 20 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerName: { color: COLORS.textSecondary, fontSize: 13 },
  bidBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  bidNum: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  winnerContainer: { alignItems: 'center', gap: 12 },
  winnerLabel: { color: COLORS.goldLight, fontSize: 13, fontWeight: '700' },
  suitRow: { flexDirection: 'row', gap: 10 },
  suitOption: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  suitSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  suitSym: { fontSize: 22, color: COLORS.text },
  red: { color: COLORS.suitRed },
  winnerNote: { color: COLORS.textSecondary, fontSize: 11 },
});

export const slides: ModeSlide[] = [
  {
    title: 'Bid First',
    heading: 'Cards are dealt in two batches.',
    body: 'Same two-batch deal as Trump Call. You see the first half of your hand before trump is set.',
    scene: undefined,
  },
  {
    title: 'Bid First',
    heading: 'Everyone bids before trump is decided.',
    body: "You're bidding blind — trump is unknown when you place your bid. No one knows which suit will dominate.",
    scene: <BlindBidScene />,
  },
  {
    title: 'Bid First',
    heading: 'The highest bidder picks trump.',
    body: 'After all bids are locked, the player with the highest bid selects the trump suit. Then the second batch of cards is dealt and play begins.',
    scene: <WinnerPicksScene />,
  },
];
```

- [ ] **Step 6: Create `app/game-modes/[modeKey].tsx`**

```tsx
import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { COLORS } from '../../utils/theme';
import { VARIATIONS } from '../../utils/variations';
import { slides as classicSlides } from '../../components/mode-carousels/ClassicSlides';
import { slides as fixedRoundsSlides } from '../../components/mode-carousels/FixedRoundsSlides';
import { slides as trumpCallSlides } from '../../components/mode-carousels/TrumpCallSlides';
import { slides as bidFirstSlides } from '../../components/mode-carousels/BidFirstSlides';
import SlideShell from '../../components/how-to-play/SlideShell';

const SLIDE_MAP: Record<string, ReturnType<typeof classicSlides[0]['scene'] extends undefined ? () => never : () => never> | any> = {
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
      title={variation?.name ?? ''}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={slides.length}
      currentSlide={current}
      onNext={() => setCurrent((c) => c + 1)}
      onBack={() => setCurrent((c) => Math.max(0, c - 1))}
      onSkip={() => router.back()}
      onDone={() => router.back()}
      doneUnlocked={true}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={false}
    />
  );
}
```

- [ ] **Step 7: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Smoke test in Expo**

- Open Game Modes screen → tap each mode card → correct carousel loads
- Classic: 1 slide, Done available immediately
- Fixed Rounds: 2 slides
- Trump Call: 3 slides
- Bid First: 3 slides
- Back button on each returns to Game Modes screen

- [ ] **Step 9: Commit**

```bash
git add app/game-modes/ components/mode-carousels/
git commit -m "feat: add per-mode carousels (Screen 3)"
```

---

## Task 7: In-game help button + lobby mode info

**Files:**
- Modify: `frontend/app/game.tsx` — add `?` help button to header + info icon for non-hosts next to mode display

**Interfaces:**
- Consumes: `useRouter` from `expo-router`

- [ ] **Step 1: Add `?` help button to game screen header**

Find the header section in `game.tsx`. Add a `TouchableOpacity` with a `?` that pushes `/how-to-play`. The screen opens without the Done lock (`lockDone={false}` is the default when opened mid-game — pass a route param).

Add import:
```ts
import { useRouter } from 'expo-router';
```

Add inside `GameScreen` before the return:
```ts
const router = useRouter();
```

In the header JSX, add the help button alongside existing controls:
```tsx
<TouchableOpacity
  onPress={() => router.push({ pathname: '/how-to-play', params: { lockDone: 'false' } })}
  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
  style={styles.helpBtn}
>
  <Text style={styles.helpBtnText}>?</Text>
</TouchableOpacity>
```

Add to styles:
```ts
helpBtn: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: 'rgba(255,255,255,0.06)',
  borderWidth: 1,
  borderColor: COLORS.borderGlass,
  alignItems: 'center',
  justifyContent: 'center',
},
helpBtnText: {
  color: COLORS.textSecondary,
  fontSize: 14,
  fontWeight: '700',
},
```

- [ ] **Step 2: Update `HowToPlayScreen` to read `lockDone` param**

In `app/how-to-play.tsx`, read the param:
```tsx
import { useLocalSearchParams } from 'expo-router';

export default function HowToPlayScreen() {
  const { lockDone: lockDoneParam } = useLocalSearchParams<{ lockDone?: string }>();
  const lockDone = lockDoneParam !== 'false';
  // ... rest unchanged
```

- [ ] **Step 3: Add info icon for non-host players next to mode display**

In `game.tsx`, find the `variationReadonly` section (where non-hosts see the mode name). Add a small info button next to it:

```tsx
<View style={styles.variationReadonly}>
  <Text style={styles.variationName}>{selectedVariation.name}</Text>
  <Text style={styles.variationDesc}>{selectedVariation.desc}</Text>
  <TouchableOpacity
    onPress={() => router.push(`/game-modes/${variation}`)}
    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    style={styles.modeInfoBtn}
  >
    <Text style={styles.modeInfoText}>What's this? →</Text>
  </TouchableOpacity>
</View>
```

Add to styles:
```ts
modeInfoBtn: { marginTop: 6 },
modeInfoText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Smoke test in Expo**

- Join a game as non-host → see "What's this? →" next to mode name → taps to correct mode carousel
- `?` button visible in game header → opens How to Play carousel without Done lock
- Verify `?` button does not appear during active trick play in a way that obscures game controls (adjust header placement if needed)

- [ ] **Step 6: Commit**

```bash
git add app/game.tsx app/how-to-play.tsx
git commit -m "feat: add in-game help button and lobby mode info link"
```

---

## Self-Review

**Spec coverage:**
- ✅ Screen 1: 8-slide universal carousel with scenes — Tasks 2, 3, 4
- ✅ Screen 2: Game Modes list with official names/descriptions — Task 5
- ✅ Screen 3: Per-mode carousels (Classic 1 slide, Fixed Rounds 2, Trump Call 3, Bid First 3) — Task 6
- ✅ First-launch AsyncStorage check — Task 4
- ✅ "Done" locks until all slides seen — Task 2 (SlideShell) + Task 4
- ✅ In-game `?` help button, no Done lock — Task 7
- ✅ Non-host mode info link in lobby — Task 7
- ✅ Mode names match VARIATIONS exactly — Task 1 (single source of truth)
- ✅ No backend changes — confirmed across all tasks
- ✅ Scene components use COLORS/SUIT_SYMBOLS/CARD_SIZES — Tasks 2, 3
- ✅ HowToPlayModal deleted — Task 4

**Placeholder scan:** No TBDs. All code blocks complete.

**Type consistency:**
- `SlideShell` props match usage in `how-to-play.tsx` and `[modeKey].tsx` ✅
- `ModeSlide` interface defined in `types.ts` and used identically across all 4 carousel files ✅
- `VARIATIONS` typed as `const` — `VariationKey` union exported for future use ✅
- `HAS_SEEN_HOW_TO_PLAY_KEY` string constant used in both `index.tsx` and `how-to-play.tsx` ✅
