// Game-over podium choreography: staggered entrances plus the winner's
// coronation (crown drop + pulsing gold ring). Transform/opacity only so
// everything stays on the native driver; reduce-motion renders the final
// still frame immediately.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { COLORS } from '../utils/theme';

const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

interface EntranceProps {
  delay?: number;
  duration?: number;
  distance?: number;
  reduceMotion?: boolean;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
}

/** Fade + rise entrance for one element of the game-over screen. */
export function EntranceView({
  delay = 0,
  duration = 420,
  distance = 16,
  reduceMotion,
  style,
  children,
}: EntranceProps) {
  const t = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      t.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(t, {
        toValue: 1,
        duration,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [t, delay, duration, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [
            {
              translateY: t.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

interface AuraProps {
  size: number;
  crownDelay?: number;
  reduceMotion?: boolean;
  style?: ViewStyle;
  children: React.ReactNode;
}

/**
 * Wraps the winner's avatar: the avatar pops in, a crown drops onto it,
 * then a soft gold ring keeps pulsing outward.
 */
export function WinnerAura({ size, crownDelay = 0, reduceMotion, style, children }: AuraProps) {
  const pop = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const crown = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(1);
      crown.setValue(1);
      return;
    }
    const anim = Animated.sequence([
      Animated.delay(Math.max(0, crownDelay - 260)),
      Animated.spring(pop, {
        toValue: 1,
        speed: 16,
        bounciness: 5,
        useNativeDriver: true,
      }),
    ]);
    anim.start();

    const crownAnim = Animated.sequence([
      Animated.delay(crownDelay),
      Animated.timing(crown, {
        toValue: 1,
        duration: 380,
        easing: EASE_OUT,
        useNativeDriver: true,
      }),
    ]);
    crownAnim.start();

    const pulseLoop = Animated.sequence([
      Animated.delay(crownDelay + 380),
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 1500,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ),
    ]);
    pulseLoop.start();

    return () => {
      anim.stop();
      crownAnim.stop();
      pulseLoop.stop();
    };
  }, [pop, crown, pulse, crownDelay, reduceMotion]);

  const ringInset = -7;

  return (
    <Animated.View
      style={[
        styles.wrap,
        style,
        { width: size, height: size, transform: [{ scale: reduceMotion ? 1 : pop }] },
      ]}
    >
      {!reduceMotion && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.ring,
            {
              top: ringInset,
              bottom: ringInset,
              left: ringInset,
              right: ringInset,
              borderRadius: size / 2 - ringInset,
              opacity: pulse.interpolate({
                inputRange: [0, 0.15, 1],
                outputRange: [0, 0.65, 0],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1.45],
                  }),
                },
              ],
            },
          ]}
        />
      )}
      {children}
      <Animated.Text
        pointerEvents="none"
        style={[
          styles.crown,
          {
            top: -size * 0.3,
            right: -size * 0.18,
            fontSize: size * 0.44,
            opacity: crown,
            transform: [
              {
                translateY: crown.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-10, 0],
                }),
              },
              {
                scale: crown.interpolate({
                  inputRange: [0, 0.7, 1],
                  outputRange: [1.35, 1.06, 1],
                }),
              },
              { rotate: '20deg' },
            ],
          },
        ]}
      >
        👑
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  crown: {
    position: 'absolute',
  },
});
