import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

export type IncomingReaction = {
  key: string;
  player_index: number;
  player_name: string;
  display: string;
  kind: 'emoji' | 'phrase';
};

type Props = {
  reactions: IncomingReaction[];
  playerCount: number;
  reduceMotion: boolean;
  onDone: (key: string) => void;
};

const DURATION_MS = 2500;
const RISE_PX = 80;

function FloatingReaction({
  reaction,
  playerCount,
  reduceMotion,
  onDone,
}: {
  reaction: IncomingReaction;
  playerCount: number;
  reduceMotion: boolean;
  onDone: (key: string) => void;
}) {
  const { width, height } = useWindowDimensions();
  const anim = useRef(new Animated.Value(0)).current;
  const jitter = useRef(Math.random() * 60 - 30).current;

  useEffect(() => {
    const animation = Animated.timing(anim, {
      toValue: 1,
      duration: DURATION_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) onDone(reaction.key);
    });
    return () => animation.stop();
  }, [anim, onDone, reaction.key]);

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, reduceMotion ? 0 : -RISE_PX],
  });
  const opacity = anim.interpolate({
    inputRange: [0, 0.12, 0.7, 1],
    outputRange: [0, 1, 1, 0],
  });

  const slot = ((reaction.player_index + 1) / (playerCount + 1)) * width;
  const left = Math.max(12, Math.min(width - 132, slot - 52 + jitter));
  const top = height * 0.52;

  return (
    <Animated.View style={[styles.item, { left, top, opacity, transform: [{ translateY }] }]}>
      {reaction.kind === 'emoji' ? (
        <Text style={styles.emoji}>{reaction.display}</Text>
      ) : (
        <View style={styles.phrasePill}>
          <Text style={styles.phraseText}>{reaction.display}</Text>
        </View>
      )}
      <Text style={styles.sender} numberOfLines={1}>
        {reaction.player_name}
      </Text>
    </Animated.View>
  );
}

export default function ReactionOverlay({ reactions, playerCount, reduceMotion, onDone }: Props) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {reactions.map((reaction) => (
        <FloatingReaction
          key={reaction.key}
          reaction={reaction}
          playerCount={playerCount}
          reduceMotion={reduceMotion}
          onDone={onDone}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    position: 'absolute',
    alignItems: 'center',
    maxWidth: 132,
  },
  emoji: {
    fontSize: 40,
  },
  phrasePill: {
    backgroundColor: 'rgba(20, 24, 38, 0.92)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  phraseText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  sender: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
});
