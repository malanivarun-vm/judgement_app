# Bidding Modal Redesign — Spec

**Date:** 2026-05-13  
**Status:** Approved  

---

## Problem

During the bidding phase, the player whose turn it is cannot see their cards. The `BiddingModal` renders as a full-screen centred overlay with a dark backdrop (`rgba(3,10,7,0.78)`), obscuring the hand dock at the bottom of `game.tsx`. Players need to see their cards to make an informed bid.

Secondary problem: with 3 players, `floor(52/3) = 17` cards are dealt in round 1. The current wrapping bid grid overflows the modal at high card counts, and 18 bid options (0–17) cannot fit in a fixed grid.

---

## Design

### 1 — Card display inside the modal

A read-only "Your hand" section is added at the top of the modal, above the existing header.

**Adaptive layout based on `cardsThisRound`:**

| Cards | Layout | `PlayingCard` size prop | Dimensions |
|---|---|---|---|
| 1–9 | Single horizontal `View` row | `size="trick"` | 44×62 px |
| 10–17 | `flexWrap: 'wrap'` container, `gap: 3` | `size="small"` | 32×46 px |

Threshold: `yourHand.length > 9`.

**Why `flexWrap` not a fixed 9-column grid:** The modal inner width is 340px (maxWidth 380 − padding 40). Nine 32px cards + 8×3px gaps = 312px — fits on standard phones. On narrower screens, cards flow into a third row automatically with no overflow.

Cards render with `disabled={true}` and no `onPress` — display only, no interaction, no highlighted/dimmed state. Reuses the existing `PlayingCard` component unchanged.

Section heading uses existing `selectedLabel` style: `COLORS.textSecondary`, `fontSize: 11`, `fontWeight: 800`, `letterSpacing: 1.4`, uppercase.

### 2 — Swipe row for bid numbers

Replace the wrapping `bidGrid` (`View` + `flexWrap`) with a horizontal `ScrollView`.

**Chip specs — match existing bid button design language exactly:**

| State | Background | Border | Text |
|---|---|---|---|
| Normal | `rgba(255,255,255,0.08)` | `COLORS.borderGlass` | `COLORS.text` |
| Selected | `COLORS.gold` | `COLORS.gold` + gold shadow glow | `#000` |
| Restricted | `rgba(239,68,68,0.14)` | `rgba(239,68,68,0.3)` | `rgba(239,68,68,0.65)` |

Chip size: **38×38 px**, `borderRadius: 12`, `gap: 6`. Restricted chips show a `✕` suffix on the label and remain non-tappable (`onPress` no-ops or `disabled`).

Right-edge fade: `View` with `LinearGradient` (or solid `rgba`) from transparent → `COLORS.surfaceSolid` (`#0F2B1D`), width 32 px, absolute positioned.

Swipe hint text (`"swipe for N–M →"`) renders only when `cardsThisRound > 8`. Uses `COLORS.gold`, `fontSize: 12`, right-aligned, below the scroll row.

Haptic feedback (`Haptics.selectionAsync()`) fires on chip selection — unchanged from current behaviour.

### 3 — Remove the "Selected bid" panel

The existing `selectedPanel` block (42 px gold number + hint text) is removed. The gold chip in the swipe row provides the same selected-state feedback. Removing it keeps the modal height manageable on smaller phones.

### 4 — Confirm button

Unchanged — `"Lock in {selectedBid}"`, gold pill, gold glow shadow.

---

## Files Changed

### `frontend/components/BiddingModal.tsx`

1. **Import** `ScrollView` from `react-native`, `PlayingCard` from `./PlayingCard`
2. **Add** `yourHand: CardData[]` prop (and re-export `CardData` type or import from PlayingCard)
3. **Add** card display section before the `<View style={styles.header}>`:
   - Section label
   - `yourHand.length > 9` → 9-column `View` grid with `size="small"` cards
   - `yourHand.length ≤ 9` → horizontal `View` row with `size="trick"` cards
4. **Replace** `<View style={styles.bidGrid}>` with `<ScrollView horizontal showsHorizontalScrollIndicator={false}>`
5. **Remove** `selectedPanel`, `selectedLabel`, `selectedValue`, `selectedHint` styles and JSX
6. **Add** fade overlay `View` (absolute, right edge of swipe row)
7. **Add** conditional swipe hint `Text` below scroll row
8. **Update** chip size in styles: `38×38` instead of `54×54`

**Props interface:**
```ts
interface BiddingModalProps {
  visible: boolean;
  yourHand: CardData[];          // NEW
  cardsThisRound: number;
  trumpSuit: string;
  currentRound: number;
  totalRounds: number;
  restrictedBids: number[];
  onPlaceBid: (bid: number) => void;
}
```

### `frontend/app/game.tsx`

One line — pass `yourHand` to `BiddingModal`:

```tsx
<BiddingModal
  visible={showBiddingModal}
  yourHand={gameState.your_hand}    // ADD
  cardsThisRound={gameState.cards_this_round}
  trumpSuit={gameState.trump_suit}
  currentRound={gameState.current_round}
  totalRounds={gameState.total_rounds}
  restrictedBids={gameState.restricted_bids || []}
  onPlaceBid={(bid) => void sendAction({ action: 'place_bid', bid }, 'medium')}
/>
```

---

## Design Token Reference

All values from `frontend/utils/theme.ts` and existing `BiddingModal` styles — no new colors introduced.

| Token | Value | Usage |
|---|---|---|
| `COLORS.surfaceSolid` | `#0F2B1D` | Modal background + fade gradient end |
| `COLORS.borderAccent` | `rgba(243,229,171,0.3)` | Modal border |
| `COLORS.gold` | `#D4AF37` | Selected chip, kicker, swipe hint, confirm button |
| `COLORS.goldLight` | `#F3E5AB` | Modal title |
| `COLORS.textSecondary` | `#A1A1AA` | Section label, meta chip text |
| `COLORS.borderGlass` | `rgba(255,255,255,0.1)` | Normal chip border |
| `COLORS.cardBg` | `#FAFAFA` | Card background (via PlayingCard) |
| `COLORS.suitRed` | `#E63946` | Red suit color (via PlayingCard) |

---

## Behaviour Unchanged

- Backend, WebSocket, game engine: no changes
- Restricted bid enforcement: server-side, unchanged
- Modal visibility (`phase === 'bidding' && isMyTurn`): unchanged
- Haptic feedback on selection and confirm: unchanged
- Reduce-motion support: unchanged
- `testID` attributes on chips: keep existing `bid-button-{n}` pattern

---

## Verification

1. Start backend: `uvicorn[standard] server:app --host 0.0.0.0 --port 8000 --reload` in `backend/`
2. Start frontend: `yarn start` in `frontend/`
3. Open three Expo Go clients, create a room, join all three, start game
4. Reach the bidding phase — confirm the bidding player sees their cards inside the modal
5. Confirm chips 0–N are all reachable by swiping; restricted chip is red with ✕
6. Confirm "swipe for N–M →" hint appears only when `cardsThisRound > 8`
7. Test with 3 players (17 cards, round 1): confirm 2-row 9-column grid renders
8. Test with 7 players (7 cards): confirm single row renders, no swipe hint
9. Confirm haptic fires on chip selection and on confirm
10. Run `yarn lint` in `frontend/` — must pass clean
