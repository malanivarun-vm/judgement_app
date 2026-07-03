// Falling gold suit glyphs for the game-over celebration.
// Pure Animated API — no extra dependencies. Respects reduce-motion.

import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { SUIT_SYMBOLS } from '../utils/theme';

const GLYPHS = [
  SUIT_SYMBOLS.spades,
  SUIT_SYMBOLS.hearts,
  SUIT_SYMBOLS.diamonds,
  SUIT_SYMBOLS.clubs,
];

const PARTICLES = 14;

interface ParticleSpec {
  glyph: string;
  left: number; // 0..1 of width
  size: number;
  delay: number;
  duration: number;
  drift: number;
  color: string;
}

function Particle({ spec, height, width }: { spec: ParticleSpec; height: number; width: number }) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(spec.delay),
        Animated.timing(t, {
          toValue: 1,
          duration: spec.duration,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(t, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [t, spec.delay, spec.duration]);

  return (
    <Animated.Text
      style={[
        styles.glyph,
        {
          left: spec.left * width,
          fontSize: spec.size,
          color: spec.color,
          opacity: t.interpolate({
            inputRange: [0, 0.1, 0.85, 1],
            outputRange: [0, 0.85, 0.6, 0],
          }),
          transform: [
            {
              translateY: t.interpolate({
                inputRange: [0, 1],
                outputRange: [-60, height + 60],
              }),
            },
            {
              translateX: t.interpolate({
                inputRange: [0, 1],
                outputRange: [0, spec.drift],
              }),
            },
            {
              rotate: t.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', `${spec.drift * 4}deg`],
              }),
            },
          ],
        },
      ]}
    >
      {spec.glyph}
    </Animated.Text>
  );
}

export default function GoldRain({ reduceMotion }: { reduceMotion?: boolean }) {
  const { width, height } = useWindowDimensions();

  const specs = useMemo<ParticleSpec[]>(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        glyph: GLYPHS[i % GLYPHS.length],
        left: Math.random(),
        size: 16 + Math.random() * 22,
        delay: Math.random() * 2600,
        duration: 3200 + Math.random() * 2400,
        drift: (Math.random() - 0.5) * 90,
        color: i % 3 === 0 ? '#F3E5AB' : i % 3 === 1 ? '#D4AF37' : 'rgba(255,255,255,0.7)',
      })),
    []
  );

  if (reduceMotion) return null;

  return (
    <Animated.View style={styles.wrap} pointerEvents="none">
      {specs.map((spec, i) => (
        <Particle key={i} spec={spec} height={height} width={width} />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  glyph: {
    position: 'absolute',
    top: 0,
    fontFamily: 'serif',
    textShadowColor: 'rgba(212,175,55,0.4)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 0 },
  },
});
