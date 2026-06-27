import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../utils/theme';
import { ModeSlide } from './types';

function BlindBidScene() {
  const bids = [
    { name: 'You', bid: 3 },
    { name: 'Alex', bid: 2 },
    { name: 'Sam', bid: 4 },
  ];
  return (
    <View style={styles.container}>
      <View style={styles.trumpUnknown}>
        <Text style={styles.trumpLabel}>Trump</Text>
        <Text style={styles.trumpValue}>?</Text>
      </View>
      <View style={styles.bids}>
        {bids.map((p) => (
          <View key={p.name} style={styles.bidRow}>
            <Text style={styles.playerName}>{p.name}</Text>
            <View style={styles.bidBadge}>
              <Text style={styles.bidNum}>{p.bid}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WinnerPicksScene() {
  return (
    <View style={styles.winnerContainer}>
      <Text style={styles.winnerLabel}>Highest prediction picks trump</Text>
      <View style={styles.suitRow}>
        {(['hearts','spades','diamonds','clubs'] as const).map((s) => (
          <View key={s} style={[styles.suitOption, s === 'spades' && styles.suitSelected]}>
            <Text style={[styles.suitSym, (s === 'hearts' || s === 'diamonds') && styles.red]}>
              {SUIT_SYMBOLS[s]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.winnerNote}>Sam predicted 4 — Sam picks</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 14 },
  trumpUnknown: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    alignItems: 'center',
  },
  trumpLabel: { color: COLORS.textSecondary, fontSize: 10, marginBottom: 2 },
  trumpValue: { color: COLORS.gold, fontSize: 28, fontWeight: '800' },
  bids: { gap: 8, width: '100%', paddingHorizontal: 20 },
  bidRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  playerName: { color: COLORS.textSecondary, fontSize: 13 },
  bidBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  bidNum: { color: COLORS.text, fontWeight: '700', fontSize: 14 },
  winnerContainer: { alignItems: 'center', gap: 12 },
  winnerLabel: { color: COLORS.goldLight, fontSize: 13, fontWeight: '700' },
  suitRow: { flexDirection: 'row', gap: 10 },
  suitOption: {
    width: 44, height: 44, borderRadius: 22,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  suitSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  suitSym: { fontSize: 22, color: COLORS.text },
  red: { color: COLORS.suitRed },
  winnerNote: { color: COLORS.textSecondary, fontSize: 11 },
});

export const slides: ModeSlide[] = [
  {
    title: 'HOW CARDS ARE DEALT',
    heading: "You get your full hand before anyone predicts.",
    body: "All cards are dealt upfront. Then every player makes their prediction — but trump hasn't been decided yet. You're predicting blind: you can see your cards but don't know which suit will dominate.",
    scene: <BlindBidScene />,
  },
  {
    title: 'WHO DECIDES TRUMP',
    heading: 'The player with the highest prediction picks trump.',
    body: "After everyone has predicted, the highest prediction wins the right to call trump. They pick the suit that suits their hand. If two players predict the same number, the one who predicted first gets to choose.",
    scene: <WinnerPicksScene />,
  },
  {
    title: 'THEN PLAY BEGINS',
    heading: 'Trump locked in. Play starts immediately.',
    body: "Once trump is set, play begins — no second deal, no waiting. Everyone plays to hit the number they predicted blind. Scoring, card ranking, and the dealer rule are all the same as Classic.",
    scene: undefined,
  },
];
