# Emoji Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let players send emoji/phrase reactions during a game (and in the lobby), broadcast over the existing room WebSocket and rendered as floating, fading overlays on every player's screen.

**Architecture:** One new WebSocket action `reaction` handled in `backend/server.py` — server-side allowlist + 1s/player rate limit, broadcast `{type: "reaction", ...}` to the room, never touching game state. Frontend adds a `ReactionTray` (trigger button + popover) and a `ReactionOverlay` (animated, non-interactive floating reactions), wired into `frontend/app/game.tsx`.

**Tech Stack:** FastAPI WebSockets (existing), pytest (backend tests, in `backend/venv`), Expo / React Native with `Animated` (no new dependencies).

**Spec:** `docs/superpowers/specs/2026-07-03-emoji-reactions-design.md`

## Global Constraints

- Reaction IDs and display strings come ONLY from the server-side allowlist; the server never broadcasts client-supplied strings.
- Rate limit: max 1 reaction per player per second; over-limit and unknown IDs are dropped silently (no error message).
- Reactions never mutate game state and never trigger a `broadcast_state()`.
- Reactions are allowed in every phase, including `waiting` (lobby).
- Overlay must be `pointerEvents="none"` and cap at 8 concurrently animating reactions.
- The tray must overlay (absolute/modal), never push or reflow layout.
- No new runtime dependencies.
- Emoji set: 😂 😭 🔥 👏 😱 😈 🤯 💪. Phrases: "Nice bid!", "Ouch 💀", "Hurry up! ⏳", "GG 🃏".

---

### Task 1: Backend — reaction allowlist, rate limit, broadcast

**Files:**
- Modify: `backend/server.py` (allowlist near top constants ~line 20; `GameRoom.__init__` ~line 38; new methods after `broadcast_state` ~line 127; WS handler new `elif` after the `force_action` branch ~line 561)
- Test: `backend/tests/test_reactions.py` (create)

**Interfaces:**
- Produces: WS client→server message `{"action": "reaction", "reaction_id": "<id>"}`; server→all-clients broadcast `{"type": "reaction", "player_index": int, "player_name": str, "reaction_id": str, "display": str, "kind": "emoji"|"phrase"}`. Task 2/3 rely on these exact field names.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_reactions.py`:

```python
"""Tests for GameRoom.handle_reaction — allowlist, rate limit, payload shape."""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server import GameRoom, REACTIONS, REACTION_COOLDOWN_SECONDS


def make_room():
    room = GameRoom('TEST')
    for pid, name in [('p1', 'Alice'), ('p2', 'Bob')]:
        room.players.append({
            'id': pid, 'name': name, 'is_host': pid == 'p1',
            'hand': [], 'bid': None, 'has_bid': False, 'tricks_won': 0,
            'total_score': 0, 'is_connected': True, 'offline_since': None,
        })
    return room


def test_allowlist_contains_all_twelve_reactions():
    assert len(REACTIONS) == 12
    assert REACTIONS['fire'] == {'display': '🔥', 'kind': 'emoji'}
    assert REACTIONS['nice_bid'] == {'display': 'Nice bid!', 'kind': 'phrase'}


def test_valid_reaction_returns_broadcast_payload():
    room = make_room()
    payload = room.handle_reaction('p2', 'fire', now=100.0)
    assert payload == {
        'type': 'reaction',
        'player_index': 1,
        'player_name': 'Bob',
        'reaction_id': 'fire',
        'display': '🔥',
        'kind': 'emoji',
    }


def test_unknown_reaction_id_is_dropped():
    room = make_room()
    assert room.handle_reaction('p1', 'not_a_reaction', now=100.0) is None
    assert room.handle_reaction('p1', None, now=100.0) is None


def test_unknown_player_is_dropped():
    room = make_room()
    assert room.handle_reaction('ghost', 'fire', now=100.0) is None


def test_rate_limit_drops_second_reaction_within_cooldown():
    room = make_room()
    assert room.handle_reaction('p1', 'fire', now=100.0) is not None
    assert room.handle_reaction('p1', 'clap', now=100.5) is None
    assert room.handle_reaction('p1', 'clap', now=100.0 + REACTION_COOLDOWN_SECONDS) is not None


