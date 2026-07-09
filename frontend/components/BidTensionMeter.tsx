import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../utils/theme';

export default function BidTensionMeter({
  total,
  available,
  roundsPlayed,
  roundsTotal,
}: {
  total: number;
  available: number;
  roundsPlayed: number;
  roundsTotal: number;
}) {
  const ratio = available > 0 ? total / available : 0;
  const fill = useRef(new Animated.Value(0)).current;
  const tight = total > available;
  const diff = Math.abs(available - total);

  useEffect(() => {
    Animated.spring(fill, {
      toValue: Math.min(1, ratio),
      speed: 13,
      bounciness: 4,
      useNativeDriver: false,
    }).start();
  }, [fill, ratio]);

  const verdict = tight ? `TIGHT BY ${diff}` : `LOOSE BY ${diff}`;
  const color = tight ? COLORS.danger : COLORS.info;
  const chipTextColor = tight ? '#FFFFFF' : '#06110b';

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text style={styles.label}>TABLE TENSION</Text>
        <View style={[styles.chip, { backgroundColor: color }]}>
          <Text style={[styles.chipText, { color: chipTextColor }]}>{verdict}</Text>
        </View>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              shadowColor: color,
              width: fill.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
        <View style={styles.capLine} />
      </View>
      <View style={styles.row}>
        <Text style={styles.footText}>
          <Text style={styles.footBold}>{total} of {available}</Text> wins claimed
        </Text>
        <Text style={styles.footText}>
          ROUNDS <Text style={styles.footBold}>{roundsPlayed}/{roundsTotal}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    gap: 7,
    padding: 10,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceGlass,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 9,
  },
  chipText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  track: {
    height: 9,
    overflow: 'hidden',
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fill: {
    height: '100%',
    borderRadius: 99,
    shadowOpacity: 0.5,
    shadowRadius: 8,
  },
  capLine: {
    position: 'absolute',
    right: 0,
    width: 2.5,
    height: '100%',
    backgroundColor: COLORS.goldLight,
  },
  footText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  footBold: {
    color: COLORS.text,
    fontWeight: '800',
  },
});
