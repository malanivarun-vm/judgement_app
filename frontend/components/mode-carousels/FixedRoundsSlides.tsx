import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../utils/theme';
import { ModeSlide } from './types';

function ConfigScene() {
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.item}>
          <Text style={styles.label}>Cards / Round</Text>
          <Text style={styles.value}>10</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.item}>
          <Text style={styles.label}>Total Rounds</Text>
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
    title: 'Fixed Rounds',
    heading: 'The host sets the card count and session count.',
    body: 'Unlike Classic, the number of cards per session stays constant throughout the game. Good for shorter or custom-length games.',
    scene: <ConfigScene />,
  },
  {
    title: 'Fixed Rounds',
    heading: 'Everything else is identical to Classic.',
    body: 'Same prediction rules, same trump rotation (♥ → ♠ → ♦ → ♣), same scoring. Only the deal structure changes.',
    scene: undefined,
  },
];
