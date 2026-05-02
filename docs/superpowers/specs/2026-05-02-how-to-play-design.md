# How to Play — Design Spec
**Date:** 2026-05-02
**Feature:** How to Play modal for new players on the home screen

---

## Overview

Add a "How to Play" modal to `index.tsx` so new players can learn the game rules before creating or joining a room. The modal covers V1 rules only; additional variation tabs will be added when V2/V3 are built.

---

## What Changes on the Home Screen

- **Remove** the existing `rulesBox` (the static glass card at the bottom of `index.tsx`, lines 178–184 and its styles)
- **Add** a single line of text below the Join Room button:
  > "New to Judgement? **How to Play →**"
  - "New to Judgement?" in `textSecondary` colour
  - "How to Play →" in `goldLight`, bold, with an underline, tappable
  - Opens the modal on press

---

## Modal

**Trigger:** Tap "How to Play →" link  
**Dismiss:** Tap the ✕ button in the modal header, or tap outside (standard RN Modal backdrop)  
**Scroll:** Rules content scrolls inside the modal; header is sticky  
**Platform:** React Native `Modal` component with `animationType="slide"`, `presentationStyle="pageSheet"` on iOS

### Header
- Title: `HOW TO PLAY` — gold, bold, letter-spaced
- ✕ close button — right-aligned, `textSecondary` colour

### Sections (in order)

| # | Label | Content |
|---|-------|---------|
| 1 | 🃏 The Game | Bid exactly how many tricks you'll win each round. Hit your bid and you score — miss it and you lose points. 3–7 players. |
| 2 | 🃏 Playing Tricks | Lead any card. Others must follow suit if they can. If not, play any card. Highest trump wins; otherwise highest card of the lead suit wins. |
| 3 | ♠ Trump Suits | Trump rotates each round: ♥ Hearts → ♠ Spades → ♦ Diamonds → ♣ Clubs. Trump beats any non-trump card. |
| 4 | 🎯 Bidding | Bid clockwise after the dealer. The dealer bids last and cannot bid a number that makes total bids equal tricks available — someone must be set up to fail. |
| 5 | 🔄 Rounds | Each round, cards dealt = floor(52 ÷ players). Decreases by 1 each round down to 1 card. |
| 6 | 📊 Scoring | Table (see below) |

### Scoring Table

| Outcome | Points |
|---------|--------|
| Exact bid | +bid × 10 |
| Miss bid | −bid × 10 |
| Zero bid, 0 tricks taken | +25 |
| Zero bid, any tricks taken | −25 |

---

## Component Structure

All new code lives in `index.tsx` — no new file needed. Two additions:

1. **`howToPlayVisible` state** — `useState(false)`, controls modal visibility
2. **`<HowToPlayModal>`** — inline component (or extracted to `components/HowToPlayModal.tsx` if the file grows past ~400 lines after the change)

The modal uses only React Native primitives: `Modal`, `SafeAreaView`, `ScrollView`, `TouchableOpacity`, `Text`, `View`, `StyleSheet`. No new dependencies.

---

## Style Tokens (from `utils/theme.ts`)

| Token | Usage |
|-------|-------|
| `COLORS.background` | Modal background |
| `COLORS.goldLight` | Section labels, header title, link text |
| `COLORS.textSecondary` | Body text, ✕ button, "New to Judgement?" text |
| `COLORS.borderGlass` | Header bottom border, scoring table row dividers |
| `COLORS.surfaceGlass` | Scoring table background |
| `COLORS.text` | Bold inline highlights |

---

## Out of Scope

- No animation on section expand/collapse (sections are always visible, just scrollable)
- No variation tabs (V2/V3 added later)
- No deep-link or share of rules
- No "Got it" CTA — modal is read-only, dismissed via ✕ or backdrop tap
