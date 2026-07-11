# Rolling Home Screen Title — Design

**Date:** 2026-07-11
**Scope:** `frontend/app/index.tsx` only

## Problem

1. The home screen title is hardcoded to "Judgement", but the game is equally known as Kachuful and Oh Hell!. Varun wants the title to cycle through all three names endlessly.
2. On some smartphones the title truncates to "Judgem...". Root cause: the title uses `adjustsFontSizeToFit` together with `letterSpacing: 2`, and Android's auto-fit calculation ignores letter spacing, so instead of shrinking, the text ellipsizes.

## Solution

### RollingTitle component

A `RollingTitle` component defined inside `frontend/app/index.tsx` replaces the static title `<Text>` at the hero panel (currently line 341).

- **Names:** `["Judgement", "Kachuful", "Oh Hell!"]`, cycling endlessly in that order.
- **Structure:** a fixed-height container with `overflow: hidden`, height locked to the title's line height so the hero layout never shifts. Inside it, two absolutely positioned title texts: the current name and the incoming name.
- **Animation:** vertical roll (slot-machine style). Each name dwells ~2500ms, then a ~350ms transition where the current name translates up and out while the next slides in from below. One shared `Animated.Value` drives both texts, with `useNativeDriver: true`.
- **Cleanup:** the cycle timer and any running animation are cleaned up on unmount so nothing leaks when navigating away from the home screen.

### Truncation fix

- Font size is computed responsively from window width (`useWindowDimensions`): capped at the current 52, scaled down on narrow screens so "Judgement" (the longest name) always fits including its `letterSpacing: 2`.
- `adjustsFontSizeToFit` + `numberOfLines={1}` stay as a backstop.
- All three names render at the same computed font size so the roll doesn't jitter between names.

### Reduce motion

If the OS reduce-motion setting is enabled (`AccessibilityInfo.isReduceMotionEnabled`), names still swap on the same ~2.5s rhythm but instantly, without the roll animation.

## Out of scope

- Kicker, subtitle, and meta rows in the hero are untouched.
- No changes to other screens or to the "New to Judgement?" copy.

## Verification

- Title cycles through all three names with a smooth vertical roll on iOS and Android.
- On a narrow-width device/emulator, "Judgement" renders fully with no ellipsis.
- Hero layout height does not shift during transitions.
- Navigating away and back does not stack multiple timers.
