# Copy & Share Room Code Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Copy button and a Share button to the lobby's room-code box, plus a deep link (`?code=XXXX`) that pre-fills the join form, with the player's name remembered across sessions.

**Architecture:** Pure helper functions in `frontend/utils/share.ts` (unit-tested with `node --test` + tsx) are consumed by two screens: `app/game.tsx` (lobby: Copy/Share buttons) and `app/index.tsx` (deep-link prefill + name persistence via AsyncStorage). No backend changes.

**Tech Stack:** Expo 54 / React Native 0.81 / expo-router 6 / TypeScript strict. New deps: `expo-clipboard` (runtime), `tsx` (dev). Already installed: `@react-native-async-storage/async-storage`, `expo-haptics`, `@expo/vector-icons`.

**Spec:** `docs/superpowers/specs/2026-07-03-copy-share-room-code-design.md`

## Global Constraints

- All work happens in `frontend/`; the working directory for every command is `~/Desktop/Projects/judgement_app/frontend` unless a path says otherwise. Git commands run from the repo root (`~/Desktop/Projects/judgement_app`).
- Package manager is **yarn 1** (`yarn add`, not npm). Expo-managed native deps use `npx expo install`.
- Styling: React Native `StyleSheet.create` only, colors from `COLORS` in `utils/theme.ts`. No inline hex values.
- Share message copy (exact, `\n`-separated):
  `Hey, join my Judgement game! 🃏` / `Room code: <CODE>` / `Tap to join: <origin>/?code=<CODE>` — the third line is omitted when origin is empty.
- Room codes are exactly 4 ASCII letters, normalized to uppercase.
- localStorage key name (via AsyncStorage): `judgement_player_name`.
- Match existing code style: no semicolon-free style changes, no console.log, existing haptic helpers reused.
- React hooks must be declared at component top level (never inside the `if (phase === 'waiting')` block in game.tsx).

---

### Task 1: Share helpers + frontend test infrastructure

**Files:**
- Create: `frontend/utils/share.ts`
- Create: `frontend/tests/share.test.ts`
- Modify: `frontend/package.json` (add `tsx` devDependency and `test` script)

**Interfaces:**
- Produces: `buildShareMessage(roomCode: string, origin: string): string` and `parseRoomCodeParam(raw: unknown): string | null`, both exported from `frontend/utils/share.ts`. Task 2 imports `parseRoomCodeParam`; Task 3 imports `buildShareMessage`.

- [ ] **Step 1: Install tsx and add the test script**

Run:
```bash
cd ~/Desktop/Projects/judgement_app/frontend
yarn add -D tsx
```

Then in `frontend/package.json`, add to `"scripts"`:

```json
"test": "node --import tsx --test tests/"
```

- [ ] **Step 2: Write the failing tests**

Create `frontend/tests/share.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareMessage, parseRoomCodeParam } from '../utils/share';

test('buildShareMessage includes code and join link', () => {
  const msg = buildShareMessage('NLVW', 'https://judgement.vercel.app');
  assert.equal(
    msg,
    'Hey, join my Judgement game! 🃏\nRoom code: NLVW\nTap to join: https://judgement.vercel.app/?code=NLVW'
  );
});

test('buildShareMessage strips trailing slash from origin', () => {
  const msg = buildShareMessage('ABCD', 'https://judgement.vercel.app/');
  assert.ok(msg.endsWith('Tap to join: https://judgement.vercel.app/?code=ABCD'));
});

test('buildShareMessage omits link line when origin is empty', () => {
  const msg = buildShareMessage('NLVW', '');
  assert.equal(msg, 'Hey, join my Judgement game! 🃏\nRoom code: NLVW');
});

test('buildShareMessage uppercases the code', () => {
  const msg = buildShareMessage('nlvw', '');
  assert.ok(msg.includes('Room code: NLVW'));
});

test('parseRoomCodeParam accepts a valid 4-letter code', () => {
  assert.equal(parseRoomCodeParam('NLVW'), 'NLVW');
});

test('parseRoomCodeParam normalizes lowercase and whitespace', () => {
  assert.equal(parseRoomCodeParam('  nlvw '), 'NLVW');
});

test('parseRoomCodeParam takes first element of an array param', () => {
  assert.equal(parseRoomCodeParam(['abcd', 'zzzz']), 'ABCD');
});

test('parseRoomCodeParam rejects invalid values', () => {
  assert.equal(parseRoomCodeParam(undefined), null);
  assert.equal(parseRoomCodeParam(null), null);
  assert.equal(parseRoomCodeParam(''), null);
  assert.equal(parseRoomCodeParam('ABC'), null);
  assert.equal(parseRoomCodeParam('ABCDE'), null);
  assert.equal(parseRoomCodeParam('AB1D'), null);
  assert.equal(parseRoomCodeParam(42), null);
  assert.equal(parseRoomCodeParam([]), null);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && yarn test`
Expected: FAIL — cannot find module `../utils/share`.

- [ ] **Step 4: Implement the helpers**

