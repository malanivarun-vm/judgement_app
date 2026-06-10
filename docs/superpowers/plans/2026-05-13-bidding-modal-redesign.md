# Bidding Modal Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the bidding phase so players can see their cards while choosing a bid — and make the bid number picker a horizontal swipe row that scales from 1 to 17 cards.

**Architecture:** All changes are confined to `BiddingModal.tsx` (main work) and a single line in `game.tsx`. `CardData` interface is exported from `PlayingCard.tsx` to be shared. No new dependencies, no backend changes.

**Tech Stack:** React Native 0.81, Expo 54, TypeScript 5.9, `expo-haptics`

**Spec:** `docs/superpowers/specs/2026-05-13-bidding-modal-redesign.md`

---

## File Map

| File | Change |
|---|---|
| `frontend/components/PlayingCard.tsx` | Export `CardData` interface (add `export` keyword) |
| `frontend/components/BiddingModal.tsx` | Add card display, swipe row, remove selected panel |
| `frontend/app/game.tsx` | Pass `yourHand` prop to `BiddingModal` |

---

## Task 1: Export `CardData` from `PlayingCard.tsx`

**Files:**
- Modify: `frontend/components/PlayingCard.tsx:12`

`CardData` is currently a module-private interface. `BiddingModal` needs to import it.

- [ ] **Step 1.1 — Add `export` to the `CardData` interface**

In `frontend/components/PlayingCard.tsx`, change line 12 from:

```ts
interface CardData {
  suit: string;
  rank: string;
}
```

to:

```ts
export interface CardData {
  suit: string;
  rank: string;
}
```

- [ ] **Step 1.2 — Verify TypeScript is happy**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.3 — Commit**

```bash
git -C /Users/varunmalani/Desktop/Projects/judgement_app add frontend/components/PlayingCard.tsx
git -C /Users/varunmalani/Desktop/Projects/judgement_app commit -m "feat: export CardData type from PlayingCard"
```

---

## Task 2: Add `yourHand` prop to `BiddingModal`

**Files:**
- Modify: `frontend/components/BiddingModal.tsx:1-22`

- [ ] **Step 2.1 — Add `ScrollView` to the react-native import and import `PlayingCard` + `CardData`**

Replace the top of `frontend/components/BiddingModal.tsx` (lines 1–12):

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  AccessibilityInfo,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';
import PlayingCard, { CardData } from './PlayingCard';
```

- [ ] **Step 2.2 — Add `yourHand` to the props interface and destructure it**

Replace lines 14–32 (the interface + function signature):

```tsx
interface BiddingModalProps {
  visible: boolean;
  yourHand: CardData[];
  cardsThisRound: number;
  trumpSuit: string;
  currentRound: number;
  totalRounds: number;
  restrictedBids: number[];
  onPlaceBid: (bid: number) => void;
}

