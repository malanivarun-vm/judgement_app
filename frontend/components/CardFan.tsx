import React from 'react';
import { ScrollView, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { PlayingCard, CardModel } from './PlayingCard';

export interface HandCard extends CardModel { id: string; playable: boolean; }

export function CardFan({ hand, onPlay }:{ hand: HandCard[]; onPlay:(id:string)=>void }) {
  const { width } = useWindowDimensions();
  const mid = (hand.length - 1) / 2;
  
  const cardWidth = 82; // lg size width
  const availableWidth = width - 80; // subtracting padding
  const calculatedSpace = (availableWidth - cardWidth) / Math.max(1, hand.length - 1);
  const actualSpace = Math.max(20, Math.min(cardWidth * 0.65, calculatedSpace));
  const dynamicMarginLeft = actualSpace - cardWidth;

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
            entering={FadeInUp.delay(i*40).springify()}
            style={{ marginLeft: i===0 ? 0 : dynamicMarginLeft, transform:[{translateY: dy},{rotate:`${rot}deg`}], opacity: c.playable ? 1 : 0.4 }}
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
  content: { paddingHorizontal: 40, paddingTop: 28, paddingBottom: 16, alignItems:'flex-end' },
});
