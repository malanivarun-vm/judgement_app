# Judgement App — Fable One-Shot Briefing

## What This Is

A real-time multiplayer card game app. Frontend: Expo React Native (expo-router). Backend: FastAPI + WebSockets. State is in-memory. No database.

Project lives at: `~/Desktop/Projects/judgement_app/`

---

## What's Already Built and Working

**V1 (Classic Decreasing) is complete end-to-end:**
- Home screen: create/join room with 4-letter codes (`frontend/app/index.tsx`)
- Lobby: player list, host starts game, reconnection support (`frontend/app/game.tsx`)
- Bidding phase: BiddingModal with swipe-row picker, read-only hand preview, dealer restriction enforcement
- Playing phase: full trick-taking with suit-following validation
- Round end: ScoreBoard with per-round history, host advances to next round
- Game over: final standings, play again option
- HowToPlayModal

**Key components:**
- `frontend/components/PlayingCard.tsx` — single card renderer, accepts `size` ('hand'|'trick'|'small'|'bid') and `cardStyle` ('minimal'|'pips'|'foil')
- `frontend/components/HandDisplay.tsx` — player's hand, uses size='hand' (≤8 cards) or size='trick' (>8 cards)
- `frontend/components/BiddingModal.tsx` — bid picker overlay, shows your hand read-only, enforces restricted bids
- `frontend/components/ScoreBoard.tsx` — round history table
- `frontend/utils/theme.ts` — all design constants (COLORS, CARD_SIZES, SUIT_SYMBOLS, etc.)

**Backend files:**
- `backend/server.py` — FastAPI server with REST + WebSocket, GameRoom class with all game state
- `backend/game_engine.py` — pure functions: shuffle_and_deal, get_trump_suit, determine_trick_winner, calculate_round_score, get_restricted_bids

---

## Design System

Dark casino aesthetic:
- Background: `#0A1C13` → `#1A4B33`
- Gold buttons: `#D4AF37`
- Text: `#FFFFFF` primary, `#A1A1AA` secondary
- Cards: white with red/black suit colors
- Glass surfaces: `rgba(255,255,255,0.05)` with `rgba(255,255,255,0.1)` borders

All styles use `StyleSheet.create`. No external CSS libraries. React Native only.

---

## What Needs to Be Built

### Feature 1: Lobby Variation Selector (frontend + backend)

**Where:** `frontend/app/game.tsx` — the `phase === 'waiting'` block (lines ~308–370)

**What:** After the player list and before the Start Game button, the host needs a UI to select which variation to play, plus configure variation-specific params.

Variations:
- **V1** — Classic Decreasing (default, no extra config)
- **V1.1** — Fixed Round Count. Host sets: cards per round (max=`floor(52/num_players)`), number of rounds (max=`floor(52/num_players)`)
- **V2** — Trump Selection (no extra config beyond standard)
- **V3** — Bid First, Trump by Winner. Host sets: cards per round, number of rounds (max=17)

Non-host players see the selected variation and params (read-only).

**Backend action to add:**
```
{action: "set_variation", variation: "v1"|"v1.1"|"v2"|"v3", config: {cards_per_round?: N, total_rounds?: N}}
```
Add this to the WebSocket handler in `server.py`. Store `room.variation` and `room.variation_config` on GameRoom. Send state broadcast after.

**State broadcast must include:** `variation` and `variation_config` so all players see them in the lobby.

---

### Feature 2: Backend — V1.1, V2, V3 Game Engine Support

**File:** `backend/server.py` (GameRoom class) and `backend/game_engine.py`

**V1.1 changes (GameRoom.start_game and _start_round):**
- Instead of `self.total_rounds = self.max_cards` and decreasing cards, use `self.total_rounds = variation_config.total_rounds` and `self.cards_this_round = variation_config.cards_per_round` (constant every round)
- Trump still uses `get_trump_suit(self.current_round)` (fixed rotation)

**V2 changes (new `_start_round` flow):**
- Deal first batch: `ceil(cards_this_round / 2)` cards to each player
- Set phase to `'trump_selection'` (new phase)
- `current_player_index` = player left of dealer = `(dealer_index + 1) % n`
- That player either: calls trump via `call_trump` action, OR blind-draws (sends `{action: "call_trump", suit: null}` or a special action, backend picks random suit from un-dealt cards)
- After trump is called: deal remaining cards, then set phase to `'bidding'`

**V3 changes (new `_start_round` flow):**
- Deal ALL cards in two batches (`ceil(cards/2)` then remainder)
- Set phase to `'bidding'` immediately (players bid with full hand)
- After last bid: set phase to `'trump_selection_v3'` (new phase)
- `current_player_index` = player with highest bid (ties → earliest in bidding order)
- That player sends `{action: "call_trump", suit: "hearts"|"spades"|"diamonds"|"clubs"}`
- After trump chosen: set phase to `'playing'`

**New game_engine.py function needed:**
```python
def shuffle_and_deal_partial(num_players: int, cards_per_player: int, batch_size: int) -> tuple[List[List[Dict]], List[Dict]]:
    """Returns (partial_hands, remaining_deck) where each hand has batch_size cards"""
```