export default function BiddingModal({
  visible,
  yourHand,
  cardsThisRound,
  trumpSuit,
  currentRound,
  totalRounds,
  restrictedBids,
  onPlaceBid,
}: BiddingModalProps) {
```

- [ ] **Step 2.3 — Type-check**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn tsc --noEmit
```

Expected: one new error — `game.tsx` missing the `yourHand` prop on `<BiddingModal>`. That's intentional; we fix it in Task 4.

- [ ] **Step 2.4 — Commit**

```bash
git -C /Users/varunmalani/Desktop/Projects/judgement_app add frontend/components/BiddingModal.tsx
git -C /Users/varunmalani/Desktop/Projects/judgement_app commit -m "feat: add yourHand prop to BiddingModal"
```

---

## Task 3: Add card display section inside the modal

**Files:**
- Modify: `frontend/components/BiddingModal.tsx` — JSX and styles

The card section goes **above** `<View style={styles.header}>` inside the modal body. Layout adapts: ≤9 cards → single row with `size="trick"` (44×62 px); 10–17 cards → wrapping row with `size="small"` (32×46 px).

- [ ] **Step 3.1 — Insert the card section JSX**

Inside the `return`, immediately after `<View style={styles.modal}>` (before `<View style={styles.header}>`), add:

```tsx
{/* Read-only hand reference */}
<View style={styles.cardSection}>
  <Text style={styles.cardSectionLabel}>
    {yourHand.length > 9
      ? `Your hand — ${yourHand.length} cards`
      : 'Your hand'}
  </Text>
  <View style={yourHand.length > 9 ? styles.cardWrap : styles.cardRow}>
    {yourHand.map((card, idx) => (
      <PlayingCard
        key={`${card.rank}-${card.suit}-${idx}`}
        card={card}
        size={yourHand.length > 9 ? 'small' : 'trick'}
        disabled
      />
    ))}
  </View>
</View>
<View style={styles.cardDivider} />
```

- [ ] **Step 3.2 — Add the new styles to the `StyleSheet.create` block**

Add these entries to the existing `styles` object (after the last existing entry):

```ts
  cardSection: {
    marginBottom: 10,
  },
  cardSectionLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardRow: {
    flexDirection: 'row',
    gap: 5,
  },
  cardWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.borderGlass,
    marginBottom: 14,
  },
```

- [ ] **Step 3.3 — Type-check**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn tsc --noEmit
```

Expected: same single error from Task 2.3 (missing `yourHand` in `game.tsx`). No new errors.

- [ ] **Step 3.4 — Commit**

```bash
git -C /Users/varunmalani/Desktop/Projects/judgement_app add frontend/components/BiddingModal.tsx
git -C /Users/varunmalani/Desktop/Projects/judgement_app commit -m "feat: add read-only hand display to bidding modal"
```

---

## Task 4: Replace bid grid with horizontal swipe row + remove selected panel

**Files:**
- Modify: `frontend/components/BiddingModal.tsx` — JSX and styles

Remove the `selectedPanel` block (the 42px gold number display) and replace the wrapping `bidGrid` View with a horizontal `ScrollView`.

- [ ] **Step 4.1 — Remove the `selectedPanel` JSX block**

Delete this entire block from the modal JSX (lines 99–109 in the original file — adjust for your current line numbers):

```tsx
<View style={styles.selectedPanel}>
  <Text style={styles.selectedLabel}>Selected bid</Text>
  <Text style={styles.selectedValue}>{selectedBid}</Text>
  <Text style={styles.selectedHint}>
    {isRestricted(selectedBid)
      ? 'This bid is restricted. Pick another.'
      : restrictedBids.length > 0
        ? `Dealer rule blocks: ${restrictedBids.join(', ')}`
        : 'Tap a number to lock it in.'}
  </Text>
</View>
```

- [ ] **Step 4.2 — Replace the `bidGrid` View with a horizontal ScrollView**

Delete this entire block:

```tsx
<View style={styles.bidGrid}>
  {bidOptions.map((bid) => {
    const restricted = isRestricted(bid);
    const selected = selectedBid === bid && !restricted;
    return (
      <TouchableOpacity
        key={bid}
        testID={`bid-button-${bid}`}
        style={[
          styles.bidButton,
          selected && styles.bidButtonSelected,
          restricted && styles.bidButtonRestricted,
        ]}
        onPress={() => void handleSelect(bid)}
        disabled={restricted}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.bidButtonText,
            selected && styles.bidButtonTextSelected,
            restricted && styles.bidButtonTextRestricted,
          ]}
        >
          {bid}
        </Text>
      </TouchableOpacity>
    );
  })}
