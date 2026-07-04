# Judgement Game-Table UX Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 11 open findings from the 2026-07-02 UX review of the in-game table screen (offline deadlock, truncation, contradictory copy, weak hierarchy), replace the flat opponent arc with an oval poker-table layout for up to 7 players, and add a card-play animation with a subtle sound.

**Architecture:** Backend (`server.py`) gains a disconnect grace timer plus a host-only `force_action` that auto-bids / auto-plays for an offline player, unblocking games. Frontend gets three new focused units — `utils/bidStatus.ts` (pure), `utils/tableLayout.ts` (pure oval geometry), `components/OvalTable.tsx` + `components/OpponentSeat.tsx` (rendering) — and `game.tsx` swaps its `opponentStage`/`centerStage` blocks for the oval table. Sound uses `expo-audio` with a generated WAV asset; the card-entry animation is a mount animation on trick cards.

**Tech Stack:** React Native 0.81 + Expo 54 (StyleSheet only, no CSS-in-JS), TypeScript strict, FastAPI + native WebSockets, pytest (backend), `node --test` via `tsx` (frontend pure helpers).

## Global Constraints

- **Repo:** `~/Desktop/Projects/judgement_app` — frontend in `frontend/`, backend in `backend/`.
- **No console.logs** in shipped code.
- **Respect reduce-motion:** every new animation must check the existing `reduceMotion` state / `AccessibilityInfo.isReduceMotionEnabled()` pattern already used in `game.tsx` and `PlayingCard.tsx`.
- **Touch targets ≥ 44px** for any new button.
- **Colors/typography only from `frontend/utils/theme.ts`** (`COLORS`, `FONTS`, `SUIT_SYMBOLS`, `SUIT_DISPLAY_COLORS`). Add new tokens there, never inline hex (existing rgba glass tints are the sanctioned exception).
- **Surgical edits:** don't rename, reformat, or add types to untouched code.
- **State is server-authoritative:** frontend never mutates game state, only sends `{action: ...}` messages.
- **Server broadcast contract:** after every mutating WS action the server broadcasts full per-player state; any new field must be added in `GameRoom.get_state_for_player` and typed in the `GameState` interface in `game.tsx`.
- **Max players 7** (1 self + up to 6 opponents rendered as seats).
- **Verification commands:** backend `cd backend && python -m pytest tests/ -q`; frontend types `cd frontend && npx tsc --noEmit`; frontend pure-helper tests `cd frontend && npx tsx --test utils/__tests__/*.test.ts`.
- Commit after every task with a `feat:`/`fix:` message ending in `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

## Review-point → Task map

| Review point | Task |
|---|---|
| 1. Offline player deadlocks game | Task 1 (backend) + Task 2 (frontend) |
| 2. Contradictory "Play a card to begin" copy | Task 5 |
| 3. Truncated labels ("SETS CO…", "TOTAL BI…", names) | Task 4 (pills) + Task 5 (seat names) |
| 4. Overlapping opponent seats | Task 5 (oval geometry) |
| 5. Weak turn salience | Task 5 |
| 6. Bid status not surfaced (secured/busted/chasing) | Task 3 |
| 8. Negative score styled gold | Task 3 |
| 9. Header pill overload | Task 4 |
| 10. Dead space in mid-zone | Task 5 (oval fills the stage) |
| 11. "TABLE" label + "Player" role noise | Task 5 |
| 12. Trump legibility | Task 4 |
| New: card-play animation + subtle sound | Task 6 |

(Point 7, legal-play affordance, already shipped via `playableIndices` → `HandDisplay`.)

---

### Task 1: Backend — offline grace period + host `force_action`

**Files:**
- Modify: `backend/server.py`
- Test: `backend/tests/test_force_action.py` (create)

**Interfaces:**
- Consumes: existing `GameRoom` methods `place_bid`, `play_card`, `call_trump`; `game_engine.is_valid_play`, `get_restricted_bids`.
- Produces:
  - `GameRoom.force_action(host_id: str) -> Optional[str]` — host-only; auto-acts for the current player if they are disconnected past the grace period. Returns error string or `None`.
  - Per-player state field `offline_for: Optional[float]` (seconds since disconnect, `None` when connected) in `get_state_for_player`.
  - Top-level state field `force_grace_seconds: int` (constant `15`).
  - WS action `{"action": "force_action"}`.

- [ ] **Step 1: Write the failing tests**

Create `backend/tests/test_force_action.py`:

```python
import time
import pytest
from server import GameRoom, FORCE_GRACE_SECONDS


def make_room(n=3):
    room = GameRoom("TEST")
    for i in range(n):
        room.players.append({
            'id': f'p{i}', 'name': f'Player{i}', 'is_host': i == 0,
            'hand': [], 'bid': None, 'has_bid': False,
            'tricks_won': 0, 'total_score': 0,
            'is_connected': True, 'offline_since': None,
        })
    room.start_game()
    return room


def disconnect(room, idx, seconds_ago=FORCE_GRACE_SECONDS + 1):
    room.players[idx]['is_connected'] = False
    room.players[idx]['offline_since'] = time.time() - seconds_ago


def test_force_action_rejects_non_host():
    room = make_room()
    disconnect(room, room.current_player_index)
    assert room.force_action('p1') == "Only the host can act for an offline player"


def test_force_action_rejects_connected_target():
    room = make_room()
    err = room.force_action('p0')
    assert err == "Current player is not offline"


def test_force_action_rejects_within_grace():
    room = make_room()
    disconnect(room, room.current_player_index, seconds_ago=2)
    err = room.force_action('p0')
    assert "wait" in err.lower()