def test_rate_limit_is_per_player():
    room = make_room()
    assert room.handle_reaction('p1', 'fire', now=100.0) is not None
    assert room.handle_reaction('p2', 'fire', now=100.1) is not None


def test_dropped_reaction_does_not_consume_cooldown():
    room = make_room()
    assert room.handle_reaction('p1', 'not_a_reaction', now=100.0) is None
    assert room.handle_reaction('p1', 'fire', now=100.1) is not None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && venv/bin/python -m pytest tests/test_reactions.py -v`
Expected: FAIL at collection with `ImportError: cannot import name 'REACTIONS' from 'server'`.
(If pytest is missing from the venv: `venv/bin/pip install pytest`.)

- [ ] **Step 3: Implement in `backend/server.py`**

Add constants directly below the existing `FORCE_GRACE_SECONDS = 15` line:

```python
REACTION_COOLDOWN_SECONDS = 1.0

# Server-side allowlist: clients send only the id; display strings are never
# taken from the client.
REACTIONS: Dict[str, Dict[str, str]] = {
    'laugh':      {'display': '😂', 'kind': 'emoji'},
    'cry':        {'display': '😭', 'kind': 'emoji'},
    'fire':       {'display': '🔥', 'kind': 'emoji'},
    'clap':       {'display': '👏', 'kind': 'emoji'},
    'scream':     {'display': '😱', 'kind': 'emoji'},
    'devil':      {'display': '😈', 'kind': 'emoji'},
    'mind_blown': {'display': '🤯', 'kind': 'emoji'},
    'strong':     {'display': '💪', 'kind': 'emoji'},
    'nice_bid':   {'display': 'Nice bid!', 'kind': 'phrase'},
    'ouch':       {'display': 'Ouch 💀', 'kind': 'phrase'},
    'hurry':      {'display': 'Hurry up! ⏳', 'kind': 'phrase'},
    'gg':         {'display': 'GG 🃏', 'kind': 'phrase'},
}
```

Note: `Dict` is already imported at the top of `server.py`; the constants live above the `class GameRoom` definition so the class can reference them.

In `GameRoom.__init__`, after `self.trump_caller_index = -1`, add:

```python
        self.last_reaction_at: Dict[str, float] = {}
```

After the existing `broadcast_state` method, add two methods:

```python
    def handle_reaction(self, player_id: str, reaction_id: Optional[str],
                        now: Optional[float] = None) -> Optional[Dict]:
        """Validate a reaction; return the broadcast payload or None to drop silently."""
        now = now if now is not None else time.time()
        my_index = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if my_index == -1:
            return None
        entry = REACTIONS.get(reaction_id) if reaction_id else None
        if not entry:
            return None
        last = self.last_reaction_at.get(player_id)
        if last is not None and now - last < REACTION_COOLDOWN_SECONDS:
            return None
        self.last_reaction_at[player_id] = now
        return {
            'type': 'reaction',
            'player_index': my_index,
            'player_name': self.players[my_index]['name'],
            'reaction_id': reaction_id,
            'display': entry['display'],
            'kind': entry['kind'],
        }

    async def broadcast_payload(self, payload: Dict):
        for pid, ws in list(self.connections.items()):
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")
```

In the WebSocket handler's action dispatch, after the `elif action == 'force_action':` block and BEFORE the trailing `await room.broadcast_state()`, add:

```python
            elif action == 'reaction':
                payload = room.handle_reaction(player_id, data.get('reaction_id'))
                if payload:
                    await room.broadcast_payload(payload)
                continue  # reactions never trigger a state rebroadcast
