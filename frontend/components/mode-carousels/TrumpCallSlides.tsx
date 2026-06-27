import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlayingCard from '../PlayingCard';
import { COLORS, SUIT_SYMBOLS } from '../../utils/theme';
import { ModeSlide } from './types';

function TwoBatchScene() {
  const batch1 = [{ suit: 'spades', rank: 'A' }, { suit: 'hearts', rank: '7' }, { suit: 'clubs', rank: 'J' }];
  const batch2 = [{ suit: 'diamonds', rank: '4' }, { suit: 'spades', rank: '9' }];
  return (
    <View style={styles.container}>
      <View style={styles.batch}>
        <Text style={styles.batchLabel}>Batch 1 — dealt first</Text>
        <View style={styles.cards}>
          {batch1.map((c, i) => <PlayingCard key={i} card={c} size="small" disabled />)}
        </View>
      </View>
      <View style={styles.arrow}><Text style={styles.arrowText}>then</Text></View>
      <View style={[styles.batch, styles.batchDimmed]}>
        <Text style={styles.batchLabel}>Batch 2 — dealt after trump call</Text>
        <View style={styles.cards}>
          {batch2.map((c, i) => <PlayingCard key={i} card={c} size="small" disabled dimmed />)}
        </View>
      </View>
    </View>
  );
}

function TrumpCallScene() {
  return (
    <View style={styles.callContainer}>
      <Text style={styles.callPrompt}>Player left of dealer calls trump</Text>
      <View style={styles.suitRow}>
        {(['hearts','spades','diamonds','clubs'] as const).map((s) => (
          <View key={s} style={styles.suitOption}>
            <Text style={[styles.suitSym, (s === 'hearts' || s === 'diamonds') && styles.red]}>
              {SUIT_SYMBOLS[s]}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.callNote}>After seeing the first batch only</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 10 },
  batch: { alignItems: 'center', gap: 6 },
  batchDimmed: { opacity: 0.5 },
  batchLabel: { color: COLORS.textSecondary, fontSize: 10 },
  cards: { flexDirection: 'row', gap: 6 },
  arrow: { paddingVertical: 2 },
  arrowText: { color: COLORS.textSecondary, fontSize: 12 },
  callContainer: { alignItems: 'center', gap: 12 },
  callPrompt: { color: COLORS.goldLight, fontSize: 13, fontWeight: '700' },
  suitRow: { flexDirection: 'row', gap: 12 },
  suitOption: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 1, borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center', justifyContent: 'center',
  },
  suitSym: { fontSize: 22, color: COLORS.text },
  red: { color: COLORS.suitRed },
  callNote: { color: COLORS.textSecondary, fontSize: 11 },
});

export const slides: ModeSlide[] = [
  {
    title: 'HOW CARDS ARE DEALT',
    heading: 'Your hand arrives in two batches.',
    body: "You get the first half of your cards. Then trump is called. Then the second half is dealt. You won't have your full hand when trump is decided.",
    scene: <TwoBatchScene />,
  },
  {
    title: 'WHO CALLS TRUMP',
    heading: 'The player left of the dealer picks the trump suit.',
    body: "They choose after seeing only the first batch — not their full hand. If they can't make a call, a card is drawn at random from the un-dealt second half and its suit becomes trump.",
    scene: <TrumpCallScene />,
  },
  {
    title: 'THEN PLAY BEGINS',
    heading: 'Second batch dealt. Everyone predicts. Play starts.',
    body: "After trump is called, the rest of the cards arrive. Then everyone makes their prediction in the usual order — dealer last, blocked from letting totals equal rounds. Scoring, card ranking, and the dealer rule are all the same as Classic.",
    scene: undefined,
  },
];
