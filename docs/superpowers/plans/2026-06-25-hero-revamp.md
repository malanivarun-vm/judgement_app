# Hero Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the lobby home screen hero section and form layout to create a dramatic, game-like first impression on mobile.

**Architecture:** All changes are confined to `frontend/app/index.tsx`. The hero becomes full-bleed (no card border), suit symbols scatter as absolute-positioned ambient elements behind the title, and the form restructures into a shared name field + two-column create/join panel.

**Tech Stack:** React Native, Expo, Animated API, StyleSheet

## Global Constraints

- Colors from `utils/theme.ts` — use `COLORS.*` constants, never hardcode hex except where no token exists
- `SUIT_SYMBOLS` from `utils/theme.ts` for suit characters
- Respect `reduceMotion` — all Animated transforms must be guarded by `!reduceMotion`
- `adjustsFontSizeToFit` + `numberOfLines={1}` on the title to guarantee single-line at any screen width
- No new dependencies — pure React Native StyleSheet

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/app/index.tsx` | Modify | All hero + form changes |

---

### Task 1: Hero Section Revamp

Remove the kicker label, restructure suit symbols to scatter absolutely behind the title, center the title, update tagline text + color, remove "Exact bids" chip, center the remaining chips.

**Files:**
- Modify: `frontend/app/index.tsx`

**What changes:**
- Delete `<Text style={styles.kicker}>` and `styles.kicker`
- Replace the `decoRow` Animated.View (flex row of suits) with a `heroWrapper` View containing 4 individually absolute-positioned suit Text nodes, each with its own float offset via `floatAnim`
- Add `textAlign: 'center'` to `styles.title`
- Change tagline text to `"Call it. Own it."` and update `styles.subtitle` color to `rgba(255,255,255,0.75)`
- Remove the `<View style={styles.heroChip}><Text>Exact bids</Text></View>` entry
- Add `justifyContent: 'center'` to `styles.heroChips`
- Remove `borderWidth`, `borderColor`, and `backgroundColor` from `styles.heroPanel` (full-bleed — no card border)

- [x] **Step 1: Remove kicker label from JSX**

In `frontend/app/index.tsx`, delete this line inside the heroPanel Animated.View:
```tsx
<Text style={styles.kicker}>Live Card Table</Text>
```

- [x] **Step 2: Replace decoRow with scattered suit wrapper**

Delete the existing `<Animated.View style={[styles.decoRow, ...]}>...</Animated.View>` block (lines ~162–186) and replace with a `heroWrapper` View that wraps both the scattered suits and the existing heroPanel content. The suits are positioned absolutely inside `heroWrapper`.

Replace from `{/* Decorative suit symbols */}` through the closing `</Animated.View>` of the decoRow, AND wrap the heroPanel Animated.View, with this structure:

```tsx
{/* Hero wrapper — suits scatter behind title */}
<View style={styles.heroWrapper}>
  {/* Suit: hearts — top-left, large */}
  {!reduceMotion ? (
    <Animated.Text
      style={[
        styles.suitScatter,
        styles.decoRed,
        { top: 28, left: 16, fontSize: 50, opacity: 0.16 },
        { transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }) }] },
      ]}
    >
      {SUIT_SYMBOLS.hearts}
    </Animated.Text>
  ) : (
    <Text style={[styles.suitScatter, styles.decoRed, { top: 28, left: 16, fontSize: 50, opacity: 0.16 }]}>
      {SUIT_SYMBOLS.hearts}
    </Text>
  )}

  {/* Suit: spades — top-center, small */}
  {!reduceMotion ? (
    <Animated.Text
      style={[
        styles.suitScatter,
        styles.decoWhite,
        { top: 12, left: 160, fontSize: 26, opacity: 0.10 },
        { transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }] },
      ]}
    >
      {SUIT_SYMBOLS.spades}
    </Animated.Text>
  ) : (
    <Text style={[styles.suitScatter, styles.decoWhite, { top: 12, left: 160, fontSize: 26, opacity: 0.10 }]}>
      {SUIT_SYMBOLS.spades}
    </Text>
  )}

  {/* Suit: diamonds — top-right, medium */}
  {!reduceMotion ? (
    <Animated.Text
      style={[
        styles.suitScatter,
        styles.decoRed,
        { top: 52, right: 18, fontSize: 40, opacity: 0.13 },
        { transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }) }] },
      ]}
    >
      {SUIT_SYMBOLS.diamonds}
    </Animated.Text>
  ) : (
    <Text style={[styles.suitScatter, styles.decoRed, { top: 52, right: 18, fontSize: 40, opacity: 0.13 }]}>
      {SUIT_SYMBOLS.diamonds}
    </Text>
  )}

  {/* Suit: clubs — mid-right, tiny */}
  {!reduceMotion ? (
    <Animated.Text
      style={[
        styles.suitScatter,
        styles.decoWhite,
        { top: 118, right: 44, fontSize: 20, opacity: 0.08 },
        { transform: [{ translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
      ]}
    >
      {SUIT_SYMBOLS.clubs}
    </Animated.Text>
  ) : (
    <Text style={[styles.suitScatter, styles.decoWhite, { top: 118, right: 44, fontSize: 20, opacity: 0.08 }]}>
      {SUIT_SYMBOLS.clubs}
    </Text>
  )}

  {/* Hero content */}
  <Animated.View
    style={[
      styles.heroPanel,
      !reduceMotion && {
        transform: [{
          translateY: floatAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }),
        }],
      },
    ]}
  >
    <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>Judgement</Text>
    <Text style={styles.subtitle}>Call it. Own it.</Text>
    <View style={styles.heroChips}>
      <View style={styles.heroChip}><Text style={styles.heroChipText}>Real-time</Text></View>
      <View style={styles.heroChip}><Text style={styles.heroChipText}>3–7 players</Text></View>
    </View>
  </Animated.View>
</View>
```

- [x] **Step 3: Update styles for hero**

In the `StyleSheet.create({...})` block, apply these changes:

**Remove** `styles.kicker`, `styles.decoRow` entirely.

**Replace** `styles.heroPanel`:
```ts
heroPanel: {
  width: '100%',
  marginBottom: 18,
  paddingHorizontal: 20,
  paddingTop: 160,   // pushes title below the floating suits
  paddingBottom: 20,
},
```

**Replace** `styles.title`:
```ts
title: {
  color: COLORS.goldLight,
  fontSize: 58,
  fontWeight: '900',
  letterSpacing: 6,
  marginBottom: 4,
  textAlign: 'center',
},
```

**Replace** `styles.subtitle`:
```ts
subtitle: {
  color: 'rgba(255,255,255,0.75)',
  fontSize: 14,
  lineHeight: 21,
  marginTop: 10,
  letterSpacing: 0.3,
  textAlign: 'center',
},
```

**Replace** `styles.heroChips`:
```ts
heroChips: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 14,
  justifyContent: 'center',
},
```

**Keep** `styles.heroChip` and `styles.heroChipText` unchanged.

**Add** these new styles:
```ts
heroWrapper: {
  width: '100%',
  position: 'relative',
  marginBottom: 8,
},
suitScatter: {
  position: 'absolute',
  fontFamily: 'serif',
},
decoRed: {
  color: COLORS.suitRed,
},
decoWhite: {
  color: '#FFFFFF',
},
```

Note: `decoRed` and `decoWhite` already exist in the file — update them to remove `opacity: 0.4` (opacity is now set per-suit inline).

- [x] **Step 4: Verify hero renders correctly**

Run the dev server:
```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app/frontend
npx expo start --web
```

Open in browser at `localhost:8081`. Verify:
- "Judgement" is centered, single line, large gold
- "Call it. Own it." is bright white, centered below
- Suit symbols appear scattered at different positions, gently floating
- No card border around the hero
- Two chips (Real-time, 3–7 players) centered below

- [ ] **Step 5: Commit hero changes**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app
git add frontend/app/index.tsx
git commit -m "feat: revamp hero — full-bleed, centered title, scattered suits, new tagline"
```

