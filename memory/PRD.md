# Judgement Card Game - PRD

## Overview
A real-time multiplayer Judgement card game app built with Expo React Native (frontend) and FastAPI with WebSockets (backend). Supports 3–7 players across four game variations, selectable by the host after room creation.

---

## Universal Rules (All Variations)

- **Players**: 3–7
- **Deck**: Standard 52-card deck
- **Card ranking**: A (high) → 2 (low)
- **Leftover cards**: When `52 mod num_players ≠ 0`, randomly selected 2s are removed to make the deck evenly divisible. Set aside, not visible.
- **Dealing**: One card at a time per player per round (except V2 and V3 — see below)
- **Trick start**: First trick led by player left of dealer; subsequent tricks led by winner of previous trick
- **Suit following**: Must follow lead suit if possible. If void, may play trump or discard any card
- **Trick winner**: Highest trump wins if any trumps played; otherwise highest card of lead suit
- **Bidding order**: Clockwise starting left of dealer
- **Dealer forced bid**: If all other players' bids sum to exactly the number of cards dealt, dealer must bid 1 (cannot make total bids = cards dealt)
- **Tight/Loose**: Total bids ≠ cards dealt (enforced via dealer restriction above)
- **Scoring** (same across all variations):
  - Exact bid → `bid × 10` pts
  - Missed bid → `-(bid × 10)` pts
  - Zero bid success (0 tricks taken) → `+25` pts
  - Zero bid failure (any tricks taken) → `-25` pts
- **Running total** displayed throughout; final standings at game end

---

## Variations

### Variation 1 — Classic Decreasing
The standard game. Cards dealt decrease each round until 1-card rounds.

| Setting | Value |
|---|---|
| Cards dealt | Starts at `floor(52 / num_players)`, decreases by 1 each round down to 1 |
| Total rounds | `floor(52 / num_players)` |
| Trump | Fixed rotation: Hearts → Spades → Diamonds → Clubs (cycles) |
| Deal method | One card at a time |

---

### Variation 1.1 — Fixed Round Count
Same rules as V1 but with a constant card count per round and configurable number of rounds.

| Setting | Value |
|---|---|
| Cards per round | Constant — set by host at game start (e.g. 10) |
| Total rounds | Host configurable; max = `floor(52 / num_players)` |
| Trump | Fixed rotation: Hearts → Spades → Diamonds → Clubs (cycles) |
| Deal method | One card at a time |

**Host configures before game starts:** cards per round (max = `floor(52 / num_players)`), number of rounds (max = `floor(52 / num_players)`).

---

### Variation 2 — Trump Selection by Left-of-Dealer
Trump is not pre-determined. The player left of the dealer calls it after seeing half their hand.

| Setting | Value |
|---|---|
| Cards dealt | Starts at `floor(52 / num_players)`, decreases by 1 each round down to 1 |
| Total rounds | `floor(52 / num_players)` |
| Trump | Called by player left of dealer after seeing first half of their hand |
| Deal method | Two batches: `ceil(cards / 2)` first, then remainder |

**Trump selection process (each round):**
1. Deal first batch (`ceil(cards_this_round / 2)`) to all players one at a time
2. Player left of dealer looks at their partial hand
3. They call the trump suit — or, if undecided, blind-draw one card from the remaining undealt cards; that card's suit becomes trump
4. Deal remaining cards to all players
5. Bidding and play proceed normally

---

### Variation 3 — Bid First, Trump Chosen by Winner
Players bid before trump is decided. The highest bidder earns the right to choose trump.

| Setting | Value |
|---|---|
| Cards per round | Constant — set by host at game start |
| Total rounds | Host configurable; max = 17 |
| Trump | Chosen by highest bidder after all bids are locked |
| Deal method | Two batches: `ceil(cards / 2)` first, then remainder |

**Round flow:**
1. Deal all cards in two batches (`ceil(cards / 2)` then remainder)
2. Players see their full hand before bidding
3. Bidding proceeds clockwise (left of dealer); bids are public
4. Dealer forced bid applies
5. After all bids are locked, highest bidder chooses trump suit
6. Tie in bids → first player who bid that amount (earliest in clockwise order) chooses
7. No bid changes after trump is selected
8. Play proceeds as normal

---

## Variation Selection

- Host selects the variation **after room creation, before starting the game**
- Host also sets any variation-specific parameters (cards per round, number of rounds for V1.1 and V3)
- All other players see the selected variation and settings in the lobby
- Variation cannot be changed after the game starts

---

## Card Distribution & Rounding

| Players | Max cards/round | Cards used | 2s removed |
|---------|----------------|------------|------------|
| 3 | 17 | 51 | 1 |
| 4 | 13 | 52 | 0 |
| 5 | 10 | 50 | 2 |
| 6 | 8 | 48 | 4 |
| 7 | 7 | 49 | 3 |

Removed 2s are selected randomly and set aside before the deck is shuffled. Not visible to players.

---

## Architecture
- **Frontend**: Expo React Native (expo-router, WebSocket for real-time)
- **Backend**: FastAPI with WebSocket support
- **Game State**: In-memory (rooms dict in server)
- **Database**: None currently — games do not persist across server restarts

## Key Features
- Create/Join game rooms with 4-letter room codes
- Real-time lobby with player list and variation display
- Host selects game variation and parameters in lobby
- Bidding phase with dealer restriction enforcement
- Trick-taking gameplay with suit-following validation
- Round-end scoreboard with per-round history
- Game-over final standings with play again option
- Reconnection support for dropped WebSocket connections

## API Endpoints
- `POST /api/rooms` - Create a new game room
- `GET /api/rooms/{room_id}/exists` - Check if room exists and is joinable
- `WS /api/ws/{room_id}?player_name=&player_id=&is_host=` - WebSocket game connection

## WebSocket Actions (Client → Server)
- `{action: "start_game"}` - Host starts the game
- `{action: "set_variation", variation: "v1"|"v1.1"|"v2"|"v3", config: {...}}` - Host sets game variation and parameters
- `{action: "place_bid", bid: N}` - Place a bid
- `{action: "call_trump", suit: "hearts"|"spades"|"diamonds"|"clubs"}` - V2/V3: call trump suit
- `{action: "play_card", card: {suit, rank}}` - Play a card
- `{action: "next_round"}` - Advance to next round
- `{action: "new_game"}` - Start a new game (host)

## Design
- Dark green felt background (#0A1C13 → #1A4B33)
- Gold accent buttons (#D4AF37)
- Glass surface cards with border effects
- White playing cards with red/black suit colors
- Modern minimal with casino elegance

## File Structure
### Backend
- `/backend/server.py` - FastAPI server with REST + WebSocket
- `/backend/game_engine.py` - Core game logic

### Frontend
- `/frontend/app/index.tsx` - Home screen (create/join room)
- `/frontend/app/game.tsx` - Main game screen (all phases)
- `/frontend/app/_layout.tsx` - Root layout
- `/frontend/components/PlayingCard.tsx` - Card UI component
- `/frontend/components/BiddingModal.tsx` - Bid selection overlay
- `/frontend/components/ScoreBoard.tsx` - Score display
- `/frontend/utils/theme.ts` - Design constants
