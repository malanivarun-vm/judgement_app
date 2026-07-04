import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS, SUIT_DISPLAY_COLORS, SUIT_SYMBOLS } from '../utils/theme';

const PARTICLES = [
  { x: -110, y: -45, r: '-30deg' },
  { x: 108, y: -35, r: '28deg' },
  { x: -86, y: 74, r: '18deg' },
  { x: 92, y: 82, r: '-24deg' },
  { x: 0, y: -112, r: '12deg' },
  { x: 8, y: 122, r: '-12deg' },
];

export default function TrumpCinematic({
  suit,
  reduceMotion,
}: {
  suit: string;
  reduceMotion?: boolean;
}) {
  const slam = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      slam.setValue(1);
      return;
    }
    slam.setValue(0);
    Animated.spring(slam, {
      toValue: 1,
      speed: 14,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, slam, suit]);

  const color = SUIT_DISPLAY_COLORS[suit] || COLORS.goldLight;
  const symbol = SUIT_SYMBOLS[suit] || '?';

  return (
    <View style={styles.overlay} pointerEvents="none">
      <Animated.View
        style={[
          styles.ripple,
          {
            borderColor: color,
            opacity: slam.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0.65, 0] }),
            transform: [{ scale: slam.interpolate({ inputRange: [0, 1], outputRange: [0.2, 3.2] }) }],
          },
        ]}
      />
      {PARTICLES.map((particle, index) => (
        <Animated.Text
          key={index}
          style={[
            styles.particle,
            {
              color,
              opacity: slam.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 0] }),
              transform: [
                { translateX: slam.interpolate({ inputRange: [0, 1], outputRange: [0, particle.x] }) },
                { translateY: slam.interpolate({ inputRange: [0, 1], outputRange: [0, particle.y] }) },
                { rotate: particle.r },
                { scale: slam.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.2, 1.2, 0.6] }) },
              ],
            },
          ]}
        >
          {symbol}
        </Animated.Text>
      ))}
      <Animated.View
        style={[
          styles.badge,
          {
            opacity: slam,
            transform: [
              { translateY: slam.interpolate({ inputRange: [0, 0.7, 1], outputRange: [-90, 8, 0] }) },
              { scale: slam.interpolate({ inputRange: [0, 0.68, 1], outputRange: [2.5, 0.92, 1] }) },
              { rotate: slam.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '0deg'] }) },
            ],
          },
        ]}
      >
        <Text style={styles.kicker}>TRUMP REVEALED</Text>
        <Text style={[styles.symbol, { color }]}>{symbol}</Text>
        <Text style={styles.name}>{suit.toUpperCase()}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 70,
    backgroundColor: 'rgba(2,10,6,0.74)',
  },
  ripple: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 3,
  },
  badge: {
    minWidth: 190,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.6)',
    backgroundColor: '#0B2117',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.5,
    shadowRadius: 26,
    elevation: 18,
  },
  kicker: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.4,
  },
  symbol: {
    fontSize: 72,
    lineHeight: 82,
    textShadowColor: 'rgba(255,255,255,0.28)',
    textShadowRadius: 18,
  },
  name: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 3,
  },
  particle: {
    position: 'absolute',
    fontSize: 26,
    fontFamily: 'serif',
  },
});
