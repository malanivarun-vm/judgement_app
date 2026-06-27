# How-to-Play Redesign

**Date:** 2026-06-27
**Scope:** Terminology rename, first-load behaviour, 10-slide carousel rewrite, waiting-room link, game-mode "Let's Play" button, Quick Reference slide.

---

## 1. Terminology (canonical — applies everywhere in the codebase)

| Term | Meaning |
|------|---------|
| **Game** | The complete Judgement session from start to finish, across all sessions. |
| **Session** | One deal cycle — cards dealt, predictions made, all rounds played. Replaces "round" everywhere. |
| **Round** | Everyone plays one card; the winner takes the cards. Replaces "trick" everywhere. |
| **Prediction** | The number of rounds a player thinks they'll win in a session. Replaces "bid" everywhere. |
| **Trump Suit** | The special suit that beats all other suits that session. |

### Rename map (find → replace, all files)

| Old | New |
|-----|-----|
| trick / tricks | round / rounds |
| round / rounds (deal cycle) | session / sessions |
| bid / bids | prediction / predictions |
| "Rd 1, Rd 2…" labels (TrumpRotationScene) | "Sn 1, Sn 2…" |
| "How many tricks will you win?" (BidScene) | "How many rounds will you win?" |
| SCORE_ROWS "Zero bid, 0 tricks" / "any tricks" | "Zero prediction, 0 rounds" / "any rounds" |
| VARIATIONS descriptions "each round" | "each session" |

---

## 2. First-load behaviour change

**Current:** `index.tsx` `useEffect` (lines 41–46) auto-redirects first-time users to `/how-to-play` before they see the home screen.

**New:** Remove that `useEffect` entirely. Users land on the home screen. The existing "New to Judgement? How to Play →" link handles discovery.

No other changes to routing or `HAS_SEEN_HOW_TO_PLAY_KEY` logic.

---

## 3. How-to-Play carousel (10 slides)

Shell: `SlideShell` unchanged. `how-to-play.tsx` SLIDES array replaced with 10 entries.

### Slide 1 — Welcome to Judgement
- **Kicker:** WHAT'S THE GOAL?
- **Heading:** Predict exactly how many rounds you'll win.
- **Body:** Every player declares their prediction before play. Hit it exactly and you score. Miss it and you don't. The player with the most points at the end of the game wins.
- **Scene:** Keep `IntroScene` (four suits).

### Slide 2 — How a Game Works
- **Kicker:** HOW IS A GAME STRUCTURED?
- **Heading:** Game → Sessions → Rounds.
- **Body:** A game runs through multiple sessions. Each session deals a fixed number of cards — starting at the maximum, dropping by 1 each session down to 1. Inside each session everyone plays as many rounds as they have cards. If 52 doesn't divide evenly among players, the extra cards are set aside and not used.
- **Scene:** New `GameStructureScene` — vertical or horizontal hierarchy diagram: Game block → Session blocks → Round pips.

### Slide 3 — Predictions
- **Kicker:** HOW DO I MAKE A PREDICTION?
- **Heading:** Before each session, predict how many rounds you'll win.
- **Body:** All players declare after seeing their cards. The goal is to match your prediction exactly — not exceed it, not fall short.
- **Scene:** Keep `BidScene`. Update internal label to "How many rounds will you win?".

### Slide 4 — Card Ranking
- **Kicker:** HOW DO CARDS RANK?
- **Heading:** Ace is high. 2 is low.
- **Body:** A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2. Suit doesn't affect rank — except when trump changes everything.
- **Scene:** New `CardRankScene` — horizontal strip of rank labels (A K Q J 10 … 2) with A highlighted.

### Slide 5 — Trump Suit
- **Kicker:** WHAT IS THE TRUMP SUIT?
- **Heading:** Trump beats every other suit.
- **Body:** One suit is designated trump each session. Any trump card beats any non-trump card regardless of rank. In Classic mode trump rotates every session: ♥ → ♠ → ♦ → ♣.
- **Scene:** Keep `TrumpRotationScene`. Update badge labels "Rd 1…" → "Sn 1…".

### Slide 6 — Playing a Round
- **Kicker:** HOW DO I WIN A ROUND?
- **Heading:** Lead any card. Follow suit if you can.
- **Body:** Can't follow suit? Play trump or any card. Highest trump wins. No trump played? Highest card of the lead suit wins.
- **Scene:** Keep `TrickScene` (no changes needed).

### Slide 7 — Scoring
- **Kicker:** HOW DOES SCORING WORK?
- **Heading:** Exact predictions score. Misses punish.
- **Body:** Hit your prediction exactly — earn points. Miss — lose points. Predict zero and take no rounds for a big bonus.
- **Scene:** Keep `ScoreScene`. Update SCORE_ROWS labels per terminology map.

### Slide 8 — Dealer Rule
- **Kicker:** WHAT SPECIAL RULES SHOULD I KNOW?
- **Heading:** The dealer can't let everyone break even.
- **Body:** The dealer predicts last and is blocked from any number that would make total predictions equal the rounds in that session. Someone has to be wrong.
- **Scene:** None (text-only slide).

