import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/theme';

export default function BidTensionMeter({
  total,
  available,
}: {
  total: number;
  available: number;
}) {
  const ratio = available > 0 ? total / available : 0;
  const fill = useRef(new Animated.Value(0)).current;
  const tight = total > available;
  const exact = total === available;

  useEffect(() => {
    Animated.spring(fill, {
      toValue: Math.min(1, ratio),
      speed: 13,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  }, [fill, ratio]);

  const verdict = exact ? 'PERFECTLY TIGHT' : tight ? 'OVERBOOKED' : 'ROOM TO MANOEUVRE';
  const color = exact || tight ? COLORS.danger : COLORS.success;

  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>TABLE TENSION</Text>
        <Text style={[styles.value, { color }]}>{total}/{available} · {verdict}</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        <View style={styles.dangerLine} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 5,
    paddingHorizontal: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
  },
  value: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  track: {
    height: 5,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    shadowColor: '#FFFFFF',
    shadowOpacity: 0.45,
    shadowRadius: 6,
  },
  dangerLine: {
    position: 'absolute',
    right: 0,
    width: 2,
    height: '100%',
    backgroundColor: COLORS.goldLight,
  },
});

