import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

export default function IntroScene() {
  const suits = [
    { sym: SUIT_SYMBOLS.hearts,   color: COLORS.suitRed },
    { sym: SUIT_SYMBOLS.spades,   color: COLORS.text },
    { sym: SUIT_SYMBOLS.diamonds, color: COLORS.suitRed },
    { sym: SUIT_SYMBOLS.clubs,    color: COLORS.text },
  ];
  return (
    <View style={styles.grid}>
      {suits.map((s, i) => (
        <Text key={i} style={[styles.suit, { color: s.color }]}>{s.sym}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suit: { fontSize: 52, opacity: 0.9 },
});
