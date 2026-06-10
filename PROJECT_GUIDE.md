# Judgement App Project Guide

## Overview

Judgement App is a real-time multiplayer card game built as a split frontend/backend system:

- The frontend is an Expo React Native app in `frontend/`.
- The backend is a FastAPI + WebSocket game server in `backend/`.
- Supporting docs, design prototypes, and test reports live in sibling folders at the project root.

The app implements the Judgement / Oh Hell style trick-taking loop:

- Create or join a room with a 4-letter code.
- Wait in the lobby until the host starts the game.
- Bid clockwise with dealer restrictions enforced.
- Play tricks with suit-following rules.
- Score each round and show the recap.

## Top-Level Structure

```text
judgement_app/
├── README.md
├── Judgement Game Rules.docx
├── PROJECT_GUIDE.md
├── backend/
├── frontend/
├── design/
├── docs/
├── memory/
├── tests/
├── test_reports/
├── test_result.md
├── .claude/
├── .emergent/
├── .superpowers/
└── .git/
```

### What Each Root Folder Is For

- `backend/` contains the server, card game engine, and backend tests.
- `frontend/` contains the Expo app, UI components, theme tokens, and web/mobile entry points.
- `design/` contains the hi-fi UI prototype and related JSX assets.
- `memory/` contains product notes, PRD material, and competitive analysis.
- `tests/` is currently minimal at the repo root and mostly acts as a package marker.
- `test_reports/` stores test artifacts and result output.
- `.claude/`, `.emergent/`, and `.superpowers/` are tool/workflow metadata directories.

## System Architecture

### Runtime Flow

1. `frontend/app/index.tsx` collects the player name and room code.
2. The app calls the backend REST API to create or validate a room.
3. `frontend/app/game.tsx` opens a WebSocket connection to the room.
4. The backend keeps room state in memory and broadcasts state snapshots to every connected player.
5. The frontend renders the current phase: waiting, bidding, playing, round end, or game over.

### Key Architectural Choice

- The backend is stateful in memory, not database-backed.
- That keeps the implementation simple, but games are not persistent across server restarts.

## Dependencies

### Frontend Dependencies

The frontend uses Expo + React Native. Key dependencies from `frontend/package.json` include:

