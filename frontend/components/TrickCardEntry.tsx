// One-time mount animation for a card landing on the table: rises from
// the hand direction, scales up, settles with a slight rotation.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, AccessibilityInfo } from 'react-native';

interface Props {
  animate: boolean;
  playerIndex?: number;
  yourIndex?: number;
  playerCount?: number;
  children: React.ReactNode;
}

export default function TrickCardEntry({
  animate,
  playerIndex = 0,
  yourIndex = 0,
  playerCount = 1,
  children,
}: Props) {
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
    Animated.spring(progress, {
      toValue: 1,
      speed: 17,
      bounciness: 8,
      useNativeDriver: true,
    }).start();
  }, [animate, reduceMotion, progress]);

  const relativeSeat = (playerIndex - yourIndex + playerCount) % playerCount;
  const isLocal = relativeSeat === 0;
  const isLeft = !isLocal && relativeSeat <= playerCount / 2;
  const fromX = isLocal ? 0 : isLeft ? -130 : 130;
  const fromY = isLocal ? 150 : -105;
  const fromRotation = isLocal ? '0deg' : isLeft ? '-14deg' : '14deg';

  return (
    <Animated.View
      style={{
        opacity: progress.interpolate({ inputRange: [0, 0.22, 1], outputRange: [0, 1, 1] }),
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [fromX, 0] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [fromY, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [0.62, 1.08, 1] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: [fromRotation, '0deg'] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}
