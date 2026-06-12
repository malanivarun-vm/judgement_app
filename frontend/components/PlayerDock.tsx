import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, interpolate, FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { theme } from '../utils/theme';
import { TouchableOpacity } from 'react-native';

export function PlayerDock({ name, score, bid, tricksWon, isYourTurn, onEmotePress, activeEmote }:{
  name:string; score:number; bid:number|null; tricksWon:number; isYourTurn:boolean;
  onEmotePress?: () => void;
  activeEmote?: { emoji: string, key: number } | null;
}) {
  const sweep = useSharedValue(0);
  useEffect(() => {
    if (isYourTurn) sweep.value = withRepeat(withTiming(1,{duration:2400,easing:Easing.inOut(Easing.ease)}), -1, false);
    else sweep.value = 0;
  }, [isYourTurn]);
  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(sweep.value, [0,1], [-220, 320]) }, { skewX:'-12deg' }],
    opacity: isYourTurn ? 1 : 0,
  }));
  const made = bid !== null && tricksWon === bid;

  return (
    <View style={[styles.wrap, isYourTurn && { borderColor: theme.gold, shadowColor: theme.gold, shadowOpacity:0.6, shadowRadius:18 }]}>
      <BlurView intensity={40} tint="dark" style={styles.blur}>
        <Animated.View style={[StyleSheet.absoluteFill, sweepStyle, { overflow:'hidden' }]} pointerEvents="none">
          <LinearGradient
            colors={['transparent','rgba(242,203,87,0.35)','transparent']}
            start={{x:0,y:0}} end={{x:1,y:0}}
            style={{ width:140, height:'100%' }}
          />
        </Animated.View>

        <View style={{ position: 'relative' }}>
          <LinearGradient colors={['#F2CB57','#8A6E1E']} style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0)}</Text>
          </LinearGradient>
          {activeEmote && (
            <Animated.View key={activeEmote.key} entering={FadeInDown.springify()} exiting={FadeOutUp} style={{position:'absolute', top:-24, right:-16, backgroundColor:'rgba(0,0,0,0.4)', borderRadius:20, padding:4, zIndex:99, borderWidth:1, borderColor:theme.border}}>
              <Text style={{fontSize:24}}>{activeEmote.emoji}</Text>
            </Animated.View>
          )}
        </View>

        <View style={{flex:1, minWidth:0}}>
          <View style={styles.row}>
            <Text style={styles.name}>{name}</Text>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
              {isYourTurn && <Text style={styles.turn}>YOUR TURN</Text>}
              {onEmotePress && (
                <TouchableOpacity onPress={onEmotePress} style={{backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4}}>
                  <Text style={{fontSize: 14}}>😊</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
          <View style={[styles.row,{gap:8, marginTop:6}]}>
            <Stat label="Score" value={score} accent />
            <Stat label="Bid" value={bid ?? '—'} />
            <Stat label="Won" value={tricksWon} highlight={made} />
          </View>
        </View>
      </BlurView>
    </View>
  );
}

function Stat({label,value,accent,highlight}:{label:string;value:string|number;accent?:boolean;highlight?:boolean}) {
  return (
    <View style={[styles.stat, highlight && { backgroundColor:'rgba(212,175,55,0.18)', borderColor: theme.gold }]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, accent && { color: theme.gold }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 20, borderWidth: 1, borderColor: theme.border, overflow: 'hidden' },
  blur: { flexDirection:'row', alignItems:'center', gap:14, padding:14, backgroundColor:'rgba(8,18,14,0.55)' },
  avatar: { width:48, height:48, borderRadius:24, alignItems:'center', justifyContent:'center' },
  avatarText: { color: theme.ivory, fontSize:18, fontWeight:'800' },
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  name: { color: theme.ivory, fontWeight:'700', fontSize:14 },
  turn: { color: theme.gold, fontSize: 10, fontWeight:'800', letterSpacing: 2 },
  stat: { flex:1, paddingVertical:4, paddingHorizontal:6, borderRadius:10, borderWidth:1, borderColor: theme.border, backgroundColor:'rgba(255,255,255,0.05)', alignItems:'center' },
  statLabel: { color:'rgba(245,241,230,0.55)', fontSize:9, textTransform:'uppercase', letterSpacing:1 },
  statValue: { color: theme.ivory, fontWeight:'800', fontSize:14, marginTop:2 },
});