- `expo`, `expo-router`
- `react`, `react-dom`, `react-native`, `react-native-web`
- `@expo-google-fonts/dm-sans`, `@expo-google-fonts/jetbrains-mono`, `@expo-google-fonts/outfit`
- `expo-haptics`, `expo-blur`, `expo-font`, `expo-web-browser`, `expo-splash-screen`
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-safe-area-context`, `react-native-screens`
- `react-native-webview`
- `react-native-dotenv`

Dev tooling includes:

- `typescript`
- `eslint`
- `eslint-config-expo`
- `@babel/core`

### Backend Dependencies

The backend uses FastAPI and supporting Python libraries listed in `backend/requirements.txt`:

- `fastapi`
- `uvicorn[standard]`
- `python-dotenv`
- `pydantic`
- `python-jose`
- `bcrypt`
- `passlib`
- `pytest`
- plus support libs such as `requests`, `numpy`, `pandas`, `boto3`, `cryptography`, and others

### Tooling and Build Dependencies

- Expo uses `frontend/metro.config.js` for Metro caching and worker limits.
- Expo routes are configured via `frontend/app.json` and `expo-router`.
- TypeScript strictness is enforced by `frontend/tsconfig.json`.
- The backend uses pytest for API and WebSocket flow tests.

## Frontend Structure

### `frontend/app/index.tsx`

Purpose:

- Home screen for creating or joining rooms.
- Collects player name and room code.
- Calls the backend REST API to create rooms and verify existing rooms.
- Uses haptics and floating decorative animations.

Dependencies:

- `expo-router` for navigation
- `expo-haptics` for feedback
- `../utils/theme` for colors and suit symbols
- `../components/HowToPlayModal`
- Browser fetch against `EXPO_PUBLIC_BACKEND_URL`

Important behavior:

- `createRoom()` calls `POST /api/rooms`.
- `joinRoom()` calls `GET /api/rooms/{room_id}/exists`.
- It generates a local `player_id` before navigating into the game screen.

### `frontend/app/game.tsx`

Purpose:

- Main real-time gameplay screen.
- Manages the WebSocket connection, reconnection, trick animation, turn highlighting, and all phase-based rendering.

Dependencies:

- `expo-router` for route params and navigation
- `expo-haptics` for tactile feedback
- `react-native` primitives for layout and animation
- `../components/PlayingCard`
- `../components/BiddingModal`
- `../components/HandDisplay`
- `../components/ScoreBoard`
- `../utils/theme`

State handled here:

- WebSocket connection state
- Current game snapshot
- Trick completion display
- Reduce-motion preference
- Local animation values
- Reconnect timers

UI phases rendered here:

- `waiting` lobby
- `bidding`
- `playing`
- `round_end`
- `game_over`

WebSocket actions sent from here:

- `start_game`
- `place_bid`
- `play_card`
- `next_round`
- `new_game`

### `frontend/app/_layout.tsx`

Purpose:

- Defines the root Expo router layout.
- Loads custom Google fonts before rendering.
- Hides headers and applies a fade transition between screens.

Dependencies:

- `expo-router`
- `expo-status-bar`
- Google font packages from `@expo-google-fonts/*`

### `frontend/app/+html.tsx`

Purpose:

- Custom web HTML shell for Expo web output.
- Prevents unwanted body scrolling and keeps routed content fixed full-screen.

Dependencies:

- `expo-router/html`
- React types

### `frontend/app.json`

Purpose:

- Expo project metadata and runtime configuration.
- Sets app name, icon, splash, orientation, web output mode, and plugins.

Important settings:

- `expo-router` is enabled as a plugin.
- Web output is `static`.
- The app is portrait-only.

### `frontend/metro.config.js`

Purpose:

- Metro bundler configuration for Expo.
- Uses a stable on-disk cache store.
- Limits Metro workers to reduce resource pressure.

### `frontend/eslint.config.js`

Purpose:

- Applies Expo’s flat ESLint config.
- Ignores generated `dist/` output.

### `frontend/tsconfig.json`

Purpose:

- TypeScript compiler settings for the frontend.
- This is the static type-checking layer for the Expo app.

### `frontend/.env`

Purpose:

- Stores `EXPO_PUBLIC_BACKEND_URL`.
- The frontend uses this to decide which backend to call.

Note:

- The app depends on this value for both HTTP calls and WebSocket URL construction.

## Frontend Components

### `frontend/components/PlayingCard.tsx`

Purpose:

- Renders a single playing card.
- Supports three visual styles: `minimal`, `pips`, and `foil`.
- Handles press animation, highlight, dimming, and suit/color rendering.

Dependencies:

- `../utils/theme`
- `expo`/React Native animation primitives

Notes:

- This component is reused by the hand display, bidding modal, trick table, and score-related UI.

### `frontend/components/BiddingModal.tsx`

Purpose:

- Full-screen bidding overlay.
- Shows the player hand, round context, trump suit, and a large bid picker.
- Enforces restricted bids visually and interactively.

Dependencies:

- `../utils/theme`
- `./PlayingCard`
- `expo-haptics`

Notes:

- The modal is used only in the bidding phase when it is the local player’s turn.
- It already reflects the dealer restriction through `restrictedBids`.

### `frontend/components/HandDisplay.tsx`

Purpose:

- Scrollable hand renderer for the player’s cards.
- Auto-switches card size depending on hand length.
- Marks playable cards as highlighted and non-playable cards as dimmed.

Dependencies:

- `./PlayingCard`
- `../utils/theme`

### `frontend/components/HowToPlayModal.tsx`

Purpose:

- In-app rules reference.
- Explains card play, trump rotation, bidding, round flow, and scoring.

Dependencies:

- `../utils/theme`

### `frontend/components/ScoreBoard.tsx`

Purpose:

- Round recap and final standings component.
- Shows per-player bids, tricks won, round points, total score, and historical round summaries.

Dependencies:

- `../utils/theme`

## Frontend Theme

### `frontend/utils/theme.ts`

Purpose:

- Central color, suit, card size, and font token definitions.
- Provides the visual system used across the entire app.

Important exports:

- `COLORS`
- `SUIT_SYMBOLS`
- `SUIT_COLORS`
- `SUIT_DISPLAY_COLORS`
- `CARD_SIZES`
- `CardStyle`
- `FONTS`

## Backend Structure

### `backend/server.py`

Purpose:

- FastAPI app entry point.
- Exposes REST endpoints for room creation and room lookup.
- Hosts the WebSocket endpoint for live multiplayer state sync.
- Owns the in-memory `rooms` registry and `GameRoom` state machine.

Dependencies:

- `fastapi`
- `starlette.middleware.cors`
- `python-dotenv`
- `logging`, `json`, `uuid`, `random`, `string`, `pathlib`
- `game_engine.py`

Core responsibilities:

- Create and validate rooms.
- Accept player WebSocket connections.
- Track lobby state, bidding state, playing state, round end, and game over.
- Broadcast full state snapshots to each connected player.

Important room state fields:

- `players`
- `connections`
- `phase`
- `current_round`
- `cards_this_round`
- `trump_suit`
- `dealer_index`
- `current_player_index`
- `current_trick`
- `tricks_played`
- `round_history`
- `restricted_bids`
- `last_completed_trick`

Important WebSocket actions:

- `start_game`
- `place_bid`
- `play_card`
- `next_round`
- `new_game`

### `backend/game_engine.py`

Purpose:

- Pure game-logic module for card and scoring rules.
- Contains deck creation, dealing, trump rotation, follow-suit validation, trick winner selection, scoring, and dealer restriction logic.

Dependencies:

- Python `random`
- Standard typing helpers

Important exports:

- `create_deck()`
- `shuffle_and_deal()`
- `get_trump_suit()`
- `get_max_cards()`
- `is_valid_play()`
- `determine_trick_winner()`
- `calculate_round_score()`
- `get_restricted_bids()`

### `backend/requirements.txt`

Purpose:

- Pins and declares backend runtime and testing dependencies.

Notes:

- The file includes more than the game server strictly needs because the repo appears to have been scaffolded with a broader backend toolkit.
- The practical runtime dependencies for this app are the FastAPI/WebSocket stack and the auth/env helpers.

### `backend/tests/`

Purpose:

- Verifies engine rules, API behavior, and WebSocket game flow.

Files:

- `conftest.py` provides a shared requests session fixture.
- `test_api.py` checks room creation and room existence endpoints.
- `test_game_engine.py` checks dealing, trump rotation, max cards, follow-suit, trick resolution, scoring, and restricted bids.
- `test_websocket_game.py` checks lobby joins, game start, bidding flow, invalid bid errors, and room capacity limits.

## Test Coverage Summary

### Backend Tests

- Room creation returns a valid 4-letter uppercase code.
- Room existence checks are case-insensitive.
- Game engine functions behave deterministically enough for rules validation.
- WebSocket flows cover lobby sync and start-game transitions.

### Frontend Validation

- The frontend relies on Expo runtime behavior rather than a large local test suite.
- The key correctness surface is the game state contract returned by the backend.

## Design And Product Docs

### `design/`

Purpose:

- Stores the UI prototype and visual exploration assets.

Key files:

- `Judgement UI v2.html` is the browser-based high-fidelity prototype.
- `card-v2.jsx` defines the card component styling variants.
- `game-v2.jsx` defines the main game table prototype.
- `screens-v2.jsx` contains the individual screen mockups.
- `tweaks-panel.jsx` adds an in-browser design tweaking panel.
- `README.md` explains how to open and use the prototype.

### `memory/`

Purpose:

- Houses product strategy and game design notes.

Key files:

- `PRD.md` describes the game rules, variations, architecture, and intended feature set.
- `competitive-analysis.md` compares the app against direct and indirect competitors.

### `Judgement Game Rules.docx`

Purpose:

- Reference rules document for the game variant being implemented.

## Test Output And Artifacts

### `test_reports/`

Purpose:

- Stores generated test result artifacts.

Examples:

- `iteration_1.json`
- `pytest/pytest_results.xml`

### `test_result.md`

Purpose:

- Human-readable test result summary.

## What Depends On What

### Backend Dependency Chain

- `server.py` depends on `game_engine.py`
- `game_engine.py` is the rule engine and does not depend on the server
- `backend/tests/` depend on both the server and engine behavior

### Frontend Dependency Chain

- `app/index.tsx` feeds into `app/game.tsx`
- `app/game.tsx` depends on the UI components and theme
- `components/` depend on `utils/theme.ts`
- `PlayingCard.tsx` is the base visual unit used by `HandDisplay`, `BiddingModal`, and `ScoreBoard`
- `app/_layout.tsx` sets up the routing and font loading used by all screens

### Cross-App Dependency Chain

- The frontend depends on the backend API contract and WebSocket message schema
- The backend emits the full game snapshot consumed by the frontend’s `GameState` shape
- The frontend and backend must stay in sync on:
  - room lifecycle
  - bidding restrictions
  - card play validation
  - round transitions
  - final standings

## Operational Notes

- The backend keeps rooms in memory, so a restart clears active games.
- The frontend reads `EXPO_PUBLIC_BACKEND_URL` at runtime; if this is wrong, room creation and WebSocket joins fail.
- The WebSocket connection includes player identity in the URL query string, so reconnection depends on keeping `player_id` stable.
- The project uses mobile-first UI patterns, but web support is present through Expo web and `app/+html.tsx`.