Create `frontend/utils/share.ts`:

```ts
// Pure helpers for room-code sharing. No React Native imports — keep this
// file testable under plain Node.

const CODE_PATTERN = /^[A-Z]{4}$/;

export function parseRoomCodeParam(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function buildShareMessage(roomCode: string, origin: string): string {
  const code = roomCode.trim().toUpperCase();
  const lines = [`Hey, join my Judgement game! 🃏`, `Room code: ${code}`];
  const base = origin.replace(/\/+$/, '');
  if (base) {
    lines.push(`Tap to join: ${base}/?code=${code}`);
  }
  return lines.join('\n');
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && yarn test`
Expected: PASS — 8 tests, 0 failures.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/Projects/judgement_app
git add frontend/utils/share.ts frontend/tests/share.test.ts frontend/package.json frontend/yarn.lock
git commit -m "feat: share message and room-code param helpers with test infra"
```

---

### Task 2: Deep-link prefill + player-name persistence (index.tsx)

**Files:**
- Modify: `frontend/app/index.tsx`

**Interfaces:**
- Consumes: `parseRoomCodeParam(raw: unknown): string | null` from `../utils/share` (Task 1).
- Produces: opening the app at `/?code=NLVW` pre-fills the room-code field; the last-used player name auto-fills on every visit. No exports consumed by other tasks.

- [ ] **Step 1: Add imports**

In `frontend/app/index.tsx`, change the expo-router import (line 18) from:

```ts
import { useRouter } from 'expo-router';
```

to:

```ts
import { useRouter, useLocalSearchParams } from 'expo-router';
```

and add below the existing imports (after the `COLORS, SUIT_SYMBOLS` import):

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseRoomCodeParam } from '../utils/share';
```

Add the storage key constant next to the existing `BACKEND_URL` constant:

```ts
const PLAYER_NAME_KEY = 'judgement_player_name';
```

- [ ] **Step 2: Read the deep-link param and load the saved name**

Inside `HomeScreen`, immediately after `const router = useRouter();`, add:

```ts
const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
```

Then, after the existing `reduceMotion` `useEffect` (the one calling `AccessibilityInfo.isReduceMotionEnabled()`), add two effects:

```ts
useEffect(() => {
  const parsed = parseRoomCodeParam(codeParam);
  if (parsed) setRoomCode(parsed);
}, [codeParam]);

useEffect(() => {
  AsyncStorage.getItem(PLAYER_NAME_KEY)
    .then((saved) => {
      if (saved) setPlayerName((current) => current || saved);
    })
    .catch(() => {
      // storage unavailable — name entry stays manual
    });
}, []);
```

- [ ] **Step 3: Save the name when creating or joining**

In `createRoom`, after the `const playerId = generateId();` line and before `router.push({`, add:

```ts
void AsyncStorage.setItem(PLAYER_NAME_KEY, playerName.trim()).catch(() => {});
```

In `joinRoom`, after its `const playerId = generateId();` line and before its `router.push({`, add the identical line:

```ts
void AsyncStorage.setItem(PLAYER_NAME_KEY, playerName.trim()).catch(() => {});
```

- [ ] **Step 4: Verify types and tests**

Run:
```bash
cd ~/Desktop/Projects/judgement_app/frontend
npx tsc --noEmit
yarn test
```
Expected: tsc exits 0 (no new errors); tests still PASS (8/8).

- [ ] **Step 5: Manual verification (dev server)**

Run: `cd ~/Desktop/Projects/judgement_app/frontend && npx expo start --web` (or use the already-running dev server on port 8081).

In a browser open `http://localhost:8081/?code=nlvw` — the "Have a code?" field must show `NLVW`. Open `http://localhost:8081/?code=bad1` — the field must stay empty. Enter a name, create a room, go back, reload the page — the name field must be pre-filled.

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/Projects/judgement_app
git add frontend/app/index.tsx
git commit -m "feat: deep-link room-code prefill and player-name persistence"
```

---

### Task 3: Copy & Share buttons in the lobby (game.tsx)

**Files:**
- Modify: `frontend/app/game.tsx`
- Modify: `frontend/package.json` + `frontend/yarn.lock` (expo-clipboard)

**Interfaces:**
- Consumes: `buildShareMessage(roomCode: string, origin: string): string` from `../utils/share` (Task 1); existing `fireHaptic(kind)` callback at `game.tsx:128`; existing `gameState.room_id`.
- Produces: UI only; nothing consumed by other tasks.

- [ ] **Step 1: Install expo-clipboard**

Run:
```bash
cd ~/Desktop/Projects/judgement_app/frontend
npx expo install expo-clipboard
```

- [ ] **Step 2: Add imports**

In `frontend/app/game.tsx`, add `Share` to the `react-native` import block (lines 2–16), after `Alert,`:

```ts
  Share,
