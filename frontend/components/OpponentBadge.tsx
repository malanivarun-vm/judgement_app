import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { theme } from '../utils/theme';

export interface Opponent {
  id: string; name: string; score: number;
  bid: number | null; tricksWon: number;
  isActive: boolean; avatarHue: number; cardsLeft: number;
}

export function OpponentBadge({ o }:{ o: Opponent }) {
  const glow = useSharedValue(0);
  useEffect(() => {
    if (o.isActive) {
      glow.value = withRepeat(withTiming(1,{duration:1100,easing:Easing.inOut(Easing.ease)}), -1, true);
    } else glow.value = 0;
  }, [o.isActive]);
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + glow.value*0.45,
    shadowRadius: 8 + glow.value*14,
    borderColor: o.isActive ? theme.gold : theme.border,
  }));

  const made = o.bid !== null && o.tricksWon === o.bid;

  return (
    <Animated.View style={[styles.wrap, glowStyle, { shadowColor: theme.gold }]}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <View style={[styles.avatar, { backgroundColor: `hsl(${o.avatarHue},45%,40%)` }]}>
          <Text style={styles.avatarText}>{o.name.charAt(0)}</Text>
          <View style={styles.cardsBadge}>
            <Text style={styles.cardsBadgeText}>{o.cardsLeft}</Text>
          </View>
        </View>
        <View style={{flex:1, minWidth:0}}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{o.name}</Text>
            <Text style={styles.score}>{o.score}</Text>
          </View>
          <View style={[styles.row,{marginTop:4, gap:6}]}>
            <Pill label="Bid" value={o.bid ?? '—'} />
            <Pill label="Won" value={o.tricksWon} highlight={made} />
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
}

function Pill({label,value,highlight}:{label:string;value:string|number;highlight?:boolean}) {
  return (
    <View style={[styles.pill, highlight && { backgroundColor:'rgba(212,175,55,0.18)', borderColor: theme.gold }]}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius:18, borderWidth:1, overflow:'hidden' },
  blur: { padding:10, flexDirection:'row', alignItems:'center', gap:10, backgroundColor:'rgba(10,22,18,0.4)' },
  avatar: { width:42, height:42, borderRadius:21, alignItems:'center', justifyContent:'center' },
  avatarText: { color: theme.ivory, fontWeight:'800', fontSize:16 },
  cardsBadge: { position:'absolute', bottom:-4, right:-4, backgroundColor:theme.glassStrong, borderRadius:10, paddingHorizontal:5, paddingVertical:1 },
  cardsBadgeText: { color: theme.ivory, fontSize:10, fontWeight:'700' },
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  name: { color: theme.ivory, fontWeight:'600', fontSize:13, flex:1 },
  score: { color: theme.gold, fontWeight:'800', fontSize:14 },
  pill: { flexDirection:'row', alignItems:'center', gap:4, paddingHorizontal:6, paddingVertical:2, borderRadius:6, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor:'rgba(255,255,255,0.1)' },
  pillLabel: { color:'rgba(245,241,230,0.6)', fontSize:9, textTransform:'uppercase', letterSpacing:0.5 },
  pillValue: { color: theme.ivory, fontSize:11, fontWeight:'700' },
});
