# Game Screen Responsive Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the game screen render consistently across phones of different widths, heights, and OS font-scale settings — no wrapped/clipped text, no cut-off hand cards, no emoji-substituted trump glyph.

**Architecture:** Six small, independent fixes to the React Native (Expo) frontend: cap OS font scaling, force text-presentation suit glyphs, make status pills a deterministic grid, prevent text wrap in player chips, use `react-native-safe-area-context` for Android bottom insets, and scale hand cards to fit the screen width instead of using fixed 52×74 px cards. No backend changes. No new dependencies (`react-native-safe-area-context ~5.6.0` is already installed).

**Tech Stack:** React Native 0.7x via Expo + expo-router, TypeScript. No jest is configured in this project — verification is `npx tsc --noEmit`, `yarn lint`, and on-device visual checks (Expo Go on the three test phones).

**Working directory for all commands:** `~/Desktop/Projects/judgement_app/frontend` (git repo root is `~/Desktop/Projects/judgement_app`).

**Evidence this plan is based on (screenshot `Feedback Shots/WhatsApp Image 2026-06-10 at 14.34.35.jpeg`):**
- Phone 3: status pills wrap 3+2+1 instead of 3+3; "Bid 2 Won 3" wraps mid-text in a player chip; "Player · Bid 7 / Won 0" clips against a box border.
- Phone 1: trump ♠ renders as an OEM emoji blob instead of a text glyph.
- Phones 2 & 3: bottom row of hand cards clipped at screen edge / under Android gesture nav.

---

### Task 1: Cap OS font scaling globally

Android user font-size settings inflate all `<Text>` by default (`allowFontScaling`), while containers stay fixed-size — this is the root cause of mid-text wrapping and clipping. Cap the multiplier at 1.2 so accessibility scaling still works but can't break layout.

**Files:**
- Modify: `frontend/app/_layout.tsx`

- [ ] **Step 1: Add default `maxFontSizeMultiplier` in the root layout**

In `frontend/app/_layout.tsx`, add the `Text`/`TextInput` imports and the two default assignments. The file currently starts:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
```

Change the top of the file to:

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, TextInput } from 'react-native';

// Cap OS font scaling so user font-size settings can't break fixed layouts.
// @ts-expect-error defaultProps is untyped on RN function components
Text.defaultProps = { ...(Text.defaultProps ?? {}), maxFontSizeMultiplier: 1.2 };
// @ts-expect-error defaultProps is untyped on RN function components
TextInput.defaultProps = { ...(TextInput.defaultProps ?? {}), maxFontSizeMultiplier: 1.2 };
```

Keep everything else in the file unchanged.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0, no errors. (If `@ts-expect-error` reports "unused directive", delete that directive line — it means the types allow `defaultProps` directly.)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/_layout.tsx
git commit -m "fix: cap OS font scaling at 1.2x to prevent layout breakage"
```

---

### Task 2: Force text presentation for suit glyphs

On some Android OEMs, `♠` is substituted with the colored emoji glyph (grey blob on the test phone). Appending U+FE0E (VARIATION SELECTOR-15) forces the plain text glyph everywhere the symbols render — status pill, cards, trump selection.

**Files:**
- Modify: `frontend/utils/theme.ts:28-33`

- [ ] **Step 1: Append `︎` to each suit symbol**

In `frontend/utils/theme.ts`, replace:

```ts
export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
};
```

with:

```ts
// ︎ = VARIATION SELECTOR-15: forces text presentation so OEM emoji
// fonts don't substitute colored emoji glyphs for the suit characters.
export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥︎',
  diamonds: '♦︎',
  spades: '♠︎',
  clubs: '♣︎',
};
```

- [ ] **Step 2: Check for other hardcoded suit literals**

Run: `grep -rn '♠\|♥\|♦\|♣' frontend/app frontend/components frontend/utils --include='*.tsx' --include='*.ts' | grep -v 'theme.ts'`
Expected: no output. If any file hardcodes a bare suit character in rendered text (not in a comment), replace it with the `SUIT_SYMBOLS` lookup instead.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/utils/theme.ts
git commit -m "fix: force text presentation for suit glyphs (prevent OEM emoji substitution)"
```

---

### Task 3: Make status pills a deterministic 3-column grid