### Slide 9 — Quick Reference
- **Kicker:** QUICK REFERENCE
- **Heading:** Keep this handy.
- **Body:** None (content is in the scene).
- **Scene:** New `QuickRefScene` — compact table with four sections:
  - **Scoring:** Exact → +prediction × 10 | Miss → −prediction × 10 | Zero prediction, 0 rounds → +25 | Zero prediction, any rounds → −25
  - **Card rank:** A > K > Q > J > 10 … 2
  - **Classic trump order:** ♥ → ♠ → ♦ → ♣
  - **Dealer rule:** Can't make total predictions = rounds in session

### Slide 10 — Choose Your Mode
- **Kicker:** YOU'RE READY
- **Heading:** Four ways to play Judgement.
- **Body:** The host picks a mode before the game starts. Tap below to explore what makes each one different.
- **Scene:** None.
- **Behaviour:** "Next →" navigates to `/game-modes`. This slide is `isLast` by index, but `SlideShell` must show "Next →" not "Done" here, so pass `isLast={current === SLIDES.length - 1 && !isModeSlide}` to suppress the Done button on this slide.

### Navigation changes in `how-to-play.tsx`
- `isModeSlide` check: update index from `6` → `9`.
- `isLast` prop passed to SlideShell: `current === SLIDES.length - 1 && !isModeSlide` — this prevents the Done button appearing on the mode slide (index 9), so "Next →" is shown and `goToModes` fires.
- `SLIDES.length` drives progress dots automatically.
- `lockDone` / `doneUnlocked` logic unchanged.

---

## 4. New scenes to build

### `GameStructureScene`
Visual hierarchy: three levels — "Game" (top, gold) → row of "Session" badges → row of "Round" pips. Static, no animation. Keeps the same `sceneZone` constraints (height 200, centred).

### `CardRankScene`
Horizontal scrolling (or wrapping) strip: rank labels rendered as small card-like chips in order A K Q J 10 9 8 7 6 5 4 3 2. Ace chip highlighted in gold. Uses `PlayingCard` or inline styled chips.

### `QuickRefScene`
Compact two-column table inside the sceneZone. Four row groups separated by a thin border. Labels in `COLORS.textSecondary`, values in `COLORS.text` or colour-coded (green for positive, red for negative). Reuses the same visual pattern as `ScoreScene`.

---

## 5. Waiting-room link

**Where:** `game.tsx` — the UI state shown while players are waiting for the host to start (pre-game lobby).

**What:** Add a text link "How to Play →" that pushes `/how-to-play?lockDone=false`. The `lockDone=false` param (already supported by `how-to-play.tsx` line 67) disables the forced read-through so players can exit freely.

**Placement:** Below the player list / room code display, low-hierarchy — secondary text style, same as the home screen's "How to Play →" link.

---

## 6. Game-mode "Let's Play" button

**Where:** `app/game-modes/[modeKey].tsx` — the detail card for each individual mode.

**What:** The last slide of each mode carousel shows a gold "Let's Play →" button instead of the current "Done" button. Tapping it navigates to the home screen (`/`).

**Implementation:** `SlideShell` already renders the primary button label as "Done" when `isLast=true`. Add an optional `doneLabel` prop to `SlideShell` (default `'Done'`). In `[modeKey].tsx`, pass `doneLabel="Let's Play →"` and change `onDone={() => router.back()}` to `onDone={() => router.push('/')}`.

**Placement:** Same position as the existing Done button — bottom-right primary action. No layout changes needed.

---

## 7. Files changed

| File | Change |
|------|--------|
| `frontend/app/index.tsx` | Remove `useEffect` auto-redirect (lines 41–46) |
| `frontend/app/how-to-play.tsx` | Replace SLIDES array (10 entries), update `isModeSlide` index |
| `frontend/app/game.tsx` | Add "How to Play →" link in waiting-room state |
| `frontend/app/game-modes/[modeKey].tsx` | Add "Let's Play" gold button |
| `frontend/components/how-to-play/scenes/BidScene.tsx` | Update label text |
| `frontend/components/how-to-play/scenes/TrumpRotationScene.tsx` | Update "Rd→" labels to "Sn→" |
| `frontend/utils/variations.ts` | Update SCORE_ROWS labels, VARIATIONS descriptions |
| `frontend/components/how-to-play/scenes/GameStructureScene.tsx` | **New file** |
| `frontend/components/how-to-play/scenes/CardRankScene.tsx` | **New file** |
| `frontend/components/how-to-play/scenes/QuickRefScene.tsx` | **New file** |

---

## 8. Out of scope

- Game-modes screen content or layout (beyond the "Let's Play" button on detail cards).
- Backend changes (terminology is frontend-only; backend uses internal variable names).
- Scoring logic or game mechanics (no changes to `game_engine.py`).
- The `HAS_SEEN_HOW_TO_PLAY_KEY` AsyncStorage key or its value — behaviour unchanged, key name unchanged.
