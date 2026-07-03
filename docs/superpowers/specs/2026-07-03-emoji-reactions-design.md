# Emoji Reactions & Phrases — Design

**Date:** 2026-07-03
**Status:** Approved pending user review
**Scope:** In-game emoji/phrase reactions broadcast to all players in a room.

## Problem

Players have no way to react or banter while playing. The game is social (3–7 players, usually friends), and moments like a stolen trick or a failed bid beg for a 😂 or an "Ouch 💀". Today that happens outside the app (WhatsApp), breaking flow.

## Solution Overview

A reaction tray on the game screen (and lobby) lets a player send one of a fixed set of emojis or short phrases. The reaction is broadcast over the existing room WebSocket and rendered on every player's screen as a floating emoji/phrase pill with the sender's name, fading out after ~2.5s. Nothing is persisted.

## Architecture

Approach chosen: **ephemeral WebSocket broadcast** — one new message type on the existing `/ws/{room_id}` socket. Rejected alternatives: storing reactions in game state (replaying stale reactions after reconnect is worse UX, more code) and a separate channel (overkill for a 7-player room).

### Backend (`backend/server.py`)

New client → server message:

```json
{ "action": "reaction", "reaction_id": "fire" }
```

- Server keeps a single allowlist `REACTIONS: dict[str, str]` mapping `reaction_id` → display string. Client sends only the id; the server never broadcasts client-supplied strings.
  - Emojis: `laugh` 😂, `cry` 😭, `fire` 🔥, `clap` 👏, `scream` 😱, `devil` 😈, `mind_blown` 🤯, `strong` 💪
  - Phrases: `nice_bid` "Nice bid!", `ouch` "Ouch 💀", `hurry` "Hurry up! ⏳", `gg` "GG 🃏"
- **Validation:** unknown `reaction_id` → drop silently (no error message; reactions must never generate error noise or touch game state).
- **Rate limit:** max 1 reaction per player per second, tracked as a per-player `last_reaction_at` timestamp on the connection/player object. Over-limit → drop silently.
- **Broadcast** to all connected players in the room (including sender, so the sender sees exactly what others see):

```json
{ "type": "reaction", "player_index": 2, "player_name": "Varun", "reaction_id": "fire", "display": "🔥", "kind": "emoji" }
```

`kind` is `"emoji"` or `"phrase"` so the client can style without re-deriving. Allowed in both `waiting` (lobby) and in-game phases.

### Frontend

Two new components plus wiring in `frontend/app/game.tsx`:

**`components/ReactionTray.tsx`**
- Trigger: round 44px 😊 button at the right end of the self dock row (left of the score), visible in all game phases. In the lobby, the same button sits next to the Copy/Share room-code buttons.
- Tapping opens a compact overlay strip **absolutely positioned above the self dock** (it must not push or reflow layout — important on small phones during 17-card rounds). Row 1: the 8 emojis. Row 2: the 4 phrase pills.
- One tap sends `{action: "reaction", reaction_id}` and closes the tray. Tapping outside closes without sending.
- Client-side throttle mirrors the server (button disabled ~1s after a send, with a subtle dim) so the limit feels intentional.

**`components/ReactionOverlay.tsx`**
- Listens for incoming `type: "reaction"` messages (game.tsx passes them down; overlay keeps a small local queue).
- Each reaction renders in the table area: the emoji (large, ~40px) or phrase pill, with the sender's name in a small label beneath. It rises ~80px and fades out over ~2.5s using React Native `Animated` (no new dependencies).
- Origin point: near the sender's seat position when derivable from `player_index`; otherwise from the bottom-center of the table area. Simultaneous reactions get random horizontal jitter (±30px) so they don't stack.
- Overlay is `pointerEvents="none"` — reactions can never block card taps.
- Cap of ~8 concurrently animating reactions; older ones are dropped first (protects perf on low-end phones).

### Hand-size interaction

`HandDisplay` scales cards to fit ≤2 rows of screen width, so large hands (up to 17 cards) grow the hand dock taller but never wider. The self dock is a separate row above it — the 😊 button never collides with cards. The tray overlays upward into the table area, unaffected by hand size.

## Error Handling

- Malformed/unknown/over-limit reaction messages: dropped silently server-side. Reactions never mutate game state, so they cannot break a hand in progress.
- Socket disconnected when sending: the send fails like any other action; no retry queue (reactions are ephemeral by definition).

## Out of Scope (YAGNI)

- Full emoji picker, custom text, reaction history/persistence, targeting a specific player, sounds/haptics on receive, reactions on the scoreboard screen.

## Testing

- **Backend unit tests:** allowlist validation (unknown id dropped), rate limit (second reaction within 1s dropped, allowed after), broadcast payload shape.
- **Frontend:** manual verification with two browser sessions — send from one, observe animation + name label on both; verify tray overlay doesn't shift layout during a 17-card round on a narrow viewport; verify taps pass through the overlay to cards mid-animation.
