import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { COLORS } from '../../../utils/theme';

const RANKS = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

export default function CardRankScene() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {RANKS.map((rank, i) => (
        <React.Fragment key={rank}>
          <View style={[styles.chip, rank === 'A' && styles.chipHighlight]}>
            <Text style={[styles.rank, rank === 'A' && styles.rankHighlight]}>
              {rank}
            </Text>
          </View>
          {i < RANKS.length - 1 && (
            <Text style={styles.gt}>›</Text>
          )}
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 4,
  },
  chip: {
    width: 32,
    height: 40,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipHighlight: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  rank: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  rankHighlight: {
    color: COLORS.background,
  },
  gt: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
});
