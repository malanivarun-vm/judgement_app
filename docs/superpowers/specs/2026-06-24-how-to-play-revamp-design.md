# How to Play — Revamp Design Spec
**Date:** 2026-06-24  
**Status:** Approved

---

## Overview

Replace the existing `HowToPlayModal` (scrollable text modal) with a three-screen How to Play system: a universal rules carousel, a Game Modes list, and per-mode "what's different" carousels. Built using rendered React Native components sharing the existing design token system — no static image assets.

---

## Goals

- First-time players understand the full game before playing
- Hosts and non-hosts understand what each game mode entails before and during a game
- Tutorial content stays in sync with the UI automatically (no screenshot maintenance)
- Animations deferred to a future roadmap item

---

## Screen 1 — How to Play Carousel

**Route:** `/how-to-play`  
**Trigger:** Auto-shown on first launch (before Lobby). Accessible via persistent `?` help button on the game screen.  
**First-launch state:** Managed via `AsyncStorage` key `hasSeenHowToPlay`. Set to `true` on completion or skip.  
**"Done" button:** Ghosted until all 8 slides have been seen. Unlocks on reaching Slide 8. Skip is always visible.  
**When opened from in-game help:** "Done" lock is not applied — skip behaviour only.

### Slides

| # | Title | Scene Component | Key Content |
|---|-------|----------------|-------------|
| 1 | What is Judgement? | Four suit symbols arranged dramatically | Core premise: predict exactly how many tricks you'll win |
| 2 | Your Hand | Fanned hand of 5 cards | Cards dealt = floor(52 ÷ players), decreases by 1 each round down to 1 |
| 3 | Trump Suits Rotate | 4 suit badges in sequence, active one lit gold | ♥ → ♠ → ♦ → ♣ rotation; trump beats any non-trump card |
| 4 | Playing a Trick | 4 cards on a "table", winner highlighted | Follow suit if possible; highest trump wins; else highest of lead suit |
| 5 | Make Your Prediction | Bid picker UI | Bid clockwise; dealer bids last and cannot make total bids equal tricks available |
| 6 | Exact Bids Win | Colour-coded score table | Exact bid: +bid×10 / Miss: −bid×10 / Zero success: +25 / Zero fail: −25 |
| 7 | Choose Your Mode | — (text + link) | Intro to the 4 modes; CTA links to Screen 2 |
| 8 | Let's Play | — (full-bleed CTA) | "Done" button active; sets anticipation |

### Slide Layout (all slides)
- **Header:** "HOW TO PLAY" label + Skip button (top-right)
- **Scene zone:** Rendered React Native component, full-width, fixed height (~200px), dark surface card
- **Kicker:** Gold uppercase label (e.g. "TRUMP SUITS")
- **Title:** White, 20px, bold
- **Body:** Secondary text, 14px
- **Footer:** Progress dots (active dot wider, gold) + Back / Next buttons

### Scene Components
Each scene is a stateless, purpose-built component using `COLORS`, `CARD_SIZES`, and `SUIT_SYMBOLS` from `utils/theme.ts`. No animation in this version.

| Slide | Scene Component |
|-------|----------------|
| 1 | `IntroScene` — 4 suit symbols, large, arranged in a 2×2 or arc |
| 2 | `HandScene` — 5 fanned cards using existing card rendering |
| 3 | `TrumpRotationScene` — 4 suit badges in a row, active one highlighted with gold border |
| 4 | `TrickScene` — 4 cards laid flat, winning card lifted with a subtle border |
| 5 | `BidScene` — Simplified bid picker (number row, one number selected) |
| 6 | `ScoreScene` — Score table (reuses existing `SCORE_ROWS` data from `HowToPlayModal`) |
| 7 | — (no scene) |
| 8 | — (no scene) |

---

## Screen 2 — Game Modes

**Route:** `/game-modes`  
**Entry points:**
- Screen 1, Slide 7 — "Choose Your Mode" link
- Lobby → host taps mode selector (replaces or sits alongside current variation grid)
- Non-host in lobby → info icon next to active mode label

**Layout:** Scrollable list of 4 mode cards. Each card shows:
- Mode name (exact lobby name)
- One-line description (exact lobby description)
- Rule tags (e.g. "Fixed trump", "2-batch deal")
- Tap → opens Screen 3 for that mode

### Mode Cards (names and descriptions match lobby exactly)

| Key | Name | Description |
|-----|------|-------------|
| `v1` | Classic | Decreasing cards each round |
| `v1.1` | Fixed Rounds | Same cards every round |
| `v2` | Trump Call | Call trump after half the deal |
| `v3` | Bid First | Highest bidder picks trump |

---

## Screen 3 — Mode Carousels (×4)

**Route:** `/game-modes/:modeKey`  
**Content:** Only what differs from Classic. Assumes player has read Screen 1.  
**Navigation:** Back button returns to Screen 2. No "Done" lock — these are reference screens.

### Classic (`v1`) — 1 slide
| # | Content |
|---|---------|
| 1 | "This is the standard game." Confirms it matches everything taught in the main carousel. No deltas. |

### Fixed Rounds (`v1.1`) — 2 slides
| # | Content |
|---|---------|
| 1 | Host sets cards per round (constant throughout). Scene: configuration panel. |
| 2 | Host sets total number of rounds. Max = floor(52 ÷ players). Everything else identical to Classic. |

### Trump Call (`v2`) — 3 slides
| # | Content |
|---|---------|
| 1 | Cards are dealt in two batches: ceil(cards ÷ 2) first, remainder second. Scene: two card stacks. |
| 2 | After the first batch, the player left of dealer calls trump — before seeing their full hand. Scene: trump selection moment. |
| 3 | Second batch dealt, play proceeds normally. Scene: full hand. |

### Bid First (`v3`) — 3 slides
| # | Content |
|---|---------|
| 1 | Cards dealt in two batches (same as Trump Call). Scene: two card stacks. |
| 2 | Everyone bids after the first batch — before trump is set. Bidding blind. Scene: bid picker with trump = "?". |
| 3 | The highest bidder picks trump. Then the second batch is dealt and play begins. Scene: trump selection by winner. |

---

## Component Structure

```
frontend/
  app/
    how-to-play.tsx          ← Screen 1 (route)
    game-modes.tsx           ← Screen 2 (route)
    game-modes/
      [modeKey].tsx          ← Screen 3 (dynamic route)
  components/
    HowToPlayCarousel.tsx    ← Carousel shell (progress dots, nav, slide renderer)
    ModeCard.tsx             ← Reusable mode card for Screen 2
    how-to-play/
      slides/
        IntroScene.tsx
        HandScene.tsx
        TrumpRotationScene.tsx
        TrickScene.tsx
        BidScene.tsx
        ScoreScene.tsx
      SlideShell.tsx         ← Header, scene zone, text block, footer layout
    mode-carousels/
      ClassicSlides.tsx
      FixedRoundsSlides.tsx
      TrumpCallSlides.tsx
      BidFirstSlides.tsx
```

---

## State & Persistence

- `AsyncStorage` key `hasSeenHowToPlay` (boolean) — set on Screen 1 completion or skip
- Slide tracking within a session: local `useState`, not persisted
- No backend changes required

---

## Out of Scope

- Animations on scene components (roadmap item — Approach B)
- Redesign of existing game screens or lobby UI
- New game modes or rule changes

---

## Open Questions

- None — all decisions locked.
