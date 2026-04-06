# Judgement Card Game - PRD

## Overview
A real-time multiplayer Judgement card game app built with Expo React Native (frontend) and FastAPI with WebSockets (backend).

## Game Rules (Variation 1)
- **Players**: 3-7
- **Deck**: Standard 52-card deck
- **Trump Rotation**: Hearts → Spades → Diamonds → Clubs (fixed, cycling)
- **Rounds**: Start at max cards (52 / num_players), decrease by 1 each round down to 1
- **Bidding**: Players predict exact tricks they'll win. Dealer (last bidder) cannot bid a value that makes total bids = cards dealt
- **Playing**: Must follow suit. Can trump if void. Highest trump or highest lead suit card wins
- **Scoring**: Exact bid = bid × 10 pts. Miss = -(bid × 10). Zero bid: success = +25, fail = -25

## Architecture
- **Frontend**: Expo React Native (expo-router, WebSocket for real-time)
- **Backend**: FastAPI with WebSocket support
- **Game State**: In-memory (rooms dict in server)
- **Database**: MongoDB available but not used for game state

## Key Features
- Create/Join game rooms with 4-letter room codes
- Real-time lobby with player list
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
- `{action: "place_bid", bid: N}` - Place a bid
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
- `/app/backend/server.py` - FastAPI server with REST + WebSocket
- `/app/backend/game_engine.py` - Core game logic

### Frontend
- `/app/frontend/app/index.tsx` - Home screen (create/join room)
- `/app/frontend/app/game.tsx` - Main game screen (all phases)
- `/app/frontend/app/_layout.tsx` - Root layout
- `/app/frontend/components/PlayingCard.tsx` - Card UI component
- `/app/frontend/components/BiddingModal.tsx` - Bid selection overlay
- `/app/frontend/components/ScoreBoard.tsx` - Score display
- `/app/frontend/utils/theme.ts` - Design constants
