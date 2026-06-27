import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

export default function QuickRefScene() {
  return (
    <View style={styles.card}>
      {/* Scoring */}
      <View style={styles.section}>
        <Text style={styles.sectionHead}>SCORING</Text>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.cell}>Exact prediction</Text>
            <Text style={styles.cell}>Miss prediction</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.cell, styles.positive]}>+pred × 10</Text>
            <Text style={[styles.cell, styles.negative]}>−pred × 10</Text>
          </View>
        </View>
        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.cell}>Zero, 0 rounds</Text>
            <Text style={styles.cell}>Zero, any rounds</Text>
          </View>
          <View style={styles.col}>
            <Text style={[styles.cell, styles.positive]}>+25 pts</Text>
            <Text style={[styles.cell, styles.negative]}>−25 pts</Text>
          </View>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Card rank */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>CARD RANK  </Text>
        <Text style={styles.cell}>A K Q J 10 9 … 2</Text>
      </View>

      <View style={styles.divider} />

      {/* Trump (Classic) */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>TRUMP (CLASSIC)  </Text>
        <Text style={styles.cell}>
          {SUIT_SYMBOLS.hearts} → {SUIT_SYMBOLS.spades} → {SUIT_SYMBOLS.diamonds} → {SUIT_SYMBOLS.clubs}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Dealer rule */}
      <View style={styles.row}>
        <Text style={styles.sectionHead}>DEALER  </Text>
        <Text style={styles.cell}>Can't match total predictions = rounds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 4,
    gap: 4,
  },
  section: {
    gap: 2,
  },
  sectionHead: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  twoCol: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  col: {
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cell: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  positive: {
    color: COLORS.success,
    fontWeight: '700',
  },
  negative: {
    color: COLORS.danger,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.borderGlass,
  },
});
