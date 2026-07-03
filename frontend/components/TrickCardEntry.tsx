// One-time mount animation for a card landing on the table: rises from
// the hand direction, scales up, settles with a slight rotation.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, AccessibilityInfo } from 'react-native';

interface Props {
  animate: boolean;
  children: React.ReactNode;
}

export default function TrickCardEntry({ animate, children }: Props) {
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!animate) return;
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [animate, reduceMotion, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['6deg', '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
