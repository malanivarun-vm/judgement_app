// Authoritative move countdown pill with a "siren" danger state:
// calm gold while there's time, pulsing red when ≤3 seconds remain.

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { COLORS } from '../utils/theme';

export const DANGER_AT_SECONDS = 3;

interface Props {
  /** Whole seconds remaining. */
  remaining: number;
  /** Total seconds for this move (for the progress bar). */
  total: number;
  /** Whose move is on the clock. */
  playerName: string;
  myTurn: boolean;
  reduceMotion?: boolean;
}

export default function TurnClock({ remaining, total, playerName, myTurn, reduceMotion }: Props) {
  const danger = remaining <= DANGER_AT_SECONDS;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!danger || reduceMotion) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 260,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 260,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [danger, reduceMotion, pulse]);

  const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;

  return (
    <Animated.View
      testID="turn-clock"
      style={[
        styles.pill,
        danger && styles.pillDanger,
        !reduceMotion && danger && {
          transform: [
            { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <Text
          style={[styles.label, danger && styles.labelDanger]}
          numberOfLines={1}
        >
          {myTurn ? 'YOUR MOVE' : playerName.toUpperCase()}
        </Text>
        <Text style={[styles.seconds, danger && styles.secondsDanger]}>
          {remaining}s
        </Text>
      </View>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${frac * 100}%` },
            danger && styles.fillDanger,
          ]}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    minWidth: 132,
    maxWidth: 210,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.35)',
    backgroundColor: 'rgba(8, 24, 17, 0.92)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 5,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  pillDanger: {
    borderColor: COLORS.danger,
    backgroundColor: 'rgba(60, 8, 8, 0.94)',
    shadowColor: COLORS.danger,
    shadowOpacity: 0.65,
    shadowRadius: 16,
    elevation: 10,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  label: {
    color: 'rgba(243,229,171,0.8)',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    flexShrink: 1,
  },
  labelDanger: {
    color: '#FFD3D3',
  },
  seconds: {
    color: COLORS.goldLight,
    fontSize: 15,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  secondsDanger: {
    color: '#FF6B6B',
  },
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  fill: {
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.gold,
  },
  fillDanger: {
    backgroundColor: COLORS.danger,
  },
});