```

The `continue` is required: the loop ends with `await room.broadcast_state()`, and reactions must skip it (Global Constraints).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && venv/bin/python -m pytest tests/ -v`
Expected: all `test_reactions.py` tests PASS; pre-existing test files that require a live server may error/skip — only `test_reactions.py` and `test_game_engine.py` must pass locally.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend/tests/test_reactions.py
git commit -m "feat(backend): add reaction action with allowlist and per-player rate limit"
```

---

### Task 2: Frontend — reaction constants and ReactionTray

**Files:**
- Create: `frontend/constants/reactions.ts`
- Create: `frontend/components/ReactionTray.tsx`
- Modify: `frontend/app/game.tsx` (self dock ~line 811-824; lobby return block ~line 393-405)

**Interfaces:**
- Consumes: WS message `{"action": "reaction", "reaction_id": string}` from Task 1; existing `sendAction(action, haptic)` in game.tsx.
- Produces: `<ReactionTray onSend={(reactionId: string) => void} />` self-contained component (trigger button + modal tray + 1s client throttle); `EMOJI_REACTIONS` / `PHRASE_REACTIONS: { id: string; display: string; kind: 'emoji' | 'phrase' }[]` used again by Task 3's manual checks.

- [ ] **Step 1: Create `frontend/constants/reactions.ts`**

Must mirror the server allowlist IDs exactly (Task 1):

```ts
export type ReactionDef = {
  id: string;
  display: string;
  kind: 'emoji' | 'phrase';
};

export const EMOJI_REACTIONS: ReactionDef[] = [
  { id: 'laugh', display: '😂', kind: 'emoji' },
  { id: 'cry', display: '😭', kind: 'emoji' },
  { id: 'fire', display: '🔥', kind: 'emoji' },
  { id: 'clap', display: '👏', kind: 'emoji' },
  { id: 'scream', display: '😱', kind: 'emoji' },
  { id: 'devil', display: '😈', kind: 'emoji' },
  { id: 'mind_blown', display: '🤯', kind: 'emoji' },
  { id: 'strong', display: '💪', kind: 'emoji' },
];

export const PHRASE_REACTIONS: ReactionDef[] = [
  { id: 'nice_bid', display: 'Nice bid!', kind: 'phrase' },
  { id: 'ouch', display: 'Ouch 💀', kind: 'phrase' },
  { id: 'hurry', display: 'Hurry up! ⏳', kind: 'phrase' },
  { id: 'gg', display: 'GG 🃏', kind: 'phrase' },
];
```

- [ ] **Step 2: Create `frontend/components/ReactionTray.tsx`**

A transparent `Modal` guarantees the tray overlays without reflowing layout and closes on backdrop tap (works on native and react-native-web):

```tsx
// Reaction trigger button + popover tray. Client-side throttle mirrors the
// server's 1s/player limit so drops feel intentional, not broken.
import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Pressable, Modal, StyleSheet } from 'react-native';
import { EMOJI_REACTIONS, PHRASE_REACTIONS } from '../constants/reactions';

const COOLDOWN_MS = 1000;

type Props = {
  onSend: (reactionId: string) => void;
};

