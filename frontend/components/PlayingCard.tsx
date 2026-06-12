// rn/components/PlayingCard.tsx
// Drop-in replacement for frontend/components/PlayingCard.tsx
// New: cardStyle prop ('minimal' | 'pips' | 'foil')

import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, AccessibilityInfo,
} from 'react-native';
import { COLORS, SUIT_SYMBOLS, SUIT_COLORS, CARD_SIZES, CardSizeKey, CardStyle } from '../utils/theme';

export interface CardData { suit: string; rank: string; }

interface Props {
  card: CardData;
  size?: CardSizeKey;
  cardStyle?: CardStyle;
  highlighted?: boolean;
  dimmed?: boolean;
  onPress?: () => void;
  disabled?: boolean;
}

// Pip positions as [xFraction, yFraction] of card area
const PIP_POSITIONS: Record<string, [number, number][]> = {
  'A':  [[0.50, 0.50]],
  '2':  [[0.50, 0.22], [0.50, 0.78]],
  '3':  [[0.50, 0.16], [0.50, 0.50], [0.50, 0.84]],
  '4':  [[0.28, 0.22], [0.72, 0.22], [0.28, 0.78], [0.72, 0.78]],
  '5':  [[0.28, 0.20], [0.72, 0.20], [0.50, 0.50], [0.28, 0.80], [0.72, 0.80]],
  '6':  [[0.28, 0.18], [0.72, 0.18], [0.28, 0.50], [0.72, 0.50], [0.28, 0.82], [0.72, 0.82]],
  '7':  [[0.28, 0.16], [0.72, 0.16], [0.50, 0.33], [0.28, 0.50], [0.72, 0.50], [0.28, 0.84], [0.72, 0.84]],
  '8':  [[0.28, 0.14], [0.72, 0.14], [0.50, 0.30], [0.28, 0.47], [0.72, 0.47], [0.50, 0.64], [0.28, 0.82], [0.72, 0.82]],
  '9':  [[0.28, 0.14], [0.50, 0.14], [0.72, 0.14], [0.28, 0.50], [0.72, 0.50], [0.28, 0.86], [0.50, 0.86], [0.72, 0.86], [0.50, 0.50]],
  '10': [[0.28, 0.12], [0.72, 0.12], [0.50, 0.26], [0.28, 0.42], [0.72, 0.42], [0.28, 0.58], [0.72, 0.58], [0.50, 0.74], [0.28, 0.88], [0.72, 0.88]],
};

const FONT_SIZES: Record<CardSizeKey, { rank: number; suit: number; center: number; pip: number }> = {
  hand:  { rank: 14, suit: 12, center: 28, pip: 11 },
  trick: { rank: 12, suit: 10, center: 20, pip: 9  },
  small: { rank: 9,  suit: 8,  center: 15, pip: 7  },
  bid:   { rank: 11, suit: 9,  center: 17, pip: 8  },
};

const FACE_CARDS = new Set(['J', 'Q', 'K']);