def test_force_action_places_bid_for_offline_player():
    room = make_room()
    idx = room.current_player_index
    disconnect(room, idx)
    assert room.phase == 'bidding'
    assert room.force_action('p0') is None
    assert room.players[idx]['has_bid'] is True
    assert room.players[idx]['bid'] is not None


def test_force_action_respects_dealer_restriction():
    room = make_room()
    # Non-dealer bids sum to exactly cards_this_round, so the dealer's
    # restricted bid is 0 — the forced bid must then be 1, not 0.
    non_dealers = room.bidding_order[:-1]
    for pos, i in enumerate(non_dealers):
        pid = room.players[i]['id']
        bid = room.cards_this_round if pos == 0 else 0
        assert room.place_bid(pid, bid) is None
    dealer_idx = room.bidding_order[-1]
    disconnect(room, dealer_idx)
    assert room.force_action('p0') is None
    # Dealer restriction: total bids must not equal cards dealt
    total = sum(p['bid'] for p in room.players)
    assert total != room.cards_this_round


def test_force_action_plays_valid_card():
    room = make_room()
    for i in room.bidding_order:
        assert room.place_bid(room.players[i]['id'], 0 if i != room.bidding_order[-1] else 1) is None
    assert room.phase == 'playing'
    idx = room.current_player_index
    hand_before = len(room.players[idx]['hand'])
    disconnect(room, idx)
    assert room.force_action('p0') is None
    assert len(room.players[idx]['hand']) == hand_before - 1
    assert len(room.current_trick) == 1


def test_force_action_calls_trump_v2():
    room = GameRoom("TEST")
    for i in range(3):
        room.players.append({
            'id': f'p{i}', 'name': f'Player{i}', 'is_host': i == 0,
            'hand': [], 'bid': None, 'has_bid': False,
            'tricks_won': 0, 'total_score': 0,
            'is_connected': True, 'offline_since': None,
        })
    room.variation = 'v2'
    room.start_game()
    assert room.phase == 'trump_selection'
    disconnect(room, room.trump_caller_index)
    assert room.force_action('p0') is None
    assert room.trump_suit in ('hearts', 'spades', 'diamonds', 'clubs')
    assert room.phase == 'bidding'


def test_state_includes_offline_fields():
    room = make_room()
    disconnect(room, 1, seconds_ago=20)
    state = room.get_state_for_player('p0')
    assert state['force_grace_seconds'] == FORCE_GRACE_SECONDS
    assert state['players'][1]['offline_for'] == pytest.approx(20, abs=2)
    assert state['players'][0]['offline_for'] is None
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Desktop/Projects/judgement_app/backend && python -m pytest tests/test_force_action.py -q`
Expected: FAIL / ERROR with `ImportError: cannot import name 'FORCE_GRACE_SECONDS'`

- [ ] **Step 3: Implement in `server.py`**

3a. Add near the top constants (after `VALID_SUITS`):

```python
FORCE_GRACE_SECONDS = 15
```

Add `import time` to the imports.

3b. In the WS join handler, add `'offline_since': None` to the new-player dict (the one appended in `websocket_endpoint`), and on reconnect set it back:

```python
    if existing:
        existing['is_connected'] = True
        existing['offline_since'] = None
        existing['name'] = player_name
```

3c. In the `WebSocketDisconnect` handler's in-game branch, record the timestamp:

```python
        else:
            if existing:
                existing['is_connected'] = False
                existing['offline_since'] = time.time()
```

Do the same in the generic `except Exception` handler where `is_connected` is set to `False`.

3d. In `get_state_for_player`, extend `players_info.append({...})` with:

```python
                'offline_for': (time.time() - p['offline_since'])
                    if (not p.get('is_connected', True) and p.get('offline_since'))
                    else None,
```

and add to the returned state dict:

```python
            'force_grace_seconds': FORCE_GRACE_SECONDS,
```

3e. Add the method to `GameRoom` (after `play_card`):

```python
    def force_action(self, host_id: str) -> Optional[str]:
        host = next((p for p in self.players if p['id'] == host_id), None)
        if not host or not host['is_host']:
            return "Only the host can act for an offline player"
        if self.phase not in ('bidding', 'playing', 'trump_selection', 'trump_selection_v3'):
            return "Nothing to act on right now"
        target = self.players[self.current_player_index]
        if target.get('is_connected', True) or not target.get('offline_since'):
            return "Current player is not offline"
        elapsed = time.time() - target['offline_since']
        if elapsed < FORCE_GRACE_SECONDS:
            return f"Please wait {int(FORCE_GRACE_SECONDS - elapsed) + 1}s before acting for {target['name']}"

        if self.phase == 'bidding':
            restricted = []
            idx = self.current_player_index
            if idx == self.bidding_order[-1]:
                bids_so_far = [self.players[i]['bid'] for i in self.bidding_order[:-1]]
                restricted = get_restricted_bids(bids_so_far, self.cards_this_round)
            bid = next(b for b in range(self.cards_this_round + 1) if b not in restricted)
            return self.place_bid(target['id'], bid)

        if self.phase == 'playing':
            hand = target['hand']
            lead = self.current_trick[0]['card']['suit'] if self.current_trick else None
            card = next(c for c in hand if is_valid_play(c, hand, lead))
            return self.play_card(target['id'], card)

        if self.phase == 'trump_selection':
            return self.call_trump(target['id'], None)  # blind draw

        # trump_selection_v3 requires an explicit suit
        return self.call_trump(target['id'], random.choice(VALID_SUITS))
