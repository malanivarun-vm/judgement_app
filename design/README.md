# Judgement – UI Design Prototype

A hi-fi interactive design prototype for the Judgement card game, built in HTML + React/JSX.  
Open `Judgement UI v2.html` in any browser — no build step required.

## File structure

| File | Purpose |
|---|---|
| `Judgement UI v2.html` | Main entry point — phone shell, screen router, Tweaks panel |
| `card-v2.jsx` | `PlayingCard` component with 3 style variants (minimal / pip grid / foil) |
| `screens-v2.jsx` | Home, Lobby, Round End, Game Over, How to Play screens |
| `game-v2.jsx` | Game table screen — felt oval, opponent arc, bidding modal, hand display |
| `tweaks-panel.jsx` | In-page design Tweaks panel (floating controls) |

## Running it

```bash
open design/Judgement\ UI\ v2.html
# or just double-click the file in Finder / Explorer
```

No server or `npm install` needed — React and Babel load from CDN.

## Screens

- 🏠 **Home** — player name entry, create/join room
- 🚪 **Lobby** — room code display, waiting player list
- 🎯 **Bid Phase** — game table with bidding modal (giant number picker)
- 🃏 **Play Phase** — game table with interactive hand (click to play)
- 📊 **Round End** — per-player bid/won/score recap
- 🏆 **Game Over** — final podium with medal rankings
- 📖 **How to Play** — rules reference

## Design tokens

Defined in `screens-v2.jsx` as `CV`:

```js
background:   #0A1C13   // deep casino green
gold:         #D4AF37   // primary accent
goldLight:    #F3E5AB   // champagne highlight
success:      #10B981
danger:       #EF4444
```

Fonts: **Outfit** (headings/numbers) · **DM Sans** (body) · **JetBrains Mono** (room code)

## Tweaks (in-browser)

Toggle the Tweaks panel in the toolbar to switch:
- **Color theme** — Casino Green / Midnight Blue / Velvet Purple
- **Card style** — Minimal / Pip Grid / Foil
- **Animation** — Subtle / Medium / Rich
- **Table layout** — Arc / Compact
- **Typography** — Balanced / Tight / Airy