export default function ReactionTray({ onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const lastSentAt = useRef(0);

  const handleSend = (reactionId: string) => {
    const now = Date.now();
    if (now - lastSentAt.current < COOLDOWN_MS) return;
    lastSentAt.current = now;
    onSend(reactionId);
    setOpen(false);
    setCoolingDown(true);
    setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
  };

  return (
    <>
      <TouchableOpacity
        testID="reaction-tray-btn"
        style={[styles.trigger, coolingDown && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
        disabled={coolingDown}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.triggerEmoji}>😊</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.tray} onPress={(e) => e.stopPropagation()}>
            <View style={styles.emojiRow}>
              {EMOJI_REACTIONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  testID={`reaction-${r.id}`}
                  style={styles.emojiBtn}
                  onPress={() => handleSend(r.id)}
                >
                  <Text style={styles.emojiText}>{r.display}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.phraseRow}>
              {PHRASE_REACTIONS.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  testID={`reaction-${r.id}`}
                  style={styles.phrasePill}
                  onPress={() => handleSend(r.id)}
                >
                  <Text style={styles.phraseText}>{r.display}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDisabled: {
    opacity: 0.4,
  },
  triggerEmoji: {
    fontSize: 22,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 190,
    paddingHorizontal: 16,
  },
  tray: {
    backgroundColor: 'rgba(20, 24, 38, 0.96)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  phraseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  phrasePill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
  },
  phraseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});
```

Note for react-native-web: `e.stopPropagation()` on the inner `Pressable` prevents backdrop-close when tapping inside the tray. If TypeScript complains about the event type, use `onPress={(e: any) => e.stopPropagation()}`.

- [ ] **Step 3: Wire the tray into `game.tsx` — game screen**

Add the import at the top with the other component imports (~line 25):

```tsx
import ReactionTray from '../components/ReactionTray';
```

In the self dock (~line 811), insert the tray between the name block and the score so the button sits at the right end of the row, left of the score:

```tsx
          <View style={styles.selfDock}>
            <View style={styles.selfMeta}>
              <View>
                <Text style={styles.selfName}>{myInfo?.name || params.player_name}</Text>
                <Text style={styles.selfSubtext} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                  {gameState.dealer_index === your_index ? 'Dealer' : 'Player'}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? ` • Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : ' • No bid yet'}
                </Text>
              </View>
              <ReactionTray onSend={(id) => void sendAction({ action: 'reaction', reaction_id: id }, 'light')} />
              <Text style={styles.selfScore}>{myInfo?.total_score || 0} pts</Text>
            </View>
          </View>
```

If `selfMeta`'s style does not already space children apart, check the `selfMeta` entry in the StyleSheet (~line 1441 region) — it should have `flexDirection: 'row'`, `alignItems: 'center'`, `justifyContent: 'space-between'`. Add `gap: 12` if the button crowds the score.

- [ ] **Step 4: Wire the tray into `game.tsx` — lobby**

In the `phase === 'waiting'` return block (~line 393), add a floating wrapper as the LAST child of the `SafeAreaView` (after the `ScrollView` closes), so it overlays bottom-right:

```tsx
        <View style={styles.lobbyReactionWrap}>
          <ReactionTray onSend={(id) => void sendAction({ action: 'reaction', reaction_id: id }, 'light')} />
        </View>
```

Add to the StyleSheet:

```tsx
  lobbyReactionWrap: {
    position: 'absolute',
    right: 20,
    bottom: 28,
  },
```

- [ ] **Step 5: Manual verification**

Start backend and frontend, open the app in a browser, create a room:
- Lobby: 😊 button floats bottom-right; tapping opens the tray; tapping an emoji closes it; backdrop tap closes without sending.
- Backend log confirms no errors; browser Network tab (WS frames) shows `{"action":"reaction","reaction_id":"fire"}` sent.
- Start a 3-player game (three tabs): 😊 button appears in the self dock row; opening the tray does not shift any layout.
- Rapid double-tap on an emoji sends only one frame; button dims for ~1s after send.

(Nothing renders on receive yet — that's Task 3.)

- [ ] **Step 6: Commit**

```bash
git add frontend/constants/reactions.ts frontend/components/ReactionTray.tsx frontend/app/game.tsx
git commit -m "feat(frontend): add reaction tray to game screen and lobby"
```

---

### Task 3: Frontend — ReactionOverlay rendering incoming reactions

**Files:**
- Create: `frontend/components/ReactionOverlay.tsx`
- Modify: `frontend/app/game.tsx` (onmessage handler ~line 186-225; both the lobby return and the main game return)

**Interfaces:**
- Consumes: broadcast `{"type": "reaction", "player_index": number, "player_name": string, "reaction_id": string, "display": string, "kind": "emoji" | "phrase"}` from Task 1.
- Produces: `<ReactionOverlay reactions={IncomingReaction[]} playerCount={number} reduceMotion={boolean} onDone={(key: string) => void} />` where `IncomingReaction = { key: string; player_index: number; player_name: string; display: string; kind: 'emoji' | 'phrase' }`.

- [ ] **Step 1: Create `frontend/components/ReactionOverlay.tsx`**

```tsx
// Non-interactive overlay that floats incoming reactions up from near the
// sender's horizontal position and fades them out. pointerEvents="none" so
// card taps always pass through.
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';

export type IncomingReaction = {
  key: string;
  player_index: number;
  player_name: string;
  display: string;
  kind: 'emoji' | 'phrase';
};

type Props = {
  reactions: IncomingReaction[];
  playerCount: number;
  reduceMotion: boolean;
  onDone: (key: string) => void;
};

const DURATION_MS = 2500;
const RISE_PX = 80;

function FloatingReaction({
  reaction,
  playerCount,
  reduceMotion,
  onDone,
}: {
  reaction: IncomingReaction;
  playerCount: number;
  reduceMotion: boolean;
  onDone: (key: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  // Jitter fixed per reaction so simultaneous reactions don't stack.
  const jitter = useRef(Math.random() * 60 - 30).current;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onDone(reaction.key);
    });
    return () => animation.stop();
  }, [anim, onDone, reaction.key]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, reduceMotion ? 0 : -RISE_PX],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  // Spread senders across the width by seat index; clamp inside the screen.
  const slot = ((reaction.player_index + 1) / (playerCount + 1)) * width;
  const left = Math.max(12, Math.min(width - 92, slot - 40 + jitter));
  const top = height * 0.52;

  return (
    <Animated.View style={[styles.item, { left, top, opacity, transform: [{ translateY }] }]}>
      {reaction.kind === 'emoji' ? (
        <Text style={styles.emoji}>{reaction.display}</Text>
      ) : (
        <View style={styles.phrasePill}>
          <Text style={styles.phraseText}>{reaction.display}</Text>
        </View>
      )}
      <Text style={styles.sender} numberOfLines={1}>
        {reaction.player_name}
      </Text>
    </Animated.View>
  );
}

export default function ReactionOverlay({ reactions, playerCount, reduceMotion, onDone }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {reactions.map((r) => (
        <FloatingReaction
          key={r.key}
          reaction={r}
          playerCount={playerCount}
          reduceMotion={reduceMotion}
          onDone={onDone}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
    maxWidth: 120,
  },
  emoji: {
    fontSize: 40,
  },
  phrasePill: {
    backgroundColor: 'rgba(20, 24, 38, 0.92)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  phraseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sender: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
});
```

- [ ] **Step 2: Wire incoming reactions in `game.tsx`**

Add the import next to the ReactionTray import:

```tsx
import ReactionOverlay, { IncomingReaction } from '../components/ReactionOverlay';
```

Add state near the other `useState` calls (~line 87):

```tsx
  const [reactions, setReactions] = useState<IncomingReaction[]>([]);
```

Add a stable remover near the other callbacks (before `connect` is defined; `useCallback` is already imported):

```tsx
  const removeReaction = useCallback((key: string) => {
    setReactions((prev) => prev.filter((r) => r.key !== key));
  }, []);
```

In `socket.onmessage`, add a branch after the `data.type === 'error'` branch (~line 221):

```tsx
        } else if (data.type === 'reaction') {
          const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setReactions((prev) => {
            const next = [
              ...prev,
              {
                key,
                player_index: data.player_index,
                player_name: data.player_name,
                display: data.display,
                kind: data.kind,
              },
            ];
            // Cap concurrent animations; drop oldest first.
            return next.length > 8 ? next.slice(next.length - 8) : next;
          });
        }
```

(`setReactions` is a state setter — stable identity, so the `connect` useCallback dependency array does not change.)

- [ ] **Step 3: Render the overlay in both returns**

In the main game return, add as the LAST child inside the root `SafeAreaView` (after the error banner / modals, so it draws on top):

```tsx
          <ReactionOverlay
            reactions={reactions}
            playerCount={players.length}
            reduceMotion={reduceMotion}
            onDone={removeReaction}
          />
```

In the lobby (`phase === 'waiting'`) return, add the same element as the last child of its `SafeAreaView`, after the `lobbyReactionWrap` view from Task 2.

- [ ] **Step 4: Manual verification (two browser sessions)**

Backend + frontend running; open two browser windows, create a room in one and join from the other:
- Lobby: send 🔥 from window A → floating 🔥 with sender name appears in BOTH windows and fades out in ~2.5s.
- Send a phrase → pill with text and sender name floats in both windows.
- Start a 3-player game (add a third tab). During play, send reactions from two players at once → both render with horizontal offset, no stacking.
- While a reaction is animating over the hand area, tap a card → the tap registers (overlay is non-interactive).
- Spam taps: at most 1 reaction/second gets through per player; no error banner ever appears.
- Set a 17-card round (v1 with 3 players): open the tray → no layout shift; reactions render in the table area, not over the hand.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ReactionOverlay.tsx frontend/app/game.tsx
git commit -m "feat(frontend): render incoming reactions as floating overlay"
```