---

### Task 2: Form Section Restructure

Replace the single scrollable form panel with a unified panel: shared "Your Name" field at the top (connected top-rounded block), then a two-column action row below (Create left | Join right with inline code input).

**Files:**
- Modify: `frontend/app/index.tsx`

**What changes:**
- Remove the existing `<View style={styles.panel}>` block and all its contents
- Replace with a `formPanel` wrapper containing `nameBlock` (top) + `actionRow` (bottom)
- `actionRow` has two columns: `actionCreate` (left) and `actionJoin` (right), separated by a 1px vertical divider
- Join column contains: section label "Have a code?", the `roomCode` TextInput (centered, large), and Join Room button
- Create column contains: section label "Create a room" and the Create Room button
- "How to Play" link moves below the `formPanel`
- Remove `styles.panel`, `styles.divider`, `styles.dividerLine`, `styles.dividerText` — these are replaced by the new layout

- [x] **Step 1: Replace form JSX**

Delete from `{/* Player Name */}` through `</View>` (the closing of `styles.panel`) and replace with:

```tsx
{/* Unified form */}
<View style={styles.formPanel}>
  {/* Shared name — required for both create and join */}
  <View style={styles.nameBlock}>
    <Text style={styles.label}>Your Name</Text>
    <TextInput
      testID="player-name-input"
      style={styles.input}
      value={playerName}
      onChangeText={setPlayerName}
      placeholder="Enter your name"
      placeholderTextColor="rgba(255,255,255,0.3)"
      maxLength={16}
      autoCapitalize="words"
    />
  </View>

  {/* Two-column action row */}
  <View style={styles.actionRow}>
    {/* Create */}
    <View style={styles.actionCreate}>
      <Text style={styles.sectionLabel}>Create a room</Text>
      <TouchableOpacity
        testID="create-room-btn"
        style={styles.goldButton}
        onPress={createRoom}
        disabled={loading}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.goldButtonText}>Create Room</Text>
        )}
      </TouchableOpacity>
    </View>

    {/* Vertical divider */}
    <View style={styles.actionDivider} />

    {/* Join */}
    <View style={styles.actionJoin}>
      <Text style={styles.sectionLabel}>Have a code?</Text>
      <TextInput
        testID="room-code-input"
        style={[styles.input, styles.codeInput]}
        value={roomCode}
        onChangeText={(t) => setRoomCode(t.toUpperCase())}
        placeholder="ABCD"
        placeholderTextColor="rgba(255,255,255,0.25)"
        maxLength={4}
        autoCapitalize="characters"
      />
      <TouchableOpacity
        testID="join-room-btn"
        style={styles.outlineButton}
        onPress={joinRoom}
        disabled={loading}
        activeOpacity={0.8}
      >
        <Text style={styles.outlineButtonText}>Join Room</Text>
      </TouchableOpacity>
    </View>
  </View>
</View>

<TouchableOpacity
  style={styles.howToPlayLink}
  onPress={async () => {
    await fireHaptic('selection');
    router.push('/how-to-play');
  }}
  activeOpacity={0.7}
>
  <Text style={styles.howToPlayText}>
    New to Judgement?{' '}
    <Text style={styles.howToPlayAction}>How to Play →</Text>
  </Text>
</TouchableOpacity>
```

