import React from 'react';
import { ScrollView, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PlayingCard, CardModel } from './PlayingCard';

export interface HandCard extends CardModel { id: string; playable: boolean; }

export function CardFan({ hand, onPlay }:{ hand: HandCard[]; onPlay:(id:string)=>void }) {
  const mid = (hand.length - 1) / 2;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {hand.map((c,i) => {
        const rot = (i - mid) * 4.5;
        const dy = Math.abs(i - mid) * 3;
        return (
          <Animated.View
            key={c.id}
            entering={FadeInUp.delay(i*50).springify()}
            style={{ marginLeft: i===0 ? 0 : -28, transform:[{translateY: dy},{rotate:`${rot}deg`}], opacity: c.playable ? 1 : 0.4 }}
          >
            <Pressable
              disabled={!c.playable}
              onPress={() => onPlay(c.id)}
              style={({pressed}) => ({ transform:[{translateY: pressed && c.playable ? -22 : 0}] })}
            >
              <PlayingCard card={c} size="lg" />
            </Pressable>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 8, alignItems:'flex-end' },
});
