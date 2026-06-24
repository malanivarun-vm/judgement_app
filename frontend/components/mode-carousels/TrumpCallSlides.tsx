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
    title: 'Trump Call',
    heading: 'Cards are dealt in two batches.',
    body: 'You receive the first half of your hand, then a trump call happens — before the second half is dealt.',
    scene: <TwoBatchScene />,
  },
  {
    title: 'Trump Call',
    heading: 'The player left of the dealer calls trump.',
    body: 'They pick a suit after seeing only the first batch of cards — before their full hand is known. High risk, high information.',
    scene: <TrumpCallScene />,
  },
  {
    title: 'Trump Call',
    heading: 'Then the second batch arrives and bidding begins.',
    body: 'After trump is called, the rest of your hand is dealt. Bidding and play proceed exactly as in Classic.',
    scene: undefined,
  },
];