**New WebSocket action:**
```
{action: "call_trump", suit: "hearts"|"spades"|"diamonds"|"clubs"}
```
Valid only when `phase == 'trump_selection'` (V2) or `phase == 'trump_selection_v3'` (V3), and only for the current player.

**get_state_for_player must include:** `variation`, `variation_config`, `trump_caller_index` (which player is calling trump)

---

### Feature 3: Frontend — Trump Selection UI (V2 and V3)

**Where:** `frontend/app/game.tsx` — new phase handler blocks

**V2 trump selection screen:** Shows between partial-deal and full deal. Only the trump caller sees a suit picker (4 suit buttons). Others see "Waiting for [name] to call trump". After selection, brief flash of "Trump: ♥ Hearts" then game proceeds to bidding.

**V3 trump selection screen:** Shows after all bids are locked. Highest bidder picks trump. Others see "Waiting for [name] to choose trump". After selection, display trump + proceed to playing.

**Suit picker UI:** 4 large buttons, one per suit, using SUIT_SYMBOLS and SUIT_DISPLAY_COLORS from theme. Full-screen modal overlay, same dark glass aesthetic.

---

### Feature 4: 7th Status Pill — Total Bids

**Where:** `frontend/app/game.tsx` — the `statusCluster` View (around line 516–521)

Currently has 5 StatusPill components. Add a 6th:
```tsx
<StatusPill label="Total Bids" value={`${totalBids}`} />
```
Where `totalBids = players.filter(p => p.has_bid).reduce((sum, p) => sum + (p.bid ?? 0), 0)`

This should display during both bidding and playing phases, showing aggregate bid count.

---

### Feature 5: Bid Lock Confirmation Animation

**Where:** `frontend/app/game.tsx` — between bidding phase ending and playing phase starting

**What:** When all bids are locked (phase transitions from 'bidding' to 'playing'), show a 2–3 second overlay/banner before revealing the playing UI. Display:
- "All bids locked!"
- Total bids: N
- "Tight game" (if total bids > cards_this_round) OR "Loose game" (if total bids ≤ cards_this_round) with a brief explanation

**Implementation approach:** Track previous phase in a ref. When phase changes from 'bidding' → 'playing', set a `showBidLock` state to true for 2.5 seconds. Animate in (fade + scale) using the existing Animated API pattern. Show it as an overlay on the game table using `StyleSheet.absoluteFillObject` with a semi-transparent dark background.

---

## Critical Architecture Notes

1. **WebSocket pattern:** All game actions go through `send({action: '...'})`. The server sends back full state via `broadcast_state()` after every action. Frontend receives `type: 'state'` messages and replaces all state.

2. **Phase flow:**
   - V1/V1.1: `waiting` → `bidding` → `playing` → `round_end` → (loop) → `game_over`
   - V2: `waiting` → `trump_selection` → `bidding` → `playing` → `round_end` → (loop) → `game_over`
   - V3: `waiting` → `bidding` → `trump_selection_v3` → `playing` → `round_end` → (loop) → `game_over`

3. **Dealer restriction:** Already implemented for all variations in `place_bid`. The last bidder in `bidding_order` cannot bid the amount that would make total = cards_this_round.

4. **get_state_for_player:** This is the single source of truth for what the frontend sees. Every new field must be added here AND to the GameState TypeScript interface in game.tsx.

5. **StyleSheet pattern:** Never inline styles — always add to the `styles = StyleSheet.create({...})` block at bottom of each file.

6. **No external state management.** useState only. Game state comes entirely from WebSocket messages.

---

## Current Git Status

Last commit: `c22082a fix: card clipping in BiddingModal and title overflow on narrow screens`

Backend has uncommitted changes (`backend/requirements.txt` and `backend/server.py` modified).

---

## What NOT to Touch

- `PlayingCard.tsx` — correct, don't modify
- `HandDisplay.tsx` — correct, don't modify  
- `ScoreBoard.tsx` — correct, don't modify
- `HowToPlayModal.tsx` — correct, don't modify
- `game_engine.py` functions: `is_valid_play`, `determine_trick_winner`, `calculate_round_score`, `get_restricted_bids` — all correct

---

## Files to Modify

1. `backend/game_engine.py` — add `shuffle_and_deal_partial`
2. `backend/server.py` — add `set_variation`, `call_trump` actions; add V1.1/V2/V3 branching in `start_game` and `_start_round`; add variation fields to GameRoom and `get_state_for_player`
3. `frontend/app/game.tsx` — add variation selector in lobby, trump selection screens, 7th status pill, bid lock animation, update GameState interface
4. `frontend/utils/theme.ts` — add any new design tokens if needed (likely none)

---

## Verification After Build

1. Two players in same room (or simulate via two browser tabs on web, or use the existing test infra)
2. V1: full game end-to-end (baseline, must not regress)
3. V1.1: host sets 5 cards/3 rounds, verify constant cards per round
4. V2: trump selection prompt appears for player left of dealer after partial deal
5. V3: bidding happens first, highest bidder gets trump selection prompt
6. 7th status pill visible showing total bids during bidding + playing
7. Bid lock animation fires when last bid submitted

Backend tests at `backend/tests/` — run to verify game engine.
