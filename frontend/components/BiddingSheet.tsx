import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInDown, SlideOutDown, FadeIn, FadeOut } from 'react-native-reanimated';
import { theme } from '../utils/theme';

export function BiddingSheet({ open, maxBid, forbiddenBid, onSubmit }:{
  open:boolean; maxBid:number; forbiddenBid?:number|null; onSubmit:(b:number)=>void;
}) {
  const [selected, setSelected] = useState<number|null>(null);
  const options = Array.from({length:maxBid+1},(_,i)=>i);

  return (
    <Modal visible={open} transparent animationType="none" statusBarTranslucent>
      <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.backdrop} />
      <Animated.View entering={SlideInDown.springify().damping(28)} exiting={SlideOutDown} style={styles.sheetWrap}>
        <BlurView intensity={60} tint="dark" style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.kicker}>BIDDING PHASE</Text>
          <Text style={styles.title}>How many tricks?</Text>
          <Text style={styles.sub}>Pick the number of tricks you'll win this round</Text>

          <View style={styles.grid}>
            {options.map(n => {
              const forbidden = forbiddenBid === n;
              const active = selected === n;
              return (
                <Pressable key={n} disabled={forbidden} onPress={() => setSelected(n)}
                  style={[styles.dial, forbidden && {opacity:0.3}, active && styles.dialActive]}>
                  <Text style={[styles.dialNum, active && { color:'#0B1F18' }, forbidden && { textDecorationLine:'line-through' }]}>{n}</Text>
                </Pressable>
              );
            })}
          </View>

          {forbiddenBid != null && (
            <Text style={styles.hint}>As the last bidder, you cannot bid <Text style={{color:theme.gold,fontWeight:'800'}}>{forbiddenBid}</Text></Text>
          )}

          <Pressable disabled={selected===null} onPress={() => selected!==null && onSubmit(selected)}>
            <LinearGradient
              colors={selected===null ? ['rgba(255,255,255,0.05)','rgba(255,255,255,0.05)'] : ['#F2CB57','#8A6E1E']}
              style={styles.cta}
            >
              <Text style={[styles.ctaText, selected===null && { color:'rgba(245,241,230,0.3)'}]}>
                {selected===null ? 'Select a bid' : `Lock in bid of ${selected}`}
              </Text>
            </LinearGradient>
          </Pressable>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.55)' },
  sheetWrap: { position:'absolute', left:12, right:12, bottom:16 },
  sheet: { borderRadius:28, padding:20, overflow:'hidden', borderWidth:1, borderColor: theme.border, backgroundColor:'rgba(8,18,14,0.75)' },
  handle: { alignSelf:'center', width:40, height:4, borderRadius:2, backgroundColor:'rgba(255,255,255,0.2)', marginBottom:14 },
  kicker: { color:'rgba(245,241,230,0.6)', textAlign:'center', fontSize:10, letterSpacing:3, fontWeight:'600' },
  title: { color: theme.gold, fontSize:20, fontWeight:'800', textAlign:'center', marginTop:4 },
  sub: { color:'rgba(245,241,230,0.6)', fontSize:12, textAlign:'center', marginTop:4, marginBottom:16 },
  grid: { flexDirection:'row', flexWrap:'wrap', gap:8, justifyContent:'center' },
  dial: { width:56, height:56, borderRadius:16, backgroundColor:'rgba(255,255,255,0.05)', borderWidth:1, borderColor: theme.border, alignItems:'center', justifyContent:'center' },
  dialActive: { backgroundColor: theme.gold, borderColor: theme.goldBright },
  dialNum: { color: theme.ivory, fontSize:20, fontWeight:'800' },
  hint: { color:'rgba(245,241,230,0.5)', fontSize:11, textAlign:'center', marginTop:12 },
  cta: { marginTop:18, paddingVertical:14, borderRadius:18, alignItems:'center' },
  ctaText: { color:'#0B1F18', fontWeight:'800', fontSize:15, letterSpacing:0.5 },
});