```

3f. Register the WS action in `websocket_endpoint` (next to the other `elif action ==` branches):

```python
            elif action == 'force_action':
                error = room.force_action(player_id)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Desktop/Projects/judgement_app/backend && python -m pytest tests/ -q`
Expected: all tests pass, including the pre-existing 30 game_engine tests and websocket tests.

- [ ] **Step 5: Commit**

```bash
git add backend/server.py backend/tests/test_force_action.py
git commit -m "feat: offline grace period + host force_action to unblock stalled games

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend — offline-recovery UI (banner, countdown, host button)

**Files:**
- Modify: `frontend/app/game.tsx`

**Interfaces:**
- Consumes: state fields from Task 1 — `players[i].offline_for: number | null`, `force_grace_seconds: number`; WS action `{action: 'force_action'}`.
- Produces: an `OfflineRecoveryBanner` inline component in `game.tsx` used inside the center stage (Task 5 later moves it inside the oval — it must remain a self-contained component so that move is a one-line relocation).

- [ ] **Step 1: Extend the `GameState` interface**

In `game.tsx`, add to the `players` array element type:

```typescript
    offline_for: number | null;
```

and to the top level of `GameState`:

```typescript
  force_grace_seconds: number;
```

- [ ] **Step 2: Add a 1-second ticker and derived offline state**

Inside `GameScreen`, after the `isMyTurn` derivation block (the `const isMyTurn = ...` line lives after the early returns; put the hook-based ticker with the other hooks near the top instead):

```typescript
  const [nowTick, setNowTick] = useState(0);
  const stateReceivedAt = useRef(Date.now());
```

In `socket.onmessage`, right after `setGameState(data);`:

```typescript
          stateReceivedAt.current = Date.now();
```

Add an effect (with the other effects near the top):

```typescript
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
```

After the `isMyTurn` derivation (in the post-early-return section), compute:

```typescript
  const currentPlayer = players[gameState.current_player_index];
  const currentPlayerOffline = currentPlayer && !currentPlayer.is_connected;
  const offlineElapsed = currentPlayerOffline && currentPlayer.offline_for !== null
    ? currentPlayer.offline_for + (Date.now() - stateReceivedAt.current) / 1000
    : 0;
  const forceRemaining = Math.max(0, Math.ceil((gameState.force_grace_seconds ?? 15) - offlineElapsed));
  void nowTick; // re-render driver for the countdown
```

- [ ] **Step 3: Add the banner component**

Below the `StatusPill` function component at the bottom of `game.tsx`, add:

```typescript
function OfflineRecoveryBanner({
  name,
  remaining,
  isHost,
  onForce,
}: {
  name: string;
  remaining: number;
  isHost: boolean;
  onForce: () => void;
}) {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerTitle}>{name} is offline</Text>
      {remaining > 0 ? (
        <Text style={styles.offlineBannerSub}>
          Giving them {remaining}s to reconnect…
        </Text>
      ) : isHost ? (
        <TouchableOpacity
          testID="force-action-btn"
          style={styles.offlineForceBtn}
          onPress={onForce}
          activeOpacity={0.8}
        >
          <Text style={styles.offlineForceBtnText}>Play for {name}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.offlineBannerSub}>
          The host can play their turn for them
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 4: Render it in the center stage**

Inside `styles.centerStage`'s JSX, directly above the `turnBanner` `Animated.View`:

```typescript
            {currentPlayerOffline && (phase === 'playing' || phase === 'bidding') && (
              <OfflineRecoveryBanner
                name={currentPlayer.name}
                remaining={forceRemaining}
                isHost={isHost}
                onForce={() => void sendAction({ action: 'force_action' }, 'medium')}
              />
            )}
```

- [ ] **Step 5: Add styles**

In the `StyleSheet.create` block (after `errorBannerText`):

```typescript
  offlineBanner: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: 10,
    gap: 6,
  },
  offlineBannerTitle: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  offlineBannerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  offlineForceBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
  },
  offlineForceBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
  },
```

- [ ] **Step 6: Typecheck**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "feat: offline-player recovery banner with reconnect countdown and host force button

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Bid-status semantics + score coloring

**Files:**
- Create: `frontend/utils/bidStatus.ts`
- Test: `frontend/utils/__tests__/bidStatus.test.ts` (create)
- Modify: `frontend/app/game.tsx`, `frontend/package.json` (add `tsx` devDependency)

**Interfaces:**
- Produces (used by Task 5's `OpponentSeat`):
  - `type BidStatus = 'pending' | 'chasing' | 'secured' | 'busted'`
  - `bidStatus(bid: number | null, tricksWon: number): BidStatus`
  - `BID_STATUS_COLORS: Record<BidStatus, string>`
  - `scoreColor(score: number): string`

- [ ] **Step 1: Install the test runner**

```bash
cd ~/Desktop/Projects/judgement_app/frontend && yarn add -D tsx
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/utils/__tests__/bidStatus.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bidStatus, scoreColor, BID_STATUS_COLORS } from '../bidStatus';

test('pending before any bid', () => {
  assert.equal(bidStatus(null, 0), 'pending');
});

test('chasing while under bid', () => {
  assert.equal(bidStatus(3, 1), 'chasing');
});

test('secured when tricks equal bid', () => {
  assert.equal(bidStatus(2, 2), 'secured');
  assert.equal(bidStatus(0, 0), 'secured');
});

test('busted when tricks exceed bid', () => {
  assert.equal(bidStatus(2, 3), 'busted');
  assert.equal(bidStatus(0, 1), 'busted');
});

