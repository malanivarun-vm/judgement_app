// Scrollable hand grid — auto-scales cards so the hand always fits
// within the screen width in at most two rows.

import React from 'react';
import { View, Text, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import PlayingCard, { CardData } from './PlayingCard';
import { COLORS, CardStyle, CARD_SIZES } from '../utils/theme';

interface HandDisplayProps {
  hand: CardData[];
  /** Indices of cards the player is allowed to play. null = not your turn. */
  playableIndices?: Set<number> | null;
  onPlayCard?: (card: CardData, index: number) => void;
  phase?: string;
  cardStyle?: CardStyle;
  showLabel?: boolean;
}

const GAP = 6;
// Horizontal chrome around the grid: tableShell 12+12, handDock 8+8,
// container 12+12 = 64. Keep in sync with game.tsx if those paddings change.
const H_CHROME = 64;

/** Scale factor (≤1) so `count` cards fit in ≤2 rows of the available width. */
export function handCardScale(count: number, screenWidth: number): number {
  if (count <= 0) return 1;
  const perRow = count <= 6 ? count : Math.ceil(count / 2);
  const available = Math.max(160, screenWidth - H_CHROME) - (perRow - 1) * GAP;
  const fitWidth = Math.floor(available / perRow);
  return Math.min(1, fitWidth / CARD_SIZES.hand.width);
}

export default function HandDisplay({
  hand,
  playableIndices = null,
  onPlayCard,
  phase,
  cardStyle = 'minimal',
  showLabel = true,
}: HandDisplayProps) {
  const { width } = useWindowDimensions();
  const isPlayPhase = phase === 'playing';
  const scale = handCardScale(hand.length, width);

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={styles.label}>
          Your hand · {hand.length} card{hand.length !== 1 ? 's' : ''}
        </Text>
      )}

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
              size="hand"
              scale={scale}
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
    maxHeight: 210,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    justifyContent: 'center',
    paddingTop: 14,
    paddingBottom: 6,
  },
});
