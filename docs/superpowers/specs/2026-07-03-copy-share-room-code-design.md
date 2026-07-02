# Copy & Share Room Code — Design

**Date:** 2026-07-03
**Status:** Approved pending user review
**Scope:** Frontend only (`frontend/`). No backend changes.

## Problem

Sharing a room code today means the host reads the 4-letter code off the lobby screen and manually types it into WhatsApp, and each friend manually types it back into the app. Slow, typo-prone, and it forces the host to background the app (which, until the grace-period fix lands, can kill the room).

## Solution overview

Two small icon buttons in the lobby's room-code box (`game.tsx`), plus deep-link handling on the home screen (`index.tsx`):

1. **Copy** — copies just the room code to the clipboard.
2. **Share** — opens the OS share sheet with a prewritten message containing the code and a join link.
3. **Join link** — opening the app with `?code=XXXX` pre-fills the code in the join view; the name field auto-fills from the last-used name.

Backend is deployed on Railway and the frontend on Vercel with `vercel.json` SPA rewrites, so links work for anyone anywhere.

## Detailed behavior

### Copy button
- Copies the bare code (e.g. `NLVW`) via `expo-clipboard` (works on web PWA and native).
- Feedback: icon swaps to a checkmark with "Copied!" for ~1.5s + light haptic (existing `fireHaptic` pattern).

### Share button
- Message:
  ```
  Hey, join my Judgement game! 🃏
  Room code: NLVW
  Tap to join: <origin>/?code=NLVW
  ```
- Link origin comes from `window.location.origin` at runtime — Vercel URL in production, LAN IP in dev. Never hardcoded.
- Web/PWA: `navigator.share({ text })` → native share sheet (WhatsApp, Telegram, SMS, etc.).
- Native app: React Native `Share.share({ message })`.
- Fallback (desktop browsers without Web Share API): copy the full message to clipboard and show "Message copied — paste it anywhere".

### Deep-link join flow (`index.tsx`)
- On load, read `code` from `useLocalSearchParams`.
- If present and it matches `^[A-Za-z]{4}$` (normalize to uppercase): switch to the join view with the code pre-filled.
- Name field auto-fills from localStorage key `judgement_player_name`, saved whenever any player creates or joins a room (not only via links).
- Join proceeds through the existing `joinRoom()` path — invalid/expired codes reuse the existing "Room not found" handling. No new error states.

### Helpers (pure, testable)
- `buildShareMessage(roomCode: string, origin: string): string`
- `parseRoomCodeParam(raw: unknown): string | null` — validates/normalizes the query param.

Location: `frontend/utils/share.ts` (alongside existing `utils/theme.ts` and `utils/variations.ts`).

## Testing
- Unit tests for both helpers via `node --test` + tsx (project convention): message format, origin injection, param validation (lowercase, wrong length, arrays, undefined).
- Manual verification on the PWA: copy feedback, share sheet opens, link round-trip pre-fills code, name persistence.

## Out of scope
- Backend/room-lifecycle changes (covered by the 2026-07-02 UX overhaul plan's grace-period task).
- WhatsApp-specific `wa.me` button — the OS share sheet already covers it.
- Full auto-join without a name prompt.
