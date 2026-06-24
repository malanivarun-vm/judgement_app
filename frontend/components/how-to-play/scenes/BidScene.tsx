import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';

const BIDS = [0, 1, 2, 3, 4, 5];
const SELECTED = 2;

export default function BidScene() {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>How many tricks will you win?</Text>
      <View style={styles.row}>
        {BIDS.map((n) => (
          <View key={n} style={[styles.bid, n === SELECTED && styles.bidSelected]}>
            <Text style={[styles.bidText, n === SELECTED && styles.bidTextSelected]}>
              {n}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 14 },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  row: { flexDirection: 'row', gap: 10 },
  bid: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidSelected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  bidText: { color: COLORS.textSecondary, fontSize: 16, fontWeight: '700' },
  bidTextSelected: { color: COLORS.background },
});