export default function PlayingCard({ card, size = 'hand', cardStyle = 'minimal', highlighted, dimmed, onPress, disabled }: Props) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const liftAnim  = useRef(new Animated.Value(0)).current;
  const dimAnim   = useRef(new Animated.Value(dimmed ? 0.55 : 1)).current;

  const dims   = CARD_SIZES[size];
  const fonts  = FONT_SIZES[size];
  const symbol = SUIT_SYMBOLS[card.suit] || '?';
  const color  = SUIT_COLORS[card.suit]  || '#111';
  const isFace = FACE_CARDS.has(card.rank);
  const pips   = PIP_POSITIONS[card.rank];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: highlighted ? 1.05 : 1, useNativeDriver: true, friction: 6, tension: 140 }),
      Animated.spring(liftAnim,  { toValue: highlighted ? -8  : 0, useNativeDriver: true, friction: 6, tension: 140 }),
    ]).start();
  }, [highlighted, reduceMotion]);

  useEffect(() => {
    Animated.timing(dimAnim, {
      toValue: dimmed ? 0.55 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [dimmed]);

  const onPressIn  = () => { if (!reduceMotion) Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, friction: 6, tension: 140 }).start(); };
  const onPressOut = () => { if (!reduceMotion) Animated.spring(scaleAnim, { toValue: highlighted ? 1.05 : 1, useNativeDriver: true, friction: 6, tension: 140 }).start(); };

  const borderColor = highlighted ? COLORS.gold : cardStyle === 'foil' ? 'rgba(212,175,55,0.55)' : 'rgba(210,210,200,0.85)';
  const borderWidth = (highlighted || cardStyle === 'foil') ? 1.5 : 1;
  const bgColor     = cardStyle === 'foil' ? '#FFFEF6' : '#FFFFFF';

  return (
    <TouchableOpacity
      testID={`card-${card.rank}-${card.suit}`}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled || !onPress}
      activeOpacity={0.95}
    >
      <Animated.View style={[
        styles.card,
        {
          width: dims.width, height: dims.height,
          backgroundColor: bgColor, borderColor, borderWidth,
          opacity: dimAnim,
          shadowColor: highlighted ? COLORS.gold : '#000',
          shadowOpacity: highlighted ? 0.55 : 0.28,
          shadowRadius: highlighted ? 12 : 8,
          elevation: highlighted ? 10 : 5,
          transform: [{ scale: scaleAnim }, { translateY: liftAnim }],
        },
      ]}>
        {/* Top shine */}
        <View style={[styles.shine, { width: dims.width, height: dims.height * 0.4 }]} />

        {/* Foil corner marks */}
        {cardStyle === 'foil' && (
          <>
            <View style={styles.foilTL} />
            <View style={styles.foilBR} />
          </>
        )}

        {/* ── Pips layout ── */}
        {cardStyle === 'pips' ? (
          <>
            {/* Top-left corner */}
            <View style={styles.cornerTL}>
              <Text style={[styles.rankTxt, { fontSize: fonts.rank - 2, color }]}>{card.rank}</Text>
              <Text style={{ fontSize: fonts.suit - 2, color, lineHeight: fonts.suit }}>{symbol}</Text>
            </View>
            {/* Bottom-right corner (rotated) */}
            <View style={[styles.cornerBR, { bottom: 4, right: 5 }]}>
              <Text style={[styles.rankTxt, { fontSize: fonts.rank - 2, color }]}>{card.rank}</Text>
              <Text style={{ fontSize: fonts.suit - 2, color, lineHeight: fonts.suit }}>{symbol}</Text>
            </View>

            {isFace || !pips ? (
              /* Face card — framed centre */
              <View style={[styles.faceFrame, { borderColor: `${color}2A` }]}>
                <Text style={[styles.rankTxt, { fontSize: fonts.rank + 6, color }]}>{card.rank}</Text>
                <Text style={{ fontSize: fonts.suit + 2, color }}>{symbol}</Text>
              </View>
            ) : (
              /* Numbered — pip dots */
              pips.map(([xF, yF], i) => {
                const pipSz = card.rank === 'A' ? fonts.center : fonts.pip;
                return (
                  <Text key={i} style={{
                    position: 'absolute',
                    left: xF * dims.width  - pipSz / 2,
                    top:  yF * dims.height - pipSz / 2,
                    fontSize: pipSz, color, lineHeight: pipSz * 1.15,
                  }}>{symbol}</Text>
                );
              })
            )}
          </>
        ) : (
          /* ── Minimal / Foil layout ── */
          <View style={styles.minimalInner}>
            <View>
              <Text style={[styles.rankTxt, { fontSize: fonts.rank, color }]}>{card.rank}</Text>
              <Text style={{ fontSize: fonts.suit, color, lineHeight: fonts.suit + 2 }}>{symbol}</Text>
            </View>
            <View style={styles.centerPip}>
              <Text style={{ fontSize: fonts.center, color }}>{symbol}</Text>
            </View>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <Text style={[styles.rankTxt, { fontSize: fonts.rank, color }]}>{card.rank}</Text>
              <Text style={{ fontSize: fonts.suit, color, lineHeight: fonts.suit + 2 }}>{symbol}</Text>
            </View>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8, overflow: 'hidden',
    shadowOffset: { width: 0, height: 5 },
  },
  shine: {
    position: 'absolute', top: 0, left: 0,
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderTopLeftRadius: 8, borderTopRightRadius: 8,
  },
  foilTL: {
    position: 'absolute', top: 4, left: 4, width: 9, height: 9,
    borderTopWidth: 1, borderLeftWidth: 1,
    borderColor: 'rgba(212,175,55,0.6)',
    borderTopLeftRadius: 2,
  },
  foilBR: {
    position: 'absolute', bottom: 4, right: 4, width: 9, height: 9,
    borderBottomWidth: 1, borderRightWidth: 1,
    borderColor: 'rgba(212,175,55,0.6)',
    borderBottomRightRadius: 2,
  },
  cornerTL: { position: 'absolute', top: 4, left: 5 },
  cornerBR: { position: 'absolute', transform: [{ rotate: '180deg' }] },
  faceFrame: {
    position: 'absolute', top: 14, bottom: 14, left: 9, right: 9,
    borderWidth: 1, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
  },
  minimalInner: {
    flex: 1, paddingHorizontal: 6, paddingVertical: 5,
    justifyContent: 'space-between',
  },
  centerPip: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rankTxt: { fontWeight: '900', lineHeight: 18 },
});