- [x] **Step 2: Add new form styles**

Add these styles to `StyleSheet.create({...})`:

```ts
formPanel: {
  width: '100%',
  borderRadius: 24,
  borderWidth: 1,
  borderColor: 'rgba(212,175,55,0.15)',
  backgroundColor: COLORS.surfaceSolid,
  overflow: 'hidden',
  marginBottom: 4,
},
nameBlock: {
  padding: 18,
  borderBottomWidth: 1,
  borderBottomColor: 'rgba(255,255,255,0.07)',
},
actionRow: {
  flexDirection: 'row',
},
actionCreate: {
  flex: 1,
  padding: 14,
  paddingBottom: 18,
},
actionJoin: {
  flex: 1,
  padding: 14,
  paddingBottom: 18,
},
actionDivider: {
  width: 1,
  backgroundColor: 'rgba(255,255,255,0.07)',
},
sectionLabel: {
  color: 'rgba(255,255,255,0.35)',
  fontSize: 10,
  fontWeight: '700',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  marginBottom: 10,
},
codeInput: {
  textAlign: 'center',
  letterSpacing: 5,
  fontSize: 20,
  fontWeight: '800',
  marginBottom: 10,
},
```

**Update** existing `styles.goldButton` — remove `width: '100%'` and `marginTop: 8` (the action column handles layout):
```ts
goldButton: {
  backgroundColor: COLORS.gold,
  paddingVertical: 14,
  borderRadius: 20,
  alignItems: 'center',
  shadowColor: COLORS.gold,
  shadowOpacity: 0.35,
  shadowRadius: 10,
  elevation: 4,
},
```

**Update** existing `styles.outlineButton` — remove `width: '100%'`:
```ts
outlineButton: {
  borderWidth: 1.5,
  borderColor: COLORS.gold,
  paddingVertical: 13,
  borderRadius: 20,
  alignItems: 'center',
},
```

**Remove** `styles.panel`, `styles.divider`, `styles.dividerLine`, `styles.dividerText`.

- [x] **Step 3: Verify form renders and functions correctly**

With the dev server running (`npx expo start --web`), verify:
- "Your Name" field spans full width at top of the unified panel
- Two columns below: Create Room (left) | code input + Join Room (right)
- Creating a room with a name works — navigates to game screen
- Joining a room with a name + code works — navigates to game screen
- Empty name → alert fires for both create and join
- Empty code on join → alert fires

- [ ] **Step 4: Commit form changes**

```bash
cd /Users/varunmalani/Desktop/Projects/judgement_app
git add frontend/app/index.tsx
git commit -m "feat: restructure lobby form — shared name field + two-column create/join"
```
