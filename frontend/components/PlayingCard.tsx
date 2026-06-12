import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../utils/theme';

export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = '2'|'3'|'4'|'5'|'6'|'7'|'8'|'9'|'10'|'J'|'Q'|'K'|'A';
export interface CardModel { suit: Suit; rank: Rank }

const GLYPH: Record<Suit,string> = { S:'♠', H:'♥', D:'♦', C:'♣' };
const SIZES = {
  sm: { w: 44, h: 62, font: 11 },
  md: { w: 60, h: 86, font: 13 },
  lg: { w: 82, h: 118, font: 16 },
};

export function PlayingCard({ card, size='md', faceDown=false }:{
  card?: CardModel; size?: keyof typeof SIZES; faceDown?: boolean;
}) {
  const s = SIZES[size];
  if (faceDown || !card) {
    return (
      <LinearGradient
        colors={['#1B3B30','#0B1F18']}
        start={{x:0,y:0}} end={{x:1,y:1}}
        style={[styles.card,{width:s.w,height:s.h,borderRadius:s.w*0.14}]}
      >
        <View style={[styles.cardInner,{borderColor:theme.goldDim}]}>
          <Text style={{color:theme.gold,fontWeight:'800',fontSize:s.font+4}}>J</Text>
        </View>
      </LinearGradient>
    );
  }
  const isRed = card.suit==='H' || card.suit==='D';
  const color = isRed ? '#C2293A' : '#161616';
  return (
    <LinearGradient
      colors={['#FBFAF6','#F1EDE1']} start={{x:0,y:0}} end={{x:0,y:1}}
      style={[styles.card,{width:s.w,height:s.h,borderRadius:s.w*0.14}]}
    >
      <View style={styles.corner}>
        <Text style={{color,fontWeight:'800',fontSize:s.font}}>{card.rank}</Text>
        <Text style={{color,fontSize:s.font}}>{GLYPH[card.suit]}</Text>
      </View>
      <View style={styles.center}>
        <Text style={{color, fontSize: s.font*2.2, opacity:0.9}}>{GLYPH[card.suit]}</Text>
      </View>
      <View style={[styles.corner,styles.cornerBR]}>
        <Text style={{color,fontWeight:'800',fontSize:s.font}}>{card.rank}</Text>
        <Text style={{color,fontSize:s.font}}>{GLYPH[card.suit]}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    shadowColor:'#000', shadowOpacity:0.5, shadowRadius:10, shadowOffset:{width:0,height:8}, elevation:6,
  },
  cardInner: { flex:1, margin:6, borderWidth:1, borderRadius:8, alignItems:'center', justifyContent:'center' },
  corner: { position:'absolute', top:4, left:6, alignItems:'center' },
  cornerBR: { top: undefined, left: undefined, bottom: 4, right: 6, transform:[{rotate:'180deg'}] },
  center: { flex:1, alignItems:'center', justifyContent:'center' },
});
