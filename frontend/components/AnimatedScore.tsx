import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleProp, Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  suffix?: string;
  style?: StyleProp<TextStyle>;
  duration?: number;
  signed?: boolean;
}

export default function AnimatedScore({
  value,
  suffix = '',
  style,
  duration = 520,
  signed = false,
}: Props) {
  const animated = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const listener = animated.addListener(({ value: next }) => setDisplay(Math.round(next)));
    return () => animated.removeListener(listener);
  }, [animated]);

  useEffect(() => {
    Animated.timing(animated, {
      toValue: value,
      duration,
      useNativeDriver: false,
    }).start();
  }, [animated, duration, value]);

  return <Text style={style}>{signed && display > 0 ? '+' : ''}{display}{suffix}</Text>;
}
