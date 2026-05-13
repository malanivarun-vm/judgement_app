import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
} from 'react-native';
import { COLORS, SUIT_SYMBOLS, SUIT_COLORS, CARD_SIZES } from '../utils/theme';

export interface CardData {
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

const FONT_SIZES = {
  hand: { rank: 16, suit: 19, center: 22 },
  trick: { rank: 13, suit: 16, center: 18 },
  small: { rank: 10, suit: 13, center: 14 },
};

export default function PlayingCard({
  card,
  onPress,
  disabled,
  size = 'hand',
  highlighted,
  dimmed,
}: PlayingCardProps) {
  const suitSymbol = SUIT_SYMBOLS[card.suit] || '?';
  const suitColor = SUIT_COLORS[card.suit] || COLORS.suitBlack;
  const dims = CARD_SIZES[size];
  const fonts = FONT_SIZES[size];
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(scale, {
      toValue: highlighted ? 1.05 : 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [highlighted, reduceMotion, scale]);

  const animatePress = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      friction: 6,
      tension: 140,
    }).start();
  };

  return (
    <TouchableOpacity
      testID={`card-${card.rank}-${card.suit}`}
      onPress={onPress}
      onPressIn={() => animatePress(0.96)}
      onPressOut={() => animatePress(highlighted ? 1.05 : 1)}
      disabled={disabled || !onPress}
      activeOpacity={0.95}
      style={styles.touchable}
    >
      <Animated.View
        style={[
          styles.card,
          {
            width: dims.width,
            height: dims.height,
            transform: [{ scale }],
            opacity: dimmed ? 0.38 : 1,
          },
          highlighted && styles.highlighted,
          dimmed && styles.dimmed,
        ]}
      >
        <View style={styles.cardInner}>
          <View style={styles.corner}>
            <Text style={[styles.rank, { color: suitColor, fontSize: fonts.rank }]}>
              {card.rank}
            </Text>
            <Text style={[styles.suit, { color: suitColor, fontSize: fonts.suit }]}>
              {suitSymbol}
            </Text>
          </View>

          <View style={styles.centerBadge}>
            <Text style={[styles.centerSuit, { color: suitColor, fontSize: fonts.center }]}>
              {suitSymbol}
            </Text>
          </View>

          <View style={[styles.corner, styles.cornerBottom]}>
            <Text style={[styles.rank, styles.rankBottom, { color: suitColor, fontSize: fonts.rank }]}>
              {card.rank}
            </Text>
            <Text style={[styles.suit, styles.suitBottom, { color: suitColor, fontSize: fonts.suit }]}>
              {suitSymbol}
            </Text>
          </View>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: 2,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.55)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.26,
    shadowRadius: 8,
    elevation: 6,
    overflow: 'hidden',
  },
  cardInner: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: 'space-between',
  },
  highlighted: {
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.52,
    elevation: 10,
  },
  dimmed: {
    borderColor: 'rgba(0,0,0,0.1)',
  },
  corner: {
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cornerBottom: {
    alignItems: 'flex-end',
    transform: [{ rotate: '180deg' }],
  },
  rank: {
    fontWeight: '900',
    lineHeight: 18,
  },
  rankBottom: {},
  suit: {
    fontWeight: '800',
    lineHeight: 18,
    marginTop: -1,
  },
  suitBottom: {},
  centerBadge: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSuit: {
    fontWeight: '900',
  },
});
