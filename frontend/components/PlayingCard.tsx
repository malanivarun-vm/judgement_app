import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS, SUIT_COLORS, CARD_SIZES } from '../utils/theme';

interface CardData {
  suit: string;
  rank: string;
}

interface PlayingCardProps {
  card: CardData;
  onPress?: () => void;
  disabled?: boolean;
  size?: 'hand' | 'trick' | 'small';
  highlighted?: boolean;
  dimmed?: boolean;
}

export default function PlayingCard({
  card,
  onPress,
  disabled,
  size = 'hand',
  highlighted,
  dimmed,
}: PlayingCardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = SUIT_SYMBOLS[card.suit] || '?';
  const suitColor = SUIT_COLORS[card.suit] || COLORS.suitBlack;
  const dims = CARD_SIZES[size];

  return (
    <TouchableOpacity
      testID={`card-${card.rank}-${card.suit}`}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        { width: dims.width, height: dims.height },
        highlighted && styles.highlighted,
        dimmed && styles.dimmed,
      ]}
    >
      <Text
        style={[
          styles.rank,
          { color: suitColor },
          size === 'small' && styles.rankSmall,
          size === 'trick' && styles.rankTrick,
        ]}
      >
        {card.rank}
      </Text>
      <Text
        style={[
          styles.suit,
          { color: suitColor },
          size === 'small' && styles.suitSmall,
          size === 'trick' && styles.suitTrick,
        ]}
      >
        {suitSymbol}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    marginHorizontal: 2,
  },
  highlighted: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.5,
    transform: [{ translateY: -6 }],
  },
  dimmed: {
    opacity: 0.4,
  },
  rank: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: -2,
  },
  rankSmall: {
    fontSize: 11,
  },
  rankTrick: {
    fontSize: 14,
  },
  suit: {
    fontSize: 18,
  },
  suitSmall: {
    fontSize: 13,
  },
  suitTrick: {
    fontSize: 16,
  },
});