Pills currently use `flexWrap` + `minWidth: 84`, so the number per row depends on device width — 3+3 on wide phones, 3+2+1 on narrow ones. Switching to percentage `flexBasis` makes it always 3 per row (2 rows of 3 for the 6 pills) on every device.

**Files:**
- Modify: `frontend/app/game.tsx` (`statusPill` style, around line 1224)

- [ ] **Step 1: Replace `minWidth` with percentage flex basis**

In `frontend/app/game.tsx`, find the `statusPill` style:

```ts
  statusPill: {
    minWidth: 84,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
```

Replace with:

```ts
  statusPill: {
    flexGrow: 1,
    flexBasis: '28%',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
```

Why 28%: the cluster (`statusCluster`, `flex: 1, flexWrap: 'wrap', gap: 8`) sits beside the Leave button. Three items at 28% basis + two 8px gaps always fit one row (3 × 28% = 84% + gaps < 100%), and `flexGrow: 1` stretches them to fill the row evenly. A fourth pill can't fit (4 × 28% = 112%), so the wrap point is fixed at 3 regardless of device width or font scale.

- [ ] **Step 2: Keep label text on one line**

In the `StatusPill` component (`frontend/app/game.tsx`, around line 977), the value `<Text>` already has `numberOfLines={1}`. Add the same to the label so "TOTAL BIDS" can never wrap:

```tsx
      <Text style={styles.statusPillLabel} numberOfLines={1}>{label}</Text>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "fix: status pills render as fixed 3-column grid on all screen widths"
```

---

### Task 4: Prevent text wrap/clip in opponent chips and self row

"Bid 4 Won 2" wraps to two lines inside the fixed-height (76px) opponent seats on narrow/font-scaled phones, and the self subtext ("Player · Bid 7 / Won 0") clips against the hand area. Single-line + auto-shrink fixes both without touching seat geometry.

**Files:**
- Modify: `frontend/app/game.tsx` (opponent seat JSX ~line 696, self row JSX ~line 793)

- [ ] **Step 1: Constrain the opponent body text**

In `frontend/app/game.tsx`, find (around line 696):

```tsx
                  <Text style={styles.opponentBody}>
                    {opp.has_bid || opp.bid !== null
                      ? `Bid ${opp.bid}  Won ${opp.tricks_won}`
                      : phase === 'bidding'
                        ? 'Waiting to bid'
                        : `Cards ${opp.card_count}`}
                  </Text>
```

Replace the opening tag line with:

```tsx
                  <Text style={styles.opponentBody} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
```

(`adjustsFontSizeToFit` shrinks the text up to 20% instead of wrapping when the seat is narrow.)

- [ ] **Step 2: Constrain the self subtext**

Find (around line 793):

```tsx
                <Text style={styles.selfSubtext}>
                  {gameState.dealer_index === your_index ? 'Dealer' : 'Player'}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? ` • Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : ' • No bid yet'}
                </Text>
```

Replace the opening tag line with:

```tsx
                <Text style={styles.selfSubtext} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
```

- [ ] **Step 3: Constrain the opponent score line**

Find (around line 693):

```tsx
                      <Text style={styles.opponentScore}>{opp.total_score} pts</Text>
```

Replace with:

```tsx
                      <Text style={styles.opponentScore} numberOfLines={1}>{opp.total_score} pts</Text>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "fix: single-line auto-shrinking text in player chips and self row"
```

---

### Task 5: Use safe-area-context so Android bottom inset is respected

`game.tsx` imports `SafeAreaView` from `react-native`, which only applies insets on iOS. On Android gesture-nav phones the hand cards sit under the navigation area. `react-native-safe-area-context` (~5.6.0, already in `package.json`) handles both platforms; expo-router already mounts its `SafeAreaProvider`.

**Files:**
- Modify: `frontend/app/game.tsx` (imports, lines ~8 and ~23)

- [ ] **Step 1: Swap the import**

In `frontend/app/game.tsx`, the react-native import block (starting line ~5) includes `SafeAreaView` (line 8). Remove `SafeAreaView,` from that block, and add a new import line after the react-native import:

```tsx
import { SafeAreaView } from 'react-native-safe-area-context';
```

No JSX changes needed — all five `<SafeAreaView style={styles.container}>` usages keep working; the library's component applies all edges (including bottom) by default.

- [ ] **Step 2: Verify no other screen has the same bug — report only**

Run: `grep -rn 'SafeAreaView' frontend/app frontend/components --include='*.tsx' | grep -v 'safe-area-context'`
Expected after the fix: no hits in `game.tsx`. If `index.tsx` or others still import the react-native one, note it in the final report — do NOT change files outside this plan's scope.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "fix: use safe-area-context SafeAreaView so Android bottom inset is respected"
```

