// Full-screen pulsing red edge glow for the final seconds of YOUR move.
// Pure Animated overlay — never intercepts touches.

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';

export default function SirenVignette({ reduceMotion }: { reduceMotion?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      pulse.setValue(0.6);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 300,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.15,
          duration: 300,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      testID="siren-vignette"
      pointerEvents="none"
      style={[styles.vignette, { opacity: pulse }]}
    >
      <Animated.View style={styles.edgeTop} />
      <Animated.View style={styles.edgeBottom} />
      <Animated.View style={styles.edgeLeft} />
      <Animated.View style={styles.edgeRight} />
    </Animated.View>
  );
}

const EDGE = 7;

const styles = StyleSheet.create({
  vignette: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  edgeTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: EDGE,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
  },
  edgeBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: EDGE,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -6 },
  },
  edgeLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: 6, height: 0 },
  },
  edgeRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: EDGE,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOpacity: 1,
    shadowRadius: 22,
    shadowOffset: { width: -6, height: 0 },
  },
});
