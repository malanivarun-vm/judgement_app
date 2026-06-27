import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/theme';
import { ModeSlide } from './types';

function ConfigScene() {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>Cards / Game</Text>
          <Text style={styles.value}>10</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>Total Games</Text>
          <Text style={styles.value}>8</Text>
        </View>
      </View>
      <Text style={styles.note}>Set by host before the game</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 12 },
  row: {
    flexDirection: 'row',
    gap: 0,
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    overflow: 'hidden',
  },
  item: { padding: 20, alignItems: 'center', flex: 1 },
  divider: { width: 1, backgroundColor: COLORS.borderGlass },
  label: { color: COLORS.textSecondary, fontSize: 11, marginBottom: 6 },
  value: { color: COLORS.goldLight, fontSize: 32, fontWeight: '800' },
  note: { color: COLORS.textSecondary, fontSize: 12 },
});

export const slides: ModeSlide[] = [
  {
    title: "WHAT'S DIFFERENT",
    heading: 'The host sets the card count. It never changes.',
    body: "Before the session starts, the host picks how many cards each player gets per game and how many games to play. That count stays fixed — no reducing. Good for shorter formats or custom play.",
    scene: <ConfigScene />,
  },
  {
    title: 'EVERYTHING ELSE',
    heading: 'Predictions, trump, scoring — all identical to Classic.',
    body: 'Trump still rotates ♥ → ♠ → ♦ → ♣ each game. Predictions work the same way. The dealer rule applies. Scoring is unchanged. Only the deal structure is different.',
    scene: undefined,
  },
];