</View>
```

Replace it with:

```tsx
<View style={styles.bidScrollWrapper}>
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.bidScrollContent}
  >
    {bidOptions.map((bid) => {
      const restricted = isRestricted(bid);
      const selected = selectedBid === bid && !restricted;
      return (
        <TouchableOpacity
          key={bid}
          testID={`bid-button-${bid}`}
          style={[
            styles.bidChip,
            selected && styles.bidChipSelected,
            restricted && styles.bidChipRestricted,
          ]}
          onPress={() => void handleSelect(bid)}
          disabled={restricted}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.bidChipText,
              selected && styles.bidChipTextSelected,
              restricted && styles.bidChipTextRestricted,
            ]}
          >
            {restricted ? `${bid}✕` : String(bid)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </ScrollView>
</View>
{cardsThisRound > 8 && (
  <Text style={styles.swipeHint}>swipe for more →</Text>
)}
```

- [ ] **Step 4.3 — Add new styles, remove old ones**

**Remove** these style entries entirely from the `StyleSheet.create` block:
`selectedPanel`, `selectedLabel`, `selectedValue`, `selectedHint`, `bidGrid`, `bidButton`, `bidButtonSelected`, `bidButtonRestricted`, `bidButtonText`, `bidButtonTextSelected`, `bidButtonTextRestricted`

**Add** these entries:

```ts
  bidScrollWrapper: {
    marginBottom: 4,
  },
  bidScrollContent: {
    gap: 6,
    paddingRight: 8,
  },
  bidChip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidChipSelected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  bidChipRestricted: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  bidChipText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  bidChipTextSelected: {
    color: '#000',
  },
  bidChipTextRestricted: {
    color: 'rgba(239,68,68,0.65)',
    fontSize: 12,
  },
  swipeHint: {
    color: COLORS.gold,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 12,
    opacity: 0.75,
  },
```

- [ ] **Step 4.4 — Type-check**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn tsc --noEmit
```

Expected: still only the one error from `game.tsx` missing `yourHand`.

- [ ] **Step 4.5 — Commit**

```bash
git -C /Users/varunmalani/Desktop/Projects/judgement_app add frontend/components/BiddingModal.tsx
git -C /Users/varunmalani/Desktop/Projects/judgement_app commit -m "feat: replace bid grid with swipe row, remove selected panel"
```

---

## Task 5: Wire up `game.tsx`

**Files:**
- Modify: `frontend/app/game.tsx:697–705`

- [ ] **Step 5.1 — Add `yourHand` prop to the `<BiddingModal>` usage**

Find the `<BiddingModal` block (around line 697) and add one line:

```tsx
<BiddingModal
  visible={showBiddingModal}
  yourHand={gameState.your_hand}
  cardsThisRound={gameState.cards_this_round}
  trumpSuit={gameState.trump_suit}
  currentRound={gameState.current_round}
  totalRounds={gameState.total_rounds}
  restrictedBids={gameState.restricted_bids || []}
  onPlaceBid={(bid) => void sendAction({ action: 'place_bid', bid }, 'medium')}
/>
```

- [ ] **Step 5.2 — Type-check — must be clean**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn tsc --noEmit
```

Expected: **zero errors**.

- [ ] **Step 5.3 — Lint — must be clean**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn lint
```

Expected: no warnings or errors.

- [ ] **Step 5.4 — Commit**

```bash
git -C /Users/varunmalani/Desktop/Projects/judgement_app add frontend/app/game.tsx
git -C /Users/varunmalani/Desktop/Projects/judgement_app commit -m "feat: pass yourHand to BiddingModal — fixes card visibility during bidding"
```

---

## Task 6: Manual Verification

No automated frontend tests exist in this project. Verify by running the app with Expo Go.

- [ ] **Step 6.1 — Get current LAN IP**

```bash
ipconfig getifaddr en0
```

Update `frontend/.env`:
```
EXPO_PUBLIC_BACKEND_URL=http://<ip-from-above>:8000
```

- [ ] **Step 6.2 — Start backend**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

- [ ] **Step 6.3 — Start frontend**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
yarn start
```

- [ ] **Step 6.4 — Test: 3 players (17-card round)**

1. Open Expo Go on 3 devices/simulators, join same room, start game
2. When bidding phase starts, confirm: player whose turn it is sees **all 17 cards** in a 2-row wrap layout inside the modal
3. Swipe the bid number row — confirm numbers 0–17 are all reachable
4. Confirm the restricted bid shows as red with ✕ and cannot be selected
5. Confirm "swipe for more →" hint is visible
6. Place a bid and confirm the game proceeds normally

- [ ] **Step 6.5 — Test: 7 players (7-card round)**

1. Join with 7 players, reach bidding phase
2. Confirm: single row of `trick`-size cards (no wrap), no swipe hint text
3. All 7 bid options (0–7) visible without scrolling (fits in row)
4. Restricted chip visible; all others selectable

- [ ] **Step 6.6 — Test: haptics and reduced motion**

1. Enable Reduce Motion in iOS Settings → Accessibility
2. Confirm modal still opens (no scale animation)
3. Confirm haptic fires on chip tap and on "Lock in"