test('every status has a color', () => {
  for (const s of ['pending', 'chasing', 'secured', 'busted'] as const) {
    assert.match(BID_STATUS_COLORS[s], /^#|^rgba/);
  }
});

test('scoreColor is red for negative, gold otherwise', () => {
  assert.notEqual(scoreColor(-30), scoreColor(0));
  assert.equal(scoreColor(0), scoreColor(25));
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsx --test utils/__tests__/bidStatus.test.ts`
Expected: FAIL — cannot find module `../bidStatus`.

- [ ] **Step 4: Implement `frontend/utils/bidStatus.ts`**

```typescript
// Semantics of a bid mid-round. In Judgement you score only on an exact
// hit, so 'secured' means "on target so far — now avoid extra tricks",
// and any trick beyond the bid is an immediate bust.

import { COLORS } from './theme';

export type BidStatus = 'pending' | 'chasing' | 'secured' | 'busted';

export function bidStatus(bid: number | null, tricksWon: number): BidStatus {
  if (bid === null || bid === undefined) return 'pending';
  if (tricksWon > bid) return 'busted';
  if (tricksWon === bid) return 'secured';
  return 'chasing';
}

export const BID_STATUS_COLORS: Record<BidStatus, string> = {
  pending: COLORS.textSecondary,
  chasing: '#F5B93E',
  secured: COLORS.success,
  busted: COLORS.danger,
};

export const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending: '',
  chasing: '',
  secured: 'on target',
  busted: 'busted',
};

export function scoreColor(score: number): string {
  return score < 0 ? COLORS.danger : COLORS.goldLight;
}
```

Note: `theme.ts` imports nothing from react-native, so this stays node-testable.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsx --test utils/__tests__/bidStatus.test.ts`
Expected: 6 passing.

- [ ] **Step 6: Apply to the existing UI in `game.tsx`**

Import at the top:

```typescript
import { bidStatus, BID_STATUS_COLORS, BID_STATUS_LABELS, scoreColor } from '../utils/bidStatus';
```

6a. Opponent seat body (the `opponentBody` Text showing `Bid X  Won Y`): wrap with status color. Replace that Text's content logic with:

```typescript
                  {(() => {
                    if (opp.has_bid || opp.bid !== null) {
                      const st = bidStatus(opp.bid, opp.tricks_won);
                      const label = BID_STATUS_LABELS[st];
                      return (
                        <Text
                          style={[styles.opponentBody, { color: BID_STATUS_COLORS[st] }]}
                          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                        >
                          {`Bid ${opp.bid} · Won ${opp.tricks_won}${label ? ` · ${label}` : ''}`}
                        </Text>
                      );
                    }
                    return (
                      <Text style={styles.opponentBody} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {phase === 'bidding' ? 'Waiting to bid' : `Cards ${opp.card_count}`}
                      </Text>
                    );
                  })()}
```

(This replaces the whole existing `<Text style={styles.opponentBody} ...>` block.)

6b. Opponent score — replace `style={styles.opponentScore}` with:

```typescript
style={[styles.opponentScore, { color: scoreColor(opp.total_score) }]}
```

6c. Self dock — replace `style={styles.selfScore}` with:

```typescript
style={[styles.selfScore, { color: scoreColor(myInfo?.total_score || 0) }]}
```

and give the self bid line the same status color: in `selfSubtext`, replace the Text with:

```typescript
                <Text
                  style={[
                    styles.selfSubtext,
                    myInfo?.bid !== null && myInfo?.bid !== undefined
                      ? { color: BID_STATUS_COLORS[bidStatus(myInfo.bid, myInfo.tricks_won)] }
                      : null,
                  ]}
                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                >
                  {gameState.dealer_index === your_index ? 'Dealer' : ''}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? `${gameState.dealer_index === your_index ? ' • ' : ''}Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : `${gameState.dealer_index === your_index ? ' • ' : ''}No bid yet`}
                </Text>
```

(This also removes the "Player" filler word — review point 11's second half.)

- [ ] **Step 7: Typecheck**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/utils/bidStatus.ts frontend/utils/__tests__/bidStatus.test.ts frontend/app/game.tsx frontend/package.json yarn.lock
git commit -m "feat: bid status semantics (chasing/secured/busted) + negative-score coloring

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Status rail redesign — hierarchy, short labels, trump legibility

**Files:**
- Modify: `frontend/app/game.tsx` (the `statusRail`/`statusCluster` JSX and related styles)

**Interfaces:**
- Consumes: existing `StatusPill` component, `SUIT_SYMBOLS`, `SUIT_DISPLAY_COLORS`, `totalBids`, `connected`.
- Produces: nothing consumed by later tasks (pure presentation).

Design (fixes points 3, 9, 12): two primary pills (Trump with symbol + name, Round), two compact secondary pills with short labels that can never truncate (Tricks `4/9`, Bids `7/9`), and the connection state reduced to a colored dot beside the help button. The redundant "Cards" pill is absorbed into the `x/y` denominators.

- [ ] **Step 1: Replace the `statusCluster` JSX**

In the game-table JSX, replace the six `StatusPill` lines inside `<View style={styles.statusCluster}>` with:

```typescript
            <View style={styles.statusCluster}>
              <StatusPill
                label="Trump"
                value={
                  gameState.trump_suit
                    ? `${trumpSymbol} ${gameState.trump_suit.charAt(0).toUpperCase() + gameState.trump_suit.slice(1)}`
                    : '—'
                }
                valueStyle={{ color: trumpColor }}
                primary
              />
              <StatusPill
                label="Round"
                value={`${gameState.current_round}/${gameState.total_rounds}`}
                primary
              />
              <StatusPill label="Tricks" value={`${gameState.tricks_played}/${gameState.cards_this_round}`} />
              <StatusPill label="Bids" value={`${totalBids}/${gameState.cards_this_round}`} />
            </View>
```

- [ ] **Step 2: Add the connection dot**

Directly after the help button (`helpBtn` TouchableOpacity) inside `statusRail`, add:

```typescript
            <View
              testID="connection-dot"
              accessibilityLabel={connected ? 'Connected' : 'Reconnecting'}
              style={[styles.connDot, { backgroundColor: connected ? COLORS.success : COLORS.danger }]}
            />
```

- [ ] **Step 3: Extend `StatusPill` with a `primary` variant**

Replace the `StatusPill` function component with:

```typescript
function StatusPill({
  label,
  value,
  muted,
  primary,
  valueStyle,
}: {
  label: string;
  value: string;
  muted?: boolean;
  primary?: boolean;
  valueStyle?: object;
}) {
  return (
    <View style={[styles.statusPill, primary && styles.statusPillPrimary, muted && styles.statusPillMuted]}>
      <Text style={styles.statusPillLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.statusPillValue, primary && styles.statusPillValuePrimary, valueStyle]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}
```

- [ ] **Step 4: Add/adjust styles**

Add after `statusPillMuted` in the StyleSheet:

```typescript
  statusPillPrimary: {
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(212,175,55,0.08)',
    flexBasis: '46%',
  },
  statusPillValuePrimary: {
    fontSize: 15,
  },
  connDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
```

Change `statusPill`'s `flexBasis` from `'28%'` to `'22%'` so the two secondary pills share one row under the two primary pills.

- [ ] **Step 5: Typecheck + visual check**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsc --noEmit` → no errors.
Then run the app in a browser (`yarn start`, press `w`), create a room with 3 fake tabs, start a game, and confirm: no label truncates at 390px width; trump shows "♥ Hearts" in red / "♠ Spades" in white; the dot is green while connected.

- [ ] **Step 6: Commit**

```bash
git add frontend/app/game.tsx
git commit -m "feat: status rail hierarchy — primary trump/round pills, short labels, connection dot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Oval table layout with surrounding seats

**Files:**
- Create: `frontend/utils/tableLayout.ts`
- Test: `frontend/utils/__tests__/tableLayout.test.ts` (create)
- Create: `frontend/components/OpponentSeat.tsx`
- Modify: `frontend/app/game.tsx` (replace `opponentStage` + `centerStage` blocks; remove dead styles)

**Interfaces:**
- Consumes: `bidStatus`, `BID_STATUS_COLORS`, `BID_STATUS_LABELS`, `scoreColor` from Task 3; `OfflineRecoveryBanner` from Task 2.
- Produces:
  - `seatPositions(count: number, stageW: number, stageH: number, seatW: number, seatH: number): {left: number; top: number}[]` — pure ellipse-perimeter placement, opponents on the top arc, bottom reserved for the self dock.
  - `seatSize(count: number, stageW: number): {width: number; height: number}`
  - `<OpponentSeat player={...} isTurn isDealer style={...} />`

Design (fixes points 2, 4, 5, 10, 11): one `ovalStage` view flexes to fill everything between the status rail and the self dock. Inside it: a stadium-shaped table surface (rounded rect, `borderRadius = height/2` — the classic poker-table silhouette), the trick cards and turn text centered ON the table, and opponent seats absolutely positioned around the table's edge. The old floating turn pill, the "TABLE"/"Bidding round" header row, and the separate `trickTable` panel are all removed.

- [ ] **Step 1: Write the failing geometry tests**

Create `frontend/utils/__tests__/tableLayout.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seatPositions, seatSize } from '../tableLayout';

const overlaps = (a: any, b: any, w: number, h: number) =>
  Math.abs(a.left - b.left) < w && Math.abs(a.top - b.top) < h;

test('returns one position per opponent, 1 through 6', () => {
  for (let n = 1; n <= 6; n++) {
    assert.equal(seatPositions(n, 380, 420, 96, 64).length, n);
  }
});

test('no two seats overlap at 6 opponents on a small phone', () => {
  const { width, height } = seatSize(6, 360);
  const pos = seatPositions(6, 360, 400, width, height);
  for (let i = 0; i < pos.length; i++) {
    for (let j = i + 1; j < pos.length; j++) {
      assert.ok(!overlaps(pos[i], pos[j], width, height), `seats ${i} and ${j} overlap`);
    }
  }
});

test('all seats stay inside the stage', () => {
  const { width, height } = seatSize(6, 360);
  for (const p of seatPositions(6, 360, 400, width, height)) {
    assert.ok(p.left >= -1 && p.left + width <= 361, `left out of bounds: ${p.left}`);
    assert.ok(p.top >= -1 && p.top + height <= 401, `top out of bounds: ${p.top}`);
  }
});

test('single opponent sits top-center', () => {
  const [p] = seatPositions(1, 380, 420, 96, 64);
  assert.ok(Math.abs(p.left + 48 - 190) < 2, 'not horizontally centered');
  assert.ok(p.top < 100, 'not near the top');
});

test('layout is left-right symmetric', () => {
  const pos = seatPositions(4, 380, 420, 96, 64);
  const cx = 190;
  assert.ok(Math.abs((pos[0].left + 48 - cx) + (pos[3].left + 48 - cx)) < 2);
  assert.ok(Math.abs(pos[0].top - pos[3].top) < 2);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsx --test utils/__tests__/tableLayout.test.ts`
Expected: FAIL — cannot find module `../tableLayout`.

- [ ] **Step 3: Implement `frontend/utils/tableLayout.ts`**

```typescript
// Pure geometry for the oval game table. Opponent seats are placed on an
// ellipse hugging the stage bounds. The bottom of the ellipse (90° in
// screen coordinates, y-down) is reserved for the local player's dock, so
// opponents span the arc from lower-left, over the top, to lower-right.

export interface SeatPos {
  left: number;
  top: number;
}

const ARC_START_DEG = 148; // lower-left
const ARC_END_DEG = 392;   // lower-right (32° past 360)

export function seatSize(count: number, stageW: number): { width: number; height: number } {
  // Narrower seats when the top arc gets crowded (5-6 opponents).
  const width = count >= 5 ? Math.min(104, Math.max(88, Math.floor(stageW / 3.6))) : Math.min(120, Math.max(96, Math.floor(stageW / 3.2)));
  return { width, height: 64 };
}

export function seatPositions(
  count: number,
  stageW: number,
  stageH: number,
  seatW: number,
  seatH: number,
): SeatPos[] {
  if (count <= 0) return [];
  const cx = stageW / 2;
  const cy = stageH / 2;
  const rx = Math.max(60, stageW / 2 - seatW / 2 - 2);
  const ry = Math.max(60, stageH / 2 - seatH / 2 - 2);
  const span = ARC_END_DEG - ARC_START_DEG;

  const positions: SeatPos[] = [];
  for (let i = 0; i < count; i++) {
    const deg = count === 1 ? 270 : ARC_START_DEG + (span * i) / (count - 1);
    const rad = (deg * Math.PI) / 180;
    positions.push({
      left: cx + rx * Math.cos(rad) - seatW / 2,
      top: cy + ry * Math.sin(rad) - seatH / 2,
    });
  }
  return positions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsx --test utils/__tests__/tableLayout.test.ts`
Expected: 5 passing. If the 6-opponent overlap test fails, widen `ARC_START_DEG`/`ARC_END_DEG` symmetrically (e.g. 142/398) rather than shrinking seats.

- [ ] **Step 5: Create `frontend/components/OpponentSeat.tsx`**

```typescript
// Compact seat chip pinned to the oval table edge for one opponent.

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../utils/theme';
import { bidStatus, BID_STATUS_COLORS, BID_STATUS_LABELS, scoreColor } from '../utils/bidStatus';

export interface SeatPlayer {
  id: string;
  name: string;
  bid: number | null;
  has_bid: boolean;
  tricks_won: number;
  total_score: number;
  card_count: number;
  is_connected: boolean;
}

interface Props {
  player: SeatPlayer;
  isTurn: boolean;
  isDealer: boolean;
  phase: string;
  style?: ViewStyle;
}

export default function OpponentSeat({ player, isTurn, isDealer, phase, style }: Props) {
  const hasBid = player.has_bid || player.bid !== null;
  const st = hasBid ? bidStatus(player.bid, player.tricks_won) : 'pending';
  const statusLabel = BID_STATUS_LABELS[st];

  return (
    <View
      testID={`opponent-${player.id}`}
      style={[styles.seat, isTurn && styles.seatActive, !player.is_connected && styles.seatOffline, style]}
    >
      <View style={styles.topRow}>
        <View style={[styles.avatar, isTurn && styles.avatarActive]}>
          <Text style={styles.avatarText}>{player.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
        {isDealer && <Text style={styles.dealerBadge}>D</Text>}
      </View>
      <View style={styles.bottomRow}>
        {hasBid ? (
          <Text style={[styles.bidLine, { color: BID_STATUS_COLORS[st] }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {`${player.bid}/${player.tricks_won}${statusLabel ? ` ${statusLabel}` : ''}`}
          </Text>
        ) : (
          <Text style={styles.bidLine} numberOfLines={1}>
            {phase === 'bidding' ? 'bidding…' : `${player.card_count} cards`}
          </Text>
        )}
        <Text style={[styles.score, { color: scoreColor(player.total_score) }]} numberOfLines={1}>
          {player.total_score}
        </Text>
      </View>
      {!player.is_connected && <Text style={styles.offline}>Offline</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  seat: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(8, 24, 17, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
    gap: 3,
  },
  seatActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(243,229,171,0.1)',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  seatOffline: {
    opacity: 0.75,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: COLORS.gold,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
  },
  name: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  dealerBadge: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bidLine: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  score: {
    fontSize: 11,
    fontWeight: '800',
  },
  offline: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '700',
  },
});
```

Note the bid line format change: `Bid 2 Won 1` becomes `2/1` + status word — it never truncates at seat width, and the "?" help screen is where the notation gets explained if needed.

- [ ] **Step 6: Rework `game.tsx` — replace the two stage blocks with the oval stage**

6a. Imports:

```typescript
import OpponentSeat from '../components/OpponentSeat';
import { seatPositions, seatSize } from '../utils/tableLayout';
```

6b. Add stage-measurement state with the other `useState` hooks:

```typescript
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
```

6c. Delete the `getOpponentSeatStyle` function (lines defining it) — replaced by `seatPositions`.

6d. In the main-table JSX, delete everything from `<View style={styles.opponentStage}>` through the closing tag of `<View style={styles.centerStage}>` (both blocks), and replace with:

```typescript
          <View
            style={styles.ovalStage}
            onLayout={(e) => setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          >
            {stageSize.w > 0 && (() => {
              const { width: seatW, height: seatH } = seatSize(opponents.length, stageSize.w);
              const positions = seatPositions(opponents.length, stageSize.w, stageSize.h, seatW, seatH);
              return (
                <>
                  <View
                    style={[
                      styles.tableSurface,
                      {
                        left: seatW * 0.5,
                        right: seatW * 0.5,
                        top: seatH * 0.8,
                        bottom: seatH * 0.3,
                        borderRadius: Math.max(60, (stageSize.h - seatH * 1.1) / 2),
                      },
                    ]}
                  >
                    {currentPlayerOffline && (phase === 'playing' || phase === 'bidding') && (
                      <OfflineRecoveryBanner
                        name={currentPlayer.name}
                        remaining={forceRemaining}
                        isHost={isHost}
                        onForce={() => void sendAction({ action: 'force_action' }, 'medium')}
                      />
                    )}

                    {trickResult && (
                      <Animated.View
                        style={[
                          styles.trickResultCard,
                          {
                            opacity: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }),
                            transform: [
                              { scale: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.trickWinnerText}>{trickResult.winner_name} took the trick</Text>
                      </Animated.View>
                    )}

                    {displayTrickCards && displayTrickCards.length > 0 ? (
                      <View style={styles.trickCards}>
                        {displayTrickCards.map((tc: any, i: number) => {
                          const isWinner = trickResult && tc.player_index === trickResult.winner_index;
                          return (
                            <View key={i} style={styles.trickCardWrap}>
                              <View style={isWinner ? styles.winnerHighlight : undefined}>
                                <PlayingCard card={tc.card} size="trick" highlighted={isWinner} />
                              </View>
                              <Text style={styles.trickCardName}>
                                {players[tc.player_index]?.name || '?'}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <Text style={styles.tableCenterLabel}>
                        {phase === 'bidding'
                          ? isMyTurn
                            ? 'Your turn to bid'
                            : `Waiting for ${currentPlayerName} to bid`
                          : isMyTurn
                            ? 'Your turn — play a card'
                            : `Waiting for ${currentPlayerName} to ${gameState.current_trick.length === 0 ? 'lead' : 'play'}`}
                      </Text>
                    )}

                    {displayTrickCards && displayTrickCards.length > 0 && !trickResult && (
                      <Animated.Text
                        style={[
                          styles.tableTurnHint,
                          isMyTurn && styles.tableTurnHintActive,
                          { opacity: turnPulse.interpolate({ inputRange: [0.2, 1], outputRange: [0.7, 1] }) },
                        ]}
                      >
                        {isMyTurn ? 'Your turn' : `Waiting for ${currentPlayerName}`}
                      </Animated.Text>
                    )}
                  </View>

                  {opponents.map((opp, index) => {
                    const oppIdx = players.findIndex((p) => p.id === opp.id);
                    return (
                      <OpponentSeat
                        key={opp.id}
                        player={opp}
                        isTurn={gameState.current_player_index === oppIdx}
                        isDealer={gameState.dealer_index === oppIdx}
                        phase={phase}
                        style={{ ...positions[index], width: seatW, minHeight: seatH }}
                      />
                    );
                  })}
                </>
              );
            })()}
          </View>
```

6e. Styles — add:

```typescript
  ovalStage: {
    flex: 1,
    position: 'relative',
    marginVertical: 4,
  },
  tableSurface: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(15, 43, 29, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
    overflow: 'hidden',
  },
  tableCenterLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tableTurnHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tableTurnHintActive: {
    color: COLORS.gold,
  },
```

6f. Delete now-dead styles from the StyleSheet: `opponentStage`, `opponentSeat`, `opponentSeatActive`, `opponentSeatTop`, `seatAvatar`, `seatAvatarActive`, `seatAvatarText`, `opponentSeatMeta`, `seatNameRow`, `opponentName`, `opponentScore`, `opponentBody`, `centerStage`, `turnBanner`, `turnText`, `turnTextActive`, `trickTable`, `tableHeaderRow`, `tableHeaderLabel`, `tableHeaderBadge`, `emptyTrick`, `emptyTrickLabel`, `disconnected`, and the legacy unused `opponentsScroll`, `opponentsContent`, `oppCard`, `oppCardActive`, `oppTop`, `oppName`, `oppBid`, `oppScore`, `infoBar`, `infoItem`, `infoValue`, `infoLabel`, `leaveBtn`, `trickArea`, `handLabel`, `handContent`. Keep `dealerBadge` only if still referenced (it moves into `OpponentSeat.tsx`; delete from `game.tsx` if unreferenced). Run the typecheck after deleting — anything still referenced will error; restore just those.

6g. Task 3's opponent-seat edits (6a/6b of Task 3) are superseded by `OpponentSeat.tsx` — remove the now-unused inline seat rendering remnants and the `bidStatus`/`BID_STATUS_*` imports from `game.tsx` **only if** no longer referenced (the self dock still uses them — keep those).

- [ ] **Step 7: Typecheck + run all frontend tests**

```bash
cd ~/Desktop/Projects/judgement_app/frontend && npx tsc --noEmit && npx tsx --test utils/__tests__/*.test.ts
```
Expected: no type errors, all tests pass.

- [ ] **Step 8: Visual verification (browser, 3 players)**

Start backend + frontend (see repo docs; remember the LAN IP only matters for phones — browser tabs can use localhost). Open three browser tabs at 390px width, create/join a room, start a game, verify:
- Seats sit around an oval table, none overlapping, none clipped.
- Empty-table copy is turn-aware ("Waiting for X to lead" vs "Your turn — play a card").
- Active seat has the strong gold border + glow.
- No "TABLE" caption anywhere; the mid-screen dead zone is gone (table fills it).
- Close one tab mid-turn → remaining tabs show the offline banner inside the table; host gets "Play for X" after 15s and it unblocks the game.

- [ ] **Step 9: Commit**

```bash
git add frontend/utils/tableLayout.ts frontend/utils/__tests__/tableLayout.test.ts frontend/components/OpponentSeat.tsx frontend/app/game.tsx
git commit -m "feat: oval table layout — seats surround the table, turn-aware copy, dead space removed

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Card-play animation + subtle sound

**Files:**
- Create: `frontend/assets/sounds/card-flick.wav` (generated)
- Create: `frontend/utils/useCardSound.ts`
- Create: `frontend/components/TrickCardEntry.tsx`
- Modify: `frontend/app/game.tsx`, `frontend/package.json` (add `expo-audio`)

**Interfaces:**
- Consumes: trick card rendering from Task 5 (`styles.trickCardWrap` map in the table surface).
- Produces:
  - `useCardSound(): () => void` — returns a fire-and-forget play function.
  - `<TrickCardEntry animate={boolean}>` — wraps a trick card; runs a one-time mount animation (rise + scale + settle) when `animate` is true.

- [ ] **Step 1: Install expo-audio**

```bash
cd ~/Desktop/Projects/judgement_app/frontend && npx expo install expo-audio
```

(`npx expo install` picks the SDK-54-compatible version.)

- [ ] **Step 2: Generate the sound asset**

Run from the repo root:

```bash
mkdir -p frontend/assets/sounds && python3 - <<'EOF'
import wave, struct, math, random
sr, dur = 22050, 0.09
random.seed(7)
frames = []
for i in range(int(sr * dur)):
    t = i / sr
    env = math.exp(-t * 65)
    s = (random.uniform(-1, 1) * 0.55 + math.sin(2 * math.pi * 1700 * t) * 0.45) * env * 0.45
    frames.append(struct.pack('<h', int(max(-1, min(1, s)) * 32767)))
with wave.open('frontend/assets/sounds/card-flick.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    w.writeframes(b''.join(frames))
print('wrote', len(frames), 'frames')
EOF
```

Expected output: `wrote 1984 frames`. This is a ~90ms damped noise burst — a soft card "flick", intentionally quiet (0.45 peak).

- [ ] **Step 3: Create `frontend/utils/useCardSound.ts`**

```typescript
// Fire-and-forget card-flick sound. Browsers block audio until the user
// has interacted with the page; every card play IS a tap for the local
// player, and for remote plays the join/bid taps have already unlocked
// audio, so failures are safely swallowed.

import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const source = require('../assets/sounds/card-flick.wav');

export function useCardSound(): () => void {
  const player = useAudioPlayer(source);
  // Memoized: this callback goes into the WebSocket connect effect's
  // dependency array — an unstable identity would reconnect every render.
  return useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // audio not unlocked yet or unsupported — silent no-op
    }
  }, [player]);
}
```

- [ ] **Step 4: Create `frontend/components/TrickCardEntry.tsx`**

```typescript
// One-time mount animation for a card landing on the table: rises from
// the hand direction, scales up, settles with a slight rotation.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

interface Props {
  animate: boolean;
  children: React.ReactNode;
}

export default function TrickCardEntry({ animate, children }: Props) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [animate, reduceMotion, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 5: Wire into `game.tsx`**

5a. Imports:

```typescript
import TrickCardEntry from '../components/TrickCardEntry';
import { useCardSound } from '../utils/useCardSound';
```

5b. Hook + trick-length tracking (with the other hooks near the top of `GameScreen`):

```typescript
  const playCardSound = useCardSound();
  const prevTrickLenRef = useRef(0);
```

5c. In `socket.onmessage`, inside the `data.type === 'state'` branch (after `setGameState(data);`):

```typescript
          const trickLen = (data.current_trick || []).length;
          if (trickLen > prevTrickLenRef.current) {
            playCardSound();
          }
          prevTrickLenRef.current = trickLen;
```

Also add `playCardSound` to the `connect` useCallback dependency array.

5d. In the trick-card map inside the table surface (Task 5's block), wrap the card in the entry animation — only the newest card animates, and never during the frozen `trickResult` replay:

```typescript
                          return (
                            <View key={i} style={styles.trickCardWrap}>
                              <TrickCardEntry animate={!trickResult && i === displayTrickCards.length - 1}>
                                <View style={isWinner ? styles.winnerHighlight : undefined}>
                                  <PlayingCard card={tc.card} size="trick" highlighted={isWinner} />
                                </View>
                              </TrickCardEntry>
                              <Text style={styles.trickCardName}>
                                {players[tc.player_index]?.name || '?'}
                              </Text>
                            </View>
                          );
```

Mount-animation semantics: each trick card mounts once (stable `key={i}` within a trick), so the animation runs exactly once per card even as later broadcasts re-render the list. When the trick clears, the array resets and the next lead card mounts fresh.

- [ ] **Step 6: Typecheck**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Verify in browser**

Two browser tabs, start a game, play a card: the card rises onto the table with a settle, and a soft flick sound plays in both tabs (the observer tab needs any prior interaction — bidding counts). With OS reduce-motion enabled, the card appears without motion.

- [ ] **Step 8: Commit**

```bash
git add frontend/assets/sounds/card-flick.wav frontend/utils/useCardSound.ts frontend/components/TrickCardEntry.tsx frontend/app/game.tsx frontend/package.json yarn.lock
git commit -m "feat: card-play entry animation + subtle flick sound via expo-audio

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] `cd backend && python -m pytest tests/ -q` — all green.
- [ ] `cd frontend && npx tsc --noEmit && npx tsx --test utils/__tests__/*.test.ts` — all green.
- [ ] Full playthrough in 3 browser tabs (V1): lobby → bid → play a full round → round end. Confirm every review point visually against the two original screenshots.
- [ ] On-device check via Expo Go: run `ipconfig getifaddr en0`, update `frontend/.env` `EXPO_PUBLIC_BACKEND_URL` with the current LAN IP first (it changes between sessions).
- [ ] 7-player stress check: open 7 tabs, confirm 6 seats render without overlap on a 390px-wide viewport.
