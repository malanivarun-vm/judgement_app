import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../../utils/theme';

export default function GameStructureScene() {
  return (
    <View style={styles.container}>
      <View style={[styles.box, styles.gameBox]}>
        <Text style={styles.gameLabel}>SESSION</Text>
      </View>
      <Text style={styles.connector}>↓</Text>
      <View style={styles.row}>
        {['Game 1', 'Game 2', 'Game 3', '…'].map((label) => (
          <View key={label} style={[styles.box, styles.sessionBox]}>
            <Text style={styles.sessionLabel}>{label}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.connector}>↓</Text>
      <View style={styles.row}>
        {['Rd 1', 'Rd 2', 'Rd 3', '…'].map((label) => (
          <View key={label} style={[styles.box, styles.roundBox]}>
            <Text style={styles.roundLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 6,
  },
  box: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  gameBox: {
    paddingHorizontal: 28,
    paddingVertical: 8,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: 'rgba(212,175,55,0.5)',
  },
  gameLabel: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  sessionBox: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceGlass,
    borderColor: COLORS.borderGlass,
  },
  sessionLabel: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '600',
  },
  roundBox: {
    width: 34,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: COLORS.borderGlass,
  },
  roundLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  connector: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
});
