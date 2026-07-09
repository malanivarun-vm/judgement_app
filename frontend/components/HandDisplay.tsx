// Scrollable hand grid — auto-scales cards so the hand always fits
// within the screen width in at most two rows.

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
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
  /** Tints the label gold when it's the local player's turn. */
  labelActive?: boolean;
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

  const startRotation = index % 2 === 0 ? '-9deg' : '9deg';
  const startX = ((index % 7) - 3) * 10;
  return (
    <Animated.View
      style={{
        opacity: deal.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateX: deal.interpolate({ inputRange: [0, 1], outputRange: [startX, 0] }) },
          { translateY: deal.interpolate({ inputRange: [0, 1], outputRange: [-250, 0] }) },
          { scale: deal.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.74, 1.04, 1] }) },
          { rotate: deal.interpolate({ inputRange: [0, 1], outputRange: [startRotation, '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function GestureCard({
  canPlay,
  playPhase,
  reduceMotion,
  onCommit,
  children,
}: {
  canPlay: boolean;
  playPhase: boolean;
  reduceMotion: boolean;
  onCommit?: () => void;
  children: React.ReactNode;
}) {
  const drag = useRef(new Animated.ValueXY()).current;
  const shake = useRef(new Animated.Value(0)).current;
  const committing = useRef(false);
  const canPlayRef = useRef(canPlay);
  const playPhaseRef = useRef(playPhase);
  const commitRef = useRef(onCommit);
  canPlayRef.current = canPlay;
  playPhaseRef.current = playPhase;
  commitRef.current = onCommit;

  const snapBack = () => {
    Animated.spring(drag, {
      toValue: { x: 0, y: 0 },
      speed: 20,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  };

  const reject = () => {
    snapBack();
    if (reduceMotion) return;
    shake.setValue(0);
    Animated.sequence([
      Animated.timing(shake, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 8, duration: 70, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -5, duration: 55, useNativeDriver: true }),
      Animated.spring(shake, { toValue: 0, speed: 25, useNativeDriver: true }),
    ]).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        playPhaseRef.current && (Math.abs(gesture.dy) > 6 || Math.abs(gesture.dx) > 9),
      onPanResponderMove: (_, gesture) => {
        if (committing.current) return;
        drag.setValue({
          x: gesture.dx,
          y: Math.min(18, gesture.dy),
        });
      },
      onPanResponderRelease: (_, gesture) => {
        const thrown = gesture.dy < -42 || gesture.vy < -0.42;
        if (!thrown) {
          snapBack();
          return;
        }
        if (!canPlayRef.current || !commitRef.current) {
          reject();
          return;
        }
        committing.current = true;
        Animated.timing(drag, {
          toValue: { x: gesture.dx * 0.3, y: -190 },
          duration: 170,
          useNativeDriver: true,
        }).start(() => {
          commitRef.current?.();
          drag.setValue({ x: 0, y: 0 });
          committing.current = false;
        });
      },
      onPanResponderTerminate: snapBack,
    }),
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={{
        zIndex: 5,
        transform: [
          { translateX: Animated.add(drag.x, shake) },
          { translateY: drag.y },
          {
            rotate: drag.x.interpolate({
              inputRange: [-120, 0, 120],
              outputRange: ['-13deg', '0deg', '13deg'],
              extrapolate: 'clamp',
            }),
          },
          {
            scale: drag.y.interpolate({
              inputRange: [-180, 0, 20],
              outputRange: [1.12, 1, 0.97],
              extrapolate: 'clamp',
            }),
          },
        ],
        shadowColor: '#000',
        shadowOpacity: 0.42,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 9,
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
  labelActive = false,
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
        <Text style={[styles.label, labelActive && styles.labelActive]}>
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
              <GestureCard
                canPlay={canPlay}
                playPhase={isPlayPhase}
                reduceMotion={reduceMotion}
                onCommit={canPlay && onPlayCard ? () => onPlayCard(card, i) : undefined}
              >
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
              </GestureCard>
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
  labelActive: {
    color: COLORS.goldLight,
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
