// Scrollable hand grid — auto-scales cards so the hand always fits
// within the screen width in at most two rows.

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
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

function DealtCard({
  index,
  reduceMotion,
  children,
}: {
  index: number;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const deal = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      deal.setValue(1);
      return;
    }
    deal.setValue(0);
    Animated.sequence([
      Animated.delay(Math.min(index, 12) * 42),
      Animated.spring(deal, {
        toValue: 1,
        speed: 18,
        bounciness: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, [deal, index, reduceMotion]);

  const startRotation = index % 2 === 0 ? '-7deg' : '7deg';
  return (
    <Animated.View
      style={{
        opacity: deal.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: deal.interpolate({ inputRange: [0, 1], outputRange: [58, 0] }) },
          { scale: deal.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.74, 1.04, 1] }) },
          { rotate: deal.interpolate({ inputRange: [0, 1], outputRange: [startRotation, '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
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
  const [reduceMotion, setReduceMotion] = useState(false);
  const isPlayPhase = phase === 'playing';
  const scale = handCardScale(hand.length, width);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

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
            <DealtCard key={`${card.rank}-${card.suit}`} index={i} reduceMotion={reduceMotion}>
              <PlayingCard
                card={card}
                size="hand"
                scale={scale}
                cardStyle={cardStyle}
                highlighted={canPlay}
                dimmed={isDimmed}
                onPress={canPlay && onPlayCard ? () => onPlayCard(card, i) : undefined}
                disabled={!canPlay}
              />
            </DealtCard>
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
