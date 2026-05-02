# How to Play Modal — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "How to Play" modal to the home screen so new players can read the V1 game rules before joining a room.

**Architecture:** Extract modal into a standalone `HowToPlayModal` component (keeps `index.tsx` under control). The home screen removes the existing static rulesBox and adds a tappable "How to Play →" text link below the Join Room button. Modal uses only React Native primitives — no new dependencies.

**Tech Stack:** React Native, TypeScript, Expo Router, React Native `Modal`, existing `COLORS` / `SUIT_SYMBOLS` tokens from `utils/theme.ts`

---

## Files

| Action | Path | What it does |
|--------|------|-------------|
| Create | `frontend/components/HowToPlayModal.tsx` | Full-screen modal with 6 rule sections |
| Modify | `frontend/app/index.tsx` | Remove rulesBox, add state + link + mount modal |

---

## Task 1: Create `HowToPlayModal` component

**Files:**
- Create: `frontend/components/HowToPlayModal.tsx`

- [ ] **Step 1: Create the file with complete implementation**

Create `frontend/components/HowToPlayModal.tsx` with this exact content:

```tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../utils/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HOW TO PLAY</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Section label="🃏 The Game">
            {'Bid exactly how many tricks you\'ll win each round. Hit your bid and you score — miss it and you lose points. 3–7 players.'}
          </Section>

          <Section label="🃏 Playing Tricks">
            {'Lead any card. Others '}
            <Text style={styles.bold}>must follow suit</Text>
            {' if they can. If not, play any card. Highest trump wins; otherwise highest card of the lead suit wins.'}
          </Section>

          <Section label="♠ Trump Suits">
            {'Trump rotates each round: '}
            <Text style={styles.red}>♥ Hearts</Text>
            {' → '}
            <Text style={styles.bold}>♠ Spades</Text>
            {' → '}
            <Text style={styles.red}>♦ Diamonds</Text>
            {' → '}
            <Text style={styles.bold}>♣ Clubs</Text>
            {'. Trump beats any non-trump card.'}
          </Section>

          <Section label="🎯 Bidding">
            {'Bid clockwise after the dealer. The dealer bids last and '}
            <Text style={styles.bold}>
              cannot bid a number that makes total bids equal tricks available
            </Text>
            {' — someone must be set up to fail.'}
          </Section>

          <Section label="🔄 Rounds">
            {'Each round, cards dealt = '}
            <Text style={styles.bold}>floor(52 ÷ players)</Text>
            {'. Decreases by 1 each round down to 1 card.'}
          </Section>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📊 Scoring</Text>
            <View style={styles.scoreTable}>
              {SCORE_ROWS.map((row, i) => (
                <View
                  key={row.label}
                  style={[styles.scoreRow, i < SCORE_ROWS.length - 1 && styles.scoreRowBorder]}
                >
                  <Text style={styles.scoreLabel}>{row.label}</Text>
                  <Text style={[styles.scoreValue, row.positive ? styles.positive : styles.negative]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const SCORE_ROWS = [
  { label: 'Exact bid',            value: '+bid × 10 pts', positive: true },
  { label: 'Miss bid',             value: '−bid × 10 pts', positive: false },
  { label: 'Zero bid, 0 tricks',   value: '+25 pts',       positive: true },
  { label: 'Zero bid, any tricks', value: '−25 pts',       positive: false },
];

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  headerTitle: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  closeBtn: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  bold: {
    color: COLORS.text,
    fontWeight: '700',
  },
  red: {
    color: COLORS.suitRed,
    fontWeight: '700',
  },
  scoreTable: {
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scoreRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  positive: {
    color: COLORS.success,
  },
  negative: {
    color: COLORS.danger,
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && yarn tsc --noEmit
```

Expected: no errors related to `HowToPlayModal.tsx`

- [ ] **Step 3: Commit**

```bash
git add frontend/components/HowToPlayModal.tsx
git commit -m "feat: add HowToPlayModal component"
```

---

## Task 2: Update `index.tsx`

**Files:**
- Modify: `frontend/app/index.tsx`

- [ ] **Step 1: Add import for `HowToPlayModal`**

At line 16 (after the existing imports), add:

```tsx
import HowToPlayModal from '../components/HowToPlayModal';
```

- [ ] **Step 2: Add `howToPlayVisible` state**

Inside `HomeScreen`, after the existing `const [loading, setLoading] = useState(false);` line (~line 30), add:

```tsx
const [howToPlayVisible, setHowToPlayVisible] = useState(false);
```

- [ ] **Step 3: Replace the rulesBox with the link + modal mount**

Find and replace the entire `{/* Rules hint */}` block (lines 178–184):

```tsx
{/* Rules hint */}
<View style={styles.rulesBox}>
  <Text style={styles.rulesTitle}>How to Play</Text>
  <Text style={styles.rulesText}>
    Bid exactly how many tricks you'll win each round. Score points for accuracy — lose points for missing!
  </Text>
  <Text style={styles.rulesText}>3-7 players • Share room code to invite</Text>
</View>
```

Replace with:

```tsx
<TouchableOpacity
  style={styles.howToPlayLink}
  onPress={() => setHowToPlayVisible(true)}
  activeOpacity={0.7}
>
  <Text style={styles.howToPlayText}>
    New to Judgement?{' '}
    <Text style={styles.howToPlayAction}>How to Play →</Text>
  </Text>
</TouchableOpacity>

<HowToPlayModal
  visible={howToPlayVisible}
  onClose={() => setHowToPlayVisible(false)}
/>
```

- [ ] **Step 4: Replace rulesBox styles with howToPlay styles**

In the `StyleSheet.create({...})` block, find and remove the three rulesBox style entries:

```tsx
rulesBox: {
  marginTop: 28,
  backgroundColor: COLORS.surfaceGlass,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.borderGlass,
  padding: 16,
  width: '100%',
  alignItems: 'center',
},
rulesTitle: {
  color: COLORS.goldLight,
  fontSize: 13,
  fontWeight: '700',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 1,
},
rulesText: {
  color: COLORS.textSecondary,
  fontSize: 13,
  textAlign: 'center',
  lineHeight: 18,
  marginBottom: 4,
},
```

Add these in their place:

```tsx
howToPlayLink: {
  marginTop: 20,
  paddingVertical: 8,
},
howToPlayText: {
  color: COLORS.textSecondary,
  fontSize: 13,
  textAlign: 'center',
},
howToPlayAction: {
  color: COLORS.goldLight,
  fontWeight: '600',
  textDecorationLine: 'underline',
},
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd frontend && yarn tsc --noEmit
```

Expected: zero errors

- [ ] **Step 6: Run the app and manually verify**

```bash
cd frontend && yarn start
```

Open in browser (press `w`) or on device via Expo Go.

Verify:
1. Home screen no longer shows the static rules card
2. "New to Judgement? How to Play →" link appears below the Join Room button
3. Tapping the link opens the modal
4. Modal shows all 6 sections in order: The Game → Playing Tricks → Trump Suits → Bidding → Rounds → Scoring
5. Scoring table shows 4 rows with correct green/red colouring
6. ✕ button closes the modal
7. On iOS, modal slides up as a page sheet; on Android it's full screen

- [ ] **Step 7: Commit**

```bash
git add frontend/app/index.tsx
git commit -m "feat: replace rulesBox with How to Play modal link"
```
