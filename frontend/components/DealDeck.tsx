import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/theme';

const GHOST_CARDS = 5;

export default function DealDeck({
  round,
  active,
  reduceMotion,
}: {
  round: number;
  active: boolean;
  reduceMotion?: boolean;
}) {
  const cards = useRef(
    Array.from({ length: GHOST_CARDS }, () => new Animated.Value(0)),
  ).current;

  useEffect(() => {
    if (!active || reduceMotion) {
      cards.forEach((card) => card.setValue(1));
      return;
    }
    cards.forEach((card) => card.setValue(0));
    Animated.stagger(
      75,
      cards.map((card) =>
        Animated.sequence([
          Animated.timing(card, {
            toValue: 0.72,
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(card, {
            toValue: 1,
            duration: 260,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
      ),
    ).start();
  }, [active, cards, reduceMotion, round]);

  if (!active) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      {cards.map((progress, index) => {
        const direction = index % 2 === 0 ? -1 : 1;
        return (
          <Animated.View
            key={index}
            style={[
              styles.flyingCard,
              {
                opacity: progress.interpolate({
                  inputRange: [0, 0.12, 0.82, 1],
                  outputRange: [0, 1, 1, 0],
                }),
                transform: [
                  {
                    translateX: progress.interpolate({
                      inputRange: [0, 0.72, 1],
                      outputRange: [0, direction * (42 + index * 9), direction * 130],
                    }),
                  },
                  {
                    translateY: progress.interpolate({
                      inputRange: [0, 0.72, 1],
                      outputRange: [0, -35 - index * 8, 105],
                    }),
                  },
                  {
                    rotate: progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${direction * (16 + index * 3)}deg`],
                    }),
                  },
                  { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }) },
                ],
              },
            ]}
          />
        );
      })}
      <View style={styles.deckShadow} />
      <View style={[styles.deckCard, styles.deckCardBackTwo]} />
      <View style={[styles.deckCard, styles.deckCardBackOne]} />
      <View style={styles.deckCard}>
        <Text style={styles.deckMark}>J</Text>
        <View style={styles.deckDiamond} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: '41%',
    width: 54,
    height: 72,
    zIndex: 2,
  },
  deckShadow: {
    position: 'absolute',
    left: 5,
    right: -5,
    bottom: -8,
    height: 20,
    borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  deckCard: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(243,229,171,0.55)',
    backgroundColor: '#102D20',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  deckCardBackOne: {
    transform: [{ translateX: 3 }, { translateY: -3 }, { rotate: '2deg' }],
    opacity: 0.85,
  },
  deckCardBackTwo: {
    transform: [{ translateX: 6 }, { translateY: -6 }, { rotate: '4deg' }],
    opacity: 0.6,
  },
  deckMark: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '900',
    fontFamily: 'serif',
  },
  deckDiamond: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    transform: [{ rotate: '45deg' }],
  },
  flyingCard: {
    position: 'absolute',
    width: 42,
    height: 58,
    left: 6,
    top: 6,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: '#173B2B',
    zIndex: 4,
  },
});