```

Below the existing `import * as Haptics from 'expo-haptics';` line, add:

```ts
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { buildShareMessage } from '../utils/share';
```

- [ ] **Step 3: Add copied-state and handlers at component top level**

Hooks must NOT go inside the `if (phase === 'waiting')` block. Immediately after the existing `fireHaptic` `useCallback` (ends around line 145), add:

```ts
const [codeCopied, setCodeCopied] = useState(false);
const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

useEffect(() => {
  return () => {
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
  };
}, []);

const getShareOrigin = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
    return window.location.origin;
  }
  return '';
};

const copyRoomCode = async (roomId: string) => {
  try {
    await Clipboard.setStringAsync(roomId);
    void fireHaptic('light');
    setCodeCopied(true);
    if (copiedTimer.current) clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCodeCopied(false), 1500);
  } catch {
    Alert.alert('Copy failed', `Room code: ${roomId}`);
  }
};

const shareRoomCode = async (roomId: string) => {
  const message = buildShareMessage(roomId, getShareOrigin());
  void fireHaptic('selection');
  try {
    if (Platform.OS === 'web') {
      const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
      if (nav?.share) {
        await nav.share({ text: message });
      } else {
        await Clipboard.setStringAsync(message);
        Alert.alert('Message copied', 'Paste it anywhere to invite friends');
      }
    } else {
      await Share.share({ message });
    }
  } catch {
    // user dismissed the share sheet — not an error
  }
};
```

- [ ] **Step 4: Add the buttons to the room-code box**

In the lobby JSX (`game.tsx:395-399`), replace:

```tsx
<View style={styles.roomCodeBox}>
  <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
  <Text style={styles.roomCode}>{gameState.room_id}</Text>
  <Text style={styles.roomCodeHint}>Share this code with friends</Text>
</View>
```

with:

```tsx
<View style={styles.roomCodeBox}>
  <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
  <Text style={styles.roomCode}>{gameState.room_id}</Text>
  <Text style={styles.roomCodeHint}>Share this code with friends</Text>
  <View style={styles.roomCodeActions}>
    <TouchableOpacity
      testID="copy-code-btn"
      style={styles.roomCodeActionBtn}
      onPress={() => void copyRoomCode(gameState.room_id)}
      activeOpacity={0.7}
      accessibilityLabel="Copy room code"
    >
      <Ionicons
        name={codeCopied ? 'checkmark' : 'copy-outline'}
        size={16}
        color={codeCopied ? COLORS.success : COLORS.gold}
      />
      <Text style={[styles.roomCodeActionText, codeCopied && styles.roomCodeActionTextDone]}>
        {codeCopied ? 'Copied!' : 'Copy'}
      </Text>
    </TouchableOpacity>
    <TouchableOpacity
      testID="share-code-btn"
      style={styles.roomCodeActionBtn}
      onPress={() => void shareRoomCode(gameState.room_id)}
      activeOpacity={0.7}
      accessibilityLabel="Share room code"
    >
      <Ionicons name="share-social-outline" size={16} color={COLORS.gold} />
      <Text style={styles.roomCodeActionText}>Share</Text>
    </TouchableOpacity>
  </View>
</View>
```

- [ ] **Step 5: Add styles**

In the `StyleSheet.create` block of `game.tsx`, directly after the existing `roomCodeHint` style (around line 1084-1088), add:

```ts
roomCodeActions: {
  flexDirection: 'row',
  gap: 12,
  marginTop: 12,
},
roomCodeActionBtn: {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  borderWidth: 1,
  borderColor: COLORS.borderAccent,
  borderRadius: 20,
  paddingVertical: 10,
  paddingHorizontal: 18,
  minHeight: 44,
},
roomCodeActionText: {
  color: COLORS.gold,
  fontSize: 13,
  fontWeight: '700',
  letterSpacing: 1,
},
roomCodeActionTextDone: {
  color: COLORS.success,
},
```

- [ ] **Step 6: Verify types and tests**

Run:
```bash
cd ~/Desktop/Projects/judgement_app/frontend
npx tsc --noEmit
yarn test
```
Expected: tsc exits 0; tests PASS (8/8).

- [ ] **Step 7: Manual verification (dev server)**

With `npx expo start --web` running and the backend up (`cd ~/Desktop/Projects/judgement_app/backend && ./venv/bin/uvicorn server:app --host 0.0.0.0 --port 8000` if not already running):

1. Create a room, land on the lobby.
2. Tap **Copy** → icon flips to a checkmark, label reads "Copied!" for ~1.5s, clipboard contains the bare 4-letter code.
3. Tap **Share** → on a mobile browser/PWA the OS share sheet opens with the 3-line message; on desktop Chrome/Firefox without Web Share, an alert says "Message copied" and the clipboard holds the full message including `/?code=XXXX`.
4. Paste the link into a new tab → home screen shows the code pre-filled (Task 2 round-trip).

- [ ] **Step 8: Commit**

```bash
cd ~/Desktop/Projects/judgement_app
git add frontend/app/game.tsx frontend/package.json frontend/yarn.lock
git commit -m "feat: copy and share buttons for lobby room code"
```
