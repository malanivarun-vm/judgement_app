import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';
import { SCORE_ROWS } from '../../../utils/variations';

export default function ScoreScene() {
  return (
    <View style={styles.table}>
      {SCORE_ROWS.map((row, i) => (
        <View
          key={row.label}
          style={[styles.row, i < SCORE_ROWS.length - 1 && styles.rowBorder]}
        >
          <Text style={styles.label}>{row.label}</Text>
          <Text style={[styles.value, row.positive ? styles.positive : styles.negative]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: {
    width: '100%',
    paddingHorizontal: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 10,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.borderGlass },
  label: { color: COLORS.textSecondary, fontSize: 12 },
  value: { fontSize: 12, fontWeight: '700' },
  positive: { color: COLORS.success },
  negative: { color: COLORS.danger },
});