---

### Task 6: Scale hand cards to fit the screen (no more clipped bottom row)

Hand cards are fixed 52×74 px (`CARD_SIZES.hand`) in a wrap grid, capped at `maxHeight: 210` with the scroll indicator hidden — on short/narrow screens the second row clips with no affordance. Fix: compute a per-device scale in `HandDisplay` so the hand always fits ≤2 rows within the screen width, and add a `scale` prop to `PlayingCard`.

**Files:**
- Modify: `frontend/components/PlayingCard.tsx`
- Modify: `frontend/components/HandDisplay.tsx`
- Modify: `frontend/app/game.tsx` (`trickTable` style, ~line 1336)

- [ ] **Step 1: Add a `scale` prop to PlayingCard**

In `frontend/components/PlayingCard.tsx`, the component reads its dimensions at lines 52–53:

```tsx
  const dims   = CARD_SIZES[size];
  const fonts  = FONT_SIZES[size];
```

First add `scale = 1` to the component's destructured props (alongside `size`, `cardStyle`, etc.) and `scale?: number;` to its props interface. Then replace the two lines above with:

```tsx
  const base  = CARD_SIZES[size];
  const baseF = FONT_SIZES[size];
  const dims  = { width: Math.round(base.width * scale), height: Math.round(base.height * scale) };
  const fonts = {
    rank:   Math.round(baseF.rank * scale),
    suit:   Math.round(baseF.suit * scale),
    center: Math.round(baseF.center * scale),
    pip:    Math.round(baseF.pip * scale),
  };
```

Everything downstream already reads `dims.width`/`dims.height`/`fonts.*`, so no other edits in this file. If any style in this file uses `CARD_SIZES[size]` directly rather than `dims`, switch it to `dims`.

- [ ] **Step 2: Compute the scale in HandDisplay**

Replace the full contents of `frontend/components/HandDisplay.tsx` with:

```tsx
// Scrollable hand grid — auto-scales cards so the hand always fits
// within the screen width in at most two rows.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import PlayingCard, { CardData } from './PlayingCard';
import { COLORS, CardStyle, CARD_SIZES } from '../utils/theme';

interface HandDisplayProps {
  hand: CardData[];
  /** Indices of cards the player is allowed to play. null = not your turn. */
  playableIndices?: Set<number> | null;
  onPlayCard?: (card: CardData, index: number) => void;
  phase?: string;
  cardStyle?: CardStyle;
  showLabel?: boolean;
}

const GAP = 6;
// Horizontal chrome around the grid: tableShell 12+12, handDock 8+8,
// container 12+12 = 64. Keep in sync with game.tsx if those paddings change.
const H_CHROME = 64;

/** Scale factor (≤1) so `count` cards fit in ≤2 rows of the available width. */
export function handCardScale(count: number, screenWidth: number): number {
  if (count <= 0) return 1;
  const perRow = count <= 7 ? count : Math.ceil(count / 2);
  const available = Math.max(160, screenWidth - H_CHROME) - (perRow - 1) * GAP;
  const fitWidth = Math.floor(available / perRow);
  return Math.min(1, fitWidth / CARD_SIZES.hand.width);
}

export default function HandDisplay({
  hand,
  playableIndices = null,
  onPlayCard,
  phase,
  cardStyle = 'minimal',
  showLabel = true,
}: HandDisplayProps) {
  const { width } = useWindowDimensions();
  const isPlayPhase = phase === 'playing';
  const scale = handCardScale(hand.length, width);

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          Your hand · {hand.length} card{hand.length !== 1 ? 's' : ''}
        </Text>
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {hand.map((card, i) => {
          const canPlay  = isPlayPhase && !!playableIndices?.has(i);
          const isDimmed = isPlayPhase && playableIndices != null && !playableIndices.has(i);

          return (
            <PlayingCard
              key={`${card.rank}-${card.suit}-${i}`}
              card={card}
              size="hand"
              scale={scale}
              cardStyle={cardStyle}
              highlighted={canPlay}
              dimmed={isDimmed}
              onPress={canPlay && onPlayCard ? () => onPlayCard(card, i) : undefined}
              disabled={!canPlay}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 2,
  },
  scroll: {
    maxHeight: 210,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 6,
  },
});
```

