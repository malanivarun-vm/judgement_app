import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { COLORS } from '../utils/theme';

export default function TravelingTurnMarker({
  x,
  y,
  reduceMotion,
  variant = 'turn',
}: {
  x: number;
  y: number;
  reduceMotion?: boolean;
  variant?: 'turn' | 'dealer';
}) {
  const position = useRef(new Animated.ValueXY({ x, y })).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      position.setValue({ x, y });
      return;
    }
    Animated.spring(position, {
      toValue: { x, y },
      speed: 11,
      bounciness: 5,
      useNativeDriver: false,
    }).start();
  }, [position, reduceMotion, x, y]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.marker, { left: position.x, top: position.y }]}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.8] }) }],
          },
        ]}
      />
      {variant === 'dealer' ? (
        <View style={styles.dealerCore}>
          <View style={styles.dealerInner}>
            <Animated.Text style={styles.dealerText}>D</Animated.Text>
          </View>
        </View>
      ) : (
        <View style={styles.core} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  marker: {
    position: 'absolute',
    width: 18,
    height: 18,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: COLORS.gold,
  },
  core: {
    width: 8,
    height: 8,
    transform: [{ rotate: '45deg' }],
    backgroundColor: COLORS.goldLight,
    shadowColor: COLORS.gold,
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 10,
  },
  dealerCore: {
    width: 18,
    height: 18,
    borderRadius: 9,
    padding: 2,
    backgroundColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.8,
    shadowRadius: 9,
    elevation: 10,
  },
  dealerInner: {
    flex: 1,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.35)',
  },
  dealerText: {
    color: '#07140D',
    fontSize: 9,
    lineHeight: 10,
    fontWeight: '900',
  },
});
