import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../utils/theme';
import { Suit } from './PlayingCard';

const NAMES: Record<Suit,string> = { S:'Spades', H:'Hearts', D:'Diamonds', C:'Clubs' };
const GLYPH: Record<Suit,string> = { S:'♠', H:'♥', D:'♦', C:'♣' };

export function StatusBarTop({ trump, round, totalRounds, yourTricks, yourBid, onLeave }:{
  trump: Suit; round:number; totalRounds:number; yourTricks:number; yourBid:number|null; onLeave:()=>void;
}) {
  const isRed = trump==='H' || trump==='D';
  return (
    <View style={styles.wrap}>
      <BlurView intensity={50} tint="dark" style={styles.blur}>
        <View style={styles.trumpBox}>
          <View style={styles.trumpChip}>
            <Text style={{ color: isRed ? '#C2293A' : '#161616', fontSize:18, fontWeight:'800' }}>{GLYPH[trump]}</Text>
          </View>
          <View>
            <Text style={styles.label}>TRUMP</Text>
            <Text style={styles.value}>{NAMES[trump]}</Text>
          </View>
        </View>
        <Stat label="Round" value={`${round}/${totalRounds}`} />
        <Stat label="Bid" value={yourBid ?? '—'} accent />
        <Stat label="Tricks" value={yourTricks} />
        <Pressable onPress={onLeave} style={styles.leave}>
          <Ionicons name="exit-outline" size={14} color={theme.ivory} />
        </Pressable>
      </BlurView>
    </View>
  );
}
function Stat({label,value,accent}:{label:string;value:string|number;accent?:boolean}) {
  return (
    <View style={{ paddingHorizontal:8 }}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={[styles.value, accent && { color: theme.gold }]}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { borderRadius:18, overflow:'hidden', borderWidth:1, borderColor: theme.border },
  blur: { flexDirection:'row', alignItems:'center', gap:8, paddingVertical:8, paddingHorizontal:10, backgroundColor:'rgba(8,18,14,0.6)' },
  trumpBox: { flexDirection:'row', alignItems:'center', gap:8, paddingRight:10, borderRightWidth:1, borderRightColor: theme.border },
  trumpChip: { width:36, height:36, borderRadius:10, backgroundColor:'#F5F1E6', alignItems:'center', justifyContent:'center' },
  label: { color:'rgba(245,241,230,0.5)', fontSize:9, letterSpacing:1.4, fontWeight:'600' },
  value: { color: theme.ivory, fontSize:12, fontWeight:'700' },
  leave: { marginLeft:'auto', backgroundColor:'rgba(255,255,255,0.06)', borderColor: theme.border, borderWidth:1, padding:8, borderRadius:12 },
});