Note the two deliberate behavior changes from the old file: `size` is now always `"hand"` (the old `hand.length > 8 ? 'trick' : 'hand'` branch is replaced by continuous scaling), and `handCardScale` is exported for the sanity check below.

- [ ] **Step 3: Sanity-check the scale math without a test framework**

There is no jest in this project. Verify the pure function with node directly:

```bash
npx tsx -e "
import { handCardScale } from './components/HandDisplay';
const cases: [number, number][] = [[8, 360], [13, 360], [13, 412], [3, 320], [13, 780]];
for (const [n, w] of cases) {
  const s = handCardScale(n, w);
  console.log(\`n=\${n} w=\${w} scale=\${s.toFixed(2)} cardW=\${Math.round(52 * s)}\`);
  if (s <= 0 || s > 1) throw new Error('scale out of range');
}
console.log('OK');
"
```

Expected: prints 5 lines with `scale` between ~0.55 and 1.00, then `OK`. If `npx tsx` fails because importing the `.tsx` file pulls in react-native, skip this step and rely on Step 5's on-device check — do not install new packages to make it pass.

- [ ] **Step 4: Let the center stage compress before the hand**

In `frontend/app/game.tsx`, find the `trickTable` style (~line 1336):

```ts
  trickTable: {
    width: '100%',
    maxWidth: 420,
    minHeight: 210,
```

Change `minHeight: 210` to `minHeight: 160`. This gives the flex column 50px of slack on short screens so the trick area shrinks before the hand dock gets pushed off-screen.

- [ ] **Step 5: Typecheck and lint**

Run: `npx tsc --noEmit && yarn lint`
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/PlayingCard.tsx frontend/components/HandDisplay.tsx frontend/app/game.tsx
git commit -m "fix: scale hand cards to screen width so hand always fits without clipping"
```

---

### Task 7: On-device verification (all three phones)

**Files:** none (verification only)

- [ ] **Step 1: Check the LAN IP and update `.env`**

Per project convention, the Mac's DHCP IP changes between sessions. Run `ipconfig getifaddr en0` and make sure the backend URL in `frontend/.env` (or wherever the WS host is configured) matches before starting servers.

- [ ] **Step 2: Start backend and Expo**

```bash
cd ~/Desktop/Projects/judgement_app/backend && python server.py &
cd ~/Desktop/Projects/judgement_app/frontend && yarn start
```

- [ ] **Step 3: Run the visual checklist on each of the 3 test phones**

Join the same game from all three phones and verify during the playing phase:

| Check | Pass condition |
|---|---|
| Status pills | Exactly 3 per row (2 rows of 6) on every phone |
| Trump pill | Clean monochrome ♠ glyph on every phone, no emoji blob |
| Opponent chips | "Bid X Won Y" on one line, never wrapped or clipped |
| Self row | "Player · Bid X / Won Y" fully visible, not clipped by any border |
| Hand (8 cards) | All cards fully visible, nothing under the gesture nav bar |
| Hand (13 cards, round 1 of a 13-card variation) | Two rows, all visible, no scroll needed |
| Font-scale stress | On one Android phone, set system font size to largest → repeat the checks above; minor shrinkage OK, no wrap/clip/cutoff |

- [ ] **Step 4: Fix-forward or report**

If any check fails, do not improvise new layout strategies — record which check failed on which phone (screenshot), and report back. The likely knobs are: `flexBasis` percentage (Task 3), `minimumFontScale` (Task 4), `H_CHROME` constant (Task 6).

- [ ] **Step 5: Final commit if any tweaks were made, then report**

Report format: list each of the 5 root causes (font scale, emoji glyph, pill wrap, chip wrap, safe area, card clipping) with pass/fail per phone.

---

## Out of scope (do not do)

- Do not change `index.tsx`, the lobby, scoreboard, or modals — game screen only.
- Do not add jest or any new dependency.
- Do not restructure `game.tsx` (it is large; that is a separate refactor).
- Do not change colors, fonts, spacing, or any visual design beyond what the tasks specify.
- Backend untouched.
