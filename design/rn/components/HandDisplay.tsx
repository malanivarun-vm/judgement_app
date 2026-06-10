// rn/components/HandDisplay.tsx
// Scrollable hand grid — auto-sizes cards for large hands.
// Use this to replace the inline hand rendering in game.tsx.
//
// Usage in game.tsx:
//   import HandDisplay from '../components/HandDisplay';
//   <HandDisplay
//     hand={gameState.your_hand}
//     playableIndices={getPlayableIndices()}   // your existing Set<number>
//     onPlayCard={(card) => send({ action: 'play_card', card })}
//     phase={gameState.phase}
//     cardStyle={cardStyle}   // from your settings/state
//   />

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import PlayingCard, { CardData } from './PlayingCard';
import { COLORS, CardStyle } from '../utils/theme';

interface HandDisplayProps {
  hand: CardData[];
  /** Indices of cards the player is allowed to play. null = not your turn. */
  playableIndices?: Set<number> | null;
  onPlayCard?: (card: CardData, index: number) => void;
  phase?: string;
  cardStyle?: CardStyle;
  showLabel?: boolean;
}

export default function HandDisplay({
  hand,
  playableIndices = null,
  onPlayCard,
  phase,
  cardStyle = 'minimal',
  showLabel = true,
}: HandDisplayProps) {
  const isPlayPhase = phase === 'playing';
  // Auto-downsize for large hands so 2 rows fit comfortably
  const cardSize = hand.length > 8 ? 'trick' : 'hand';

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          Your hand · {hand.length} card{hand.length !== 1 ? 's' : ''}
        </Text>
      )}

      {/* maxHeight + ScrollView handles 17+ card hands gracefully */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {hand.map((card, i) => {
          const canPlay  = isPlayPhase && !!playableIndices?.has(i);
          const isDimmed = isPlayPhase && playableIndices != null && !playableIndices.has(i);

          return (
            <PlayingCard
              key={`${card.rank}-${card.suit}-${i}`}
              card={card}
              size={cardSize}
              cardStyle={cardStyle}
              highlighted={canPlay}
              dimmed={isDimmed}
              onPress={canPlay && onPlayCard ? () => onPlayCard(card, i) : undefined}
              disabled={!canPlay}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 2,
  },
  scroll: {
    maxHeight: 210,   // ~2 rows of hand-size cards with gap; scrolls if more
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    paddingTop: 14,   // room for the highlighted card lift (+shadow)
    paddingBottom: 6,
  },
});
