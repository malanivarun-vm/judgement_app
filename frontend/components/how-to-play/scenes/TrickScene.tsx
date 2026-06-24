import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PlayingCard from '../../PlayingCard';
import { COLORS } from '../../../utils/theme';

const TRICK = [
  { suit: 'hearts',   rank: '9',  winner: false },
  { suit: 'hearts',   rank: 'K',  winner: true  },
  { suit: 'diamonds', rank: '4',  winner: false },
  { suit: 'clubs',    rank: '10', winner: false },
];

export default function TrickScene() {
  return (
    <View style={styles.table}>
      {TRICK.map((c, i) => (
        <View key={i} style={styles.cardWrap}>
          <PlayingCard card={c} size="trick" highlighted={c.winner} />
          {c.winner && <Text style={styles.winnerLabel}>Winner</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  table: { flexDirection: 'row', gap: 8, alignItems: 'flex-end' },
  cardWrap: { alignItems: 'center' },
  winnerLabel: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
});
