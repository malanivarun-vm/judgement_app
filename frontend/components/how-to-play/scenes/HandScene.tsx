import React from 'react';
import { View, StyleSheet } from 'react-native';
import PlayingCard from '../../PlayingCard';

const HAND = [
  { suit: 'spades',   rank: 'A' },
  { suit: 'hearts',   rank: 'K' },
  { suit: 'diamonds', rank: '7' },
  { suit: 'clubs',    rank: 'J' },
  { suit: 'spades',   rank: '3' },
];

const ROTATIONS = [-18, -9, 0, 9, 18];

export default function HandScene() {
  return (
    <View style={styles.fan}>
      {HAND.map((card, i) => (
        <View
          key={i}
          style={[
            styles.cardWrap,
            { transform: [{ rotate: `${ROTATIONS[i]}deg` }, { translateY: Math.abs(ROTATIONS[i]) * 0.8 }] },
          ]}
        >
          <PlayingCard card={card} size="trick" disabled />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingBottom: 8,
  },
  cardWrap: { marginHorizontal: -10 },
});
