import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PlayingCard, CardModel } from './PlayingCard';
import { theme } from '../utils/theme';

export interface TrickCard { card: CardModel; playerName: string; playerHue: number; }

export function CenterTrick({ cards }:{ cards: TrickCard[] }) {
  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['rgba(94,168,134,0.35)','transparent']}
        style={StyleSheet.absoluteFill}
        start={{x:0.5,y:0.5}} end={{x:1,y:1}}
      />
      <View style={styles.stage}>
        {cards.length === 0 && (
          <Text style={styles.empty}>AWAITING PLAY</Text>
        )}
        {cards.map((c, i) => {
          const offset = (i - (cards.length-1)/2) * 32;
          const rotate = (i - (cards.length-1)/2) * 6;
          return (
            <Animated.View
              key={`${c.playerName}-${c.card.rank}-${c.card.suit}`}
              entering={FadeIn.springify().damping(20)}
              exiting={FadeOut}
              style={{ position:'absolute', transform:[{translateX:offset},{rotate:`${rotate}deg`}], zIndex: i+1 }}
            >
              <View style={[styles.tag,{ borderColor:`hsla(${c.playerHue},60%,55%,0.6)` }]}>
                <View style={[styles.dot,{ backgroundColor:`hsl(${c.playerHue},65%,55%)` }]} />
                <Text style={styles.tagText}>{c.playerName}</Text>
              </View>
              <PlayingCard card={c.card} size="lg" />
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex:1, alignItems:'center', justifyContent:'center' },
  stage: { width: '100%', height: '100%', minHeight: 180, alignItems:'center', justifyContent:'center' },
  empty: { color: 'rgba(245,241,230,0.4)', fontSize: 11, letterSpacing: 3, fontWeight:'600' },
  tag: { position:'absolute', top:-14, alignSelf:'center', zIndex:10, flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:8, paddingVertical:2, borderRadius:999, backgroundColor: theme.glassStrong, borderWidth:1 },
  tagText: { color: theme.ivory, fontSize: 10, fontWeight:'700' },
  dot: { width:6, height:6, borderRadius:3 },
});
