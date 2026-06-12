import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
  StatusBar as RNStatusBar,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, SUIT_DISPLAY_COLORS, theme } from '../utils/theme';
import { audioService } from '../utils/audio';
import Reanimated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import ScoreBoard from '../components/ScoreBoard';
import { StatusBarTop } from '../components/StatusBarTop';
import { OpponentBadge, Opponent } from '../components/OpponentBadge';
import { CenterTrick, TrickCard } from '../components/CenterTrick';
import { CardFan, HandCard } from '../components/CardFan';
import { PlayerDock } from '../components/PlayerDock';
import { BiddingSheet } from '../components/BiddingSheet';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 24) : 0;

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

interface GameState {
  type: string;
  room_id: string;
  phase: string;
  players: {
    id: string;
    name: string;
    is_host: boolean;
    bid: number | null;
    tricks_won: number;
    total_score: number;
    card_count: number;
    is_connected: boolean;
    has_bid: boolean;
  }[];
  your_id: string;
  your_index: number;
  your_hand: { suit: string; rank: string }[];
  current_round: number;
  total_rounds: number;
  cards_this_round: number;
  trump_suit: string;
  dealer_index: number;
  current_player_index: number;
  current_trick: { player_index: number; card: { suit: string; rank: string } }[];
  lead_suit: string | null;
  tricks_played: number;
  round_history: any[];
  restricted_bids: number[];
  last_completed_trick: any;
}

export default function GameScreen() {
  const params = useLocalSearchParams<{
    room_id: string;
    player_name: string;
    player_id: string;
    is_host: string;
  }>();
  const router = useRouter();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [error, setError] = useState('');
  const [trickResult, setTrickResult] = useState<any>(null);
  const [activeEmotes, setActiveEmotes] = useState<Record<string, {emoji:string, key:number}>>({});
  const [showEmotePicker, setShowEmotePicker] = useState(false);
  const EMOTES = ['😂', '😡', '😭', '🤯', '😎', '🎉', '🤡', '💀'];
  const [reduceMotion, setReduceMotion] = useState(false);
  const trickResultTimer = useRef<any>(null);
  const prevTrickRef = useRef<string>('');
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const turnPulse = useRef(new Animated.Value(0)).current;
  const trickPop = useRef(new Animated.Value(0)).current;
  const phaseAnim = useRef(new Animated.Value(1)).current;
  const errorSlide = useRef(new Animated.Value(-60)).current;
  const prevPhaseRef = useRef<string>('');
  const opponentScaleAnims = useRef(
    Array.from({ length: 6 }, () => new Animated.Value(1))
  ).current;
  const trickCardAnims = useRef(
    Array.from({ length: 7 }, () => ({ scale: new Animated.Value(1), opacity: new Animated.Value(1) }))
  ).current;
  const prevTrickLenRef = useRef(0);
  const reduceMotionRef = useRef(false);
  const { width: SCREEN_W } = useWindowDimensions();

  useEffect(() => {
    void audioService.init();
    return () => { void audioService.unloadAll(); };
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    if (!gameState) {
      const t = setTimeout(() => setLoadingTimeout(true), 5000);
      return () => clearTimeout(t);
    } else {
      setLoadingTimeout(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientPulse, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(ambientPulse, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [ambientPulse, reduceMotion]);

  const fireHaptic = useCallback(async (kind: 'selection' | 'light' | 'medium' | 'success' | 'error') => {
    try {
      if (kind === 'selection') {
        await Haptics.selectionAsync();
      } else if (kind === 'light') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (kind === 'medium') {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (kind === 'success') {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch {
      // ignore unsupported platforms
    }
  }, []);

  const connect = useCallback(() => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) return;

    const wsProtocol = BACKEND_URL.startsWith('https') ? 'wss' : 'ws';
    const wsHost = BACKEND_URL.replace(/^https?:\/\//, '');
    const url = `${wsProtocol}://${wsHost}/api/ws/${params.room_id}?player_name=${encodeURIComponent(params.player_name || '')}&player_id=${params.player_id}&is_host=${params.is_host}`;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setError('');
      void fireHaptic('selection');
    };

    socket.onclose = () => {
      setConnected(false);
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    socket.onerror = () => {
      setError('Connection error');
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'state') {
          setGameState(data);
          // Handle trick completion display
          if (data.last_completed_trick) {
            const key = `${data.current_round}-${data.tricks_played}`;
            if (prevTrickRef.current !== key) {
              prevTrickRef.current = key;
              setTrickResult(data.last_completed_trick);
              void audioService.play('win_trick');
              if (!reduceMotionRef.current) {
                trickPop.setValue(0);
                Animated.timing(trickPop, {
                  toValue: 1,
                  duration: 260,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start();
              }
              void fireHaptic('success');
              if (trickResultTimer.current) clearTimeout(trickResultTimer.current);
              trickResultTimer.current = setTimeout(() => setTrickResult(null), 2500);
            }
          }
        } else if (data.type === 'emote') {
          const timestamp = Date.now();
          setActiveEmotes(prev => ({...prev, [data.player_id]: { emoji: data.emoji, key: timestamp }}));
          setTimeout(() => {
            setActiveEmotes(prev => {
              const current = prev[data.player_id];
              if (current && current.key === timestamp) {
                const copy = {...prev};
                delete copy[data.player_id];
                return copy;
              }
              return prev;
            });
          }, 3000);
        } else if (data.type === 'error') {
          setError(data.message);
          void fireHaptic('error');
          setTimeout(() => setError(''), 4000);
        }
      } catch {
        // ignore parse errors
      }
    };
  }, [fireHaptic, params.room_id, params.player_name, params.player_id, params.is_host, trickPop]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (trickResultTimer.current) clearTimeout(trickResultTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  const send = (action: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(action));
    }
  };

  const handleLeave = () => {
    Alert.alert('Leave Game', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          ws.current?.close();
          router.replace('/');
        },
      },
    ]);
  };

  const sendAction = async (action: any, haptic: 'selection' | 'light' | 'medium' | 'success' = 'selection') => {
    await fireHaptic(haptic);
    send(action);
  };

  useEffect(() => {
    if (!gameState || reduceMotion) return;
    const shouldPulse = gameState.current_player_index === gameState.your_index;
    if (shouldPulse) {
      turnPulse.setValue(0.2);
      Animated.spring(turnPulse, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 110,
      }).start();
    } else {
      Animated.timing(turnPulse, {
        toValue: 0.2,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [gameState, reduceMotion, turnPulse]);

  // Phase crossfade
  useEffect(() => {
    if (!gameState || reduceMotion) return;
    if (prevPhaseRef.current && prevPhaseRef.current !== gameState.phase) {
      Animated.sequence([
        Animated.timing(phaseAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        Animated.timing(phaseAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
    prevPhaseRef.current = gameState.phase;
  }, [gameState?.phase, reduceMotion]);

  // Opponent seat glow spring on active player change
  useEffect(() => {
    if (!gameState || reduceMotion) return;
    opponentScaleAnims.forEach((anim, i) => {
      const opp = gameState.players.filter((p) => p.id !== gameState.your_id)[i];
      if (!opp) return;
      const oppIdx = gameState.players.findIndex((p) => p.id === opp.id);
      const isActive = gameState.current_player_index === oppIdx;
      if (isActive) {
        Animated.sequence([
          Animated.spring(anim, { toValue: 1.06, friction: 4, tension: 280, useNativeDriver: true }),
          Animated.spring(anim, { toValue: 1,    friction: 5, tension: 200, useNativeDriver: true }),
        ]).start();
      } else {
        Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      }
    });
  }, [gameState?.current_player_index, reduceMotion]);

  // Trick card entrance stagger
  useEffect(() => {
    if (!gameState || reduceMotion) return;
    const len = gameState.current_trick?.length ?? 0;
    if (len > prevTrickLenRef.current) {
      const newIdx = len - 1;
      const anim = trickCardAnims[newIdx];
      if (anim) {
        anim.scale.setValue(0.6);
        anim.opacity.setValue(0);
        Animated.parallel([
          Animated.spring(anim.scale,   { toValue: 1, friction: 5, tension: 200, useNativeDriver: true }),
          Animated.timing(anim.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ]).start();
      }
    } else if (len === 0) {
      // Reset all on trick clear
      trickCardAnims.forEach(a => { a.scale.setValue(1); a.opacity.setValue(1); });
    }
    prevTrickLenRef.current = len;
  }, [gameState?.current_trick?.length, reduceMotion]);

  // Error banner slide
  useEffect(() => {
    if (reduceMotion) return;
    if (error) {
      Animated.spring(errorSlide, { toValue: 0, friction: 7, tension: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(errorSlide, { toValue: -60, duration: 200, useNativeDriver: true }).start();
    }
  }, [error, reduceMotion]);

  // Loading state
  if (!gameState) {
    return (
      <LinearGradient colors={['#0F2B1D','#060e09']} style={{flex:1}}>
        <SafeAreaView style={{flex:1, justifyContent:'center', alignItems:'center'}}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={{color: COLORS.gold, marginTop: 16, fontSize: 16, fontWeight: '600', letterSpacing: 1}}>
            {connected ? 'Loading game...' : 'Connecting to Server...'}
          </Text>
          {loadingTimeout && !connected && (
            <Animated.View entering={FadeIn} style={{marginTop: 32, alignItems:'center', paddingHorizontal: 40}}>
              <Text style={{color: 'rgba(255,255,255,0.5)', marginBottom: 20, textAlign: 'center'}}>
                The server seems to be unreachable. Please check your connection.
              </Text>
              <TouchableOpacity onPress={handleLeave} style={{paddingVertical: 12, paddingHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)'}}>
                <Text style={{color: '#FFF', fontWeight: '600'}}>Go Back</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </SafeAreaView>
      </LinearGradient>
    );
  }

  const { phase, players, your_id, your_index } = gameState;
  const isHost = players.find((p) => p.id === your_id)?.is_host || false;
  const myInfo = players[your_index] || players.find((p) => p.id === your_id);
  const activePlayer = players[gameState.current_player_index];
  const isMyTurn = gameState.current_player_index === your_index;
  const opponents = players.filter((p) => p.id !== your_id);

  // Playable cards logic
  const getPlayableIndices = (): Set<number> => {
    if (phase !== 'playing' || !isMyTurn) return new Set();
    const hand = gameState.your_hand;
    const lead = gameState.lead_suit;
    if (!lead) return new Set(hand.map((_, i) => i));
    const suitCards = hand.map((c, i) => ({ c, i })).filter(({ c }) => c.suit === lead);
    if (suitCards.length > 0) return new Set(suitCards.map(({ i }) => i));
    return new Set(hand.map((_, i) => i));
  };
  const playableIndices = getPlayableIndices();

  // === WAITING / LOBBY ===
  if (phase === 'waiting') {
    return (
      <LinearGradient colors={['#0F2B1D','#060e09']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <View style={{paddingHorizontal: 24, paddingTop: 20, paddingBottom: 40, flex: 1}}>
            <TouchableOpacity testID="leave-btn" onPress={handleLeave} style={{alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 24}}>
              <Text style={{color: theme.ivory, fontWeight: '600'}}>← Back</Text>
            </TouchableOpacity>

            <Text style={{color: theme.gold, fontSize: 32, fontWeight: '900', letterSpacing: 6, textAlign: 'center', marginBottom: 32}}>JUDGEMENT</Text>

            <View style={{backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 40}}>
              <Text style={{color: 'rgba(245,241,230,0.5)', fontSize: 10, letterSpacing: 2, fontWeight: '800', marginBottom: 8}}>ROOM CODE</Text>
              <Text style={{color: theme.goldLight || theme.goldBright, fontSize: 42, fontWeight: '900', letterSpacing: 12}}>{gameState.room_id}</Text>
              <Text style={{color: 'rgba(245,241,230,0.5)', fontSize: 12, marginTop: 8}}>Share this code with friends</Text>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16}}>
              <Text style={{color: theme.ivory, fontSize: 18, fontWeight: '700'}}>Players</Text>
              <Text style={{color: theme.gold, fontSize: 14, fontWeight: '800'}}>{players.length}/7</Text>
            </View>

            <ScrollView contentContainerStyle={{gap: 12}} showsVerticalScrollIndicator={false}>
              {players.map((p, i) => (
                <View key={p.id} testID={`player-${p.id}`} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 12}}>
                  <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: `hsl(${(i * 137) % 360},45%,40%)`, alignItems: 'center', justifyContent: 'center', marginRight: 16}}>
                    <Text style={{color: theme.ivory, fontWeight: '800', fontSize: 18}}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={{color: theme.ivory, fontSize: 16, fontWeight: '600', flex: 1}}>{p.name}</Text>
                  {p.is_host && <View style={{backgroundColor: 'rgba(212,175,55,0.15)', borderWidth: 1, borderColor: theme.goldDim, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 8}}><Text style={{color: theme.gold, fontSize: 10, fontWeight: '800', letterSpacing: 1}}>HOST</Text></View>}
                  {p.id === your_id && <View style={{backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: theme.border, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8}}><Text style={{color: theme.ivory, fontSize: 10, fontWeight: '800', letterSpacing: 1}}>YOU</Text></View>}
                </View>
              ))}
            </ScrollView>

            <View style={{marginTop: 24}}>
              {isHost && players.length >= 3 && (
                <TouchableOpacity testID="start-game-btn" onPress={() => void sendAction({ action: 'start_game' }, 'medium')} style={{backgroundColor: theme.gold, paddingVertical: 18, borderRadius: 99, alignItems: 'center', shadowColor: theme.gold, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 4}}}>
                  <Text style={{color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1}}>Start Game</Text>
                </TouchableOpacity>
              )}
              {isHost && players.length < 3 && (
                <Text style={{color: 'rgba(245,241,230,0.5)', textAlign: 'center', fontSize: 14}}>Need at least 3 players to start</Text>
              )}
              {!isHost && (
                <Text style={{color: 'rgba(245,241,230,0.5)', textAlign: 'center', fontSize: 14}}>Waiting for host to start...</Text>
              )}
            </View>
            {error ? <Text style={{color: theme.rose, textAlign: 'center', marginTop: 16}}>{error}</Text> : null}
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // === GAME OVER ===
  if (phase === 'game_over') {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    return (
      <LinearGradient colors={['#0F2B1D','#060e09']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <ScrollView contentContainerStyle={{paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60, flexGrow: 1, alignItems: 'center'}}>
            <Text style={{color: theme.gold, fontSize: 36, fontWeight: '900', letterSpacing: 4, marginBottom: 40, textShadowColor: theme.gold, textShadowRadius: 20}}>GAME OVER</Text>

            <View style={{width: '100%', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: theme.border, borderRadius: 24, padding: 24, marginBottom: 40}}>
              <Text style={{color: theme.ivory, fontSize: 18, fontWeight: '800', marginBottom: 20, textAlign: 'center'}}>Final Standings</Text>
              {sorted.map((p, i) => (
                <View key={p.id} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: i === 0 ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: i === 0 ? theme.goldDim : theme.border, borderRadius: 16, padding: 12, marginBottom: 12}}>
                  <Text style={{color: i === 0 ? theme.gold : theme.ivory, fontSize: 18, fontWeight: '900', width: 30}}>#{i + 1}</Text>
                  <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: `hsl(${(i * 137) % 360},45%,40%)`, alignItems: 'center', justifyContent: 'center', marginRight: 16}}>
                    <Text style={{color: theme.ivory, fontWeight: '800', fontSize: 18}}>{p.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={{color: i === 0 ? theme.goldLight : theme.ivory, fontSize: 16, fontWeight: '700', flex: 1}}>{p.name}</Text>
                  <Text style={{color: i === 0 ? theme.gold : theme.ivory, fontSize: 18, fontWeight: '900'}}>{p.total_score} pts</Text>
                </View>
              ))}
            </View>

            <View style={{width: '100%', marginBottom: 40}}>
              <ScoreBoard roundHistory={gameState.round_history} players={players} />
            </View>

            <View style={{width: '100%', gap: 16}}>
              {isHost && (
                <TouchableOpacity onPress={() => void sendAction({ action: 'new_game' }, 'medium')} style={{backgroundColor: theme.gold, paddingVertical: 18, borderRadius: 99, alignItems: 'center', shadowColor: theme.gold, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 4}}}>
                  <Text style={{color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1}}>Play Again</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => { ws.current?.close(); router.replace('/'); }} style={{backgroundColor: 'transparent', borderWidth: 1.5, borderColor: theme.goldDim, paddingVertical: 18, borderRadius: 99, alignItems: 'center'}}>
                <Text style={{color: theme.goldLight, fontSize: 16, fontWeight: '800', letterSpacing: 1}}>Back to Home</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // === ROUND END ===
  if (phase === 'round_end') {
    return (
      <LinearGradient colors={['#0F2B1D','#060e09']} style={{flex:1}}>
        <SafeAreaView style={{flex:1}}>
          <ScrollView contentContainerStyle={{paddingHorizontal: 24, paddingTop: 40, paddingBottom: 60, flexGrow: 1, alignItems: 'center'}}>
            <Text style={{color: theme.gold, fontSize: 32, fontWeight: '900', letterSpacing: 4, marginBottom: 40}}>Round Complete</Text>

            <View style={{width: '100%', marginBottom: 40}}>
              <ScoreBoard roundHistory={gameState.round_history} players={players} currentRound={gameState.current_round} />
            </View>

            <View style={{width: '100%', gap: 16}}>
              {isHost && (
                <TouchableOpacity onPress={() => void sendAction({ action: 'next_round' }, 'medium')} style={{backgroundColor: theme.gold, paddingVertical: 18, borderRadius: 99, alignItems: 'center', shadowColor: theme.gold, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: {width: 0, height: 4}}}>
                  <Text style={{color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1}}>Next Round</Text>
                </TouchableOpacity>
              )}
              {!isHost && (
                <Text style={{color: 'rgba(245,241,230,0.5)', textAlign: 'center', fontSize: 14}}>Waiting for host to start next round...</Text>
              )}
              {error ? <Text style={{color: theme.rose, textAlign: 'center', marginTop: 16}}>{error}</Text> : null}
            </View>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // === BIDDING / PLAYING (Main Game Table) ===
  const displayTrickCards = trickResult
    ? trickResult.cards
    : gameState.current_trick;

  const mapSuit = (suit: string): 'S'|'H'|'D'|'C' => {
    switch(suit) {
      case 'hearts': return 'H';
      case 'diamonds': return 'D';
      case 'clubs': return 'C';
      default: return 'S';
    }
  };

  const hand: HandCard[] = gameState.your_hand.map((c, i) => ({
    id: `${c.suit}-${c.rank}-${i}`,
    suit: mapSuit(c.suit),
    rank: c.rank as any,
    playable: phase === 'playing' && isMyTurn ? playableIndices.has(i) : true
  }));

  const trick: TrickCard[] = displayTrickCards.map((tc: any) => ({
    card: { suit: mapSuit(tc.card.suit), rank: tc.card.rank as any },
    playerName: players[tc.player_index]?.name || '?',
    playerHue: (tc.player_index * 137) % 360,
  }));

  const mappedOpponents: Opponent[] = opponents.map((opp, idx) => {
    const pIdx = players.findIndex(p => p.id === opp.id);
    return {
      id: opp.id,
      name: opp.name,
      score: opp.total_score,
      bid: opp.bid,
      tricksWon: opp.tricks_won,
      isActive: opp.id === activePlayer?.id,
      avatarHue: ((idx + 1) * 137) % 360,
      cardsLeft: opp.card_count,
      activeEmote: activeEmotes[opp.id] || null,
    };
  });

  const mappedSeatCount = mappedOpponents.length;
  const leftOpps: Opponent[] = [];
  const topOpps: Opponent[] = [];
  const rightOpps: Opponent[] = [];

  mappedOpponents.forEach((opp, i) => {
    if (mappedSeatCount === 1) {
      topOpps.push(opp);
    } else if (mappedSeatCount === 2) {
      if (i===0) leftOpps.push(opp); else rightOpps.push(opp);
    } else if (mappedSeatCount === 3) {
      if (i===0) leftOpps.push(opp);
      else if (i===1) topOpps.push(opp);
      else rightOpps.push(opp);
    } else if (mappedSeatCount === 4) {
      if (i===0) leftOpps.push(opp);
      else if (i===1||i===2) topOpps.push(opp);
      else rightOpps.push(opp);
    } else {
      if (i < mappedSeatCount/3) leftOpps.push(opp);
      else if (i > (mappedSeatCount*2)/3) rightOpps.push(opp);
      else topOpps.push(opp);
    }
  });

  return (
    <LinearGradient colors={['#0F2B1D','#060e09']} style={{flex:1}}>
      <SafeAreaView style={{flex:1}}>
        <View style={{flex:1, padding:16, gap:16}}>
          <StatusBarTop
            trump={mapSuit(gameState.trump_suit)}
            round={gameState.current_round}
            totalRounds={gameState.total_rounds}
            yourTricks={myInfo?.tricks_won || 0}
            yourBid={myInfo?.bid ?? null}
            onLeave={handleLeave}
          />
          
          <View style={{flex:1, flexDirection:'row', justifyContent:'space-between'}}>
            <View style={{gap:16, justifyContent:'center'}}>
              {leftOpps.map(o => <OpponentBadge key={o.id} o={o} />)}
            </View>
            <View style={{flex:1, paddingHorizontal:10}}>
              {topOpps.length > 0 && (
                <View style={{flexDirection:'row', justifyContent:'center', gap:10, marginBottom:16}}>
                  {topOpps.map(o => <OpponentBadge key={o.id} o={o} />)}
                </View>
              )}
              <CenterTrick cards={trick} />
            </View>
            <View style={{gap:16, justifyContent:'center'}}>
              {rightOpps.map(o => <OpponentBadge key={o.id} o={o} />)}
            </View>
          </View>

          <View style={{ height: 160 }}>
            <CardFan
              hand={hand}
              onPlay={(id) => {
                const idx = hand.findIndex(c => c.id === id);
                if (idx !== -1) {
                  sendAction({ action: 'play_card', card: gameState.your_hand[idx] }, 'medium');
                }
              }}
            />
          </View>

          <PlayerDock
            name={myInfo?.name || params.player_name || 'You'}
            score={myInfo?.total_score || 0}
            bid={myInfo?.bid ?? null}
            tricksWon={myInfo?.tricks_won || 0}
            isYourTurn={isMyTurn}
            onEmotePress={() => setShowEmotePicker(true)}
            activeEmote={activeEmotes[myInfo?.id || '']}
          />
        </View>

        {showEmotePicker && (
          <View style={{position: 'absolute', bottom: 120, alignSelf: 'center', backgroundColor: theme.glassStrong, borderRadius: 24, padding: 16, flexDirection: 'row', flexWrap: 'wrap', width: 280, justifyContent: 'center', gap: 12, borderWidth: 1, borderColor: theme.border, zIndex: 100}}>
            {EMOTES.map(emoji => (
              <TouchableOpacity
                key={emoji}
                onPress={() => {
                  sendAction({ action: 'send_emote', emoji }, 'light');
                  setShowEmotePicker(false);
                }}
                style={{width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 24}}
              >
                <Text style={{fontSize: 28}}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity onPress={() => setShowEmotePicker(false)} style={{width: '100%', marginTop: 8, paddingVertical: 8, alignItems: 'center'}}>
              <Text style={{color: theme.ivory, opacity: 0.5, fontWeight: '700'}}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        )}

        <BiddingSheet
          open={phase === 'bidding' && isMyTurn}
          maxBid={gameState.cards_this_round}
          forbiddenBid={gameState.restricted_bids?.[0] ?? null}
          onSubmit={(b) => sendAction({ action: 'place_bid', bid: b }, 'medium')}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}

function StatusPill({
  label,
  value,
  muted,
  valueStyle,
}: {
  label: string;
  value: string;
  muted?: boolean;
  valueStyle?: object;
}) {
  return (
    <View style={[styles.statusPill, muted && styles.statusPillMuted]}>
      <Text style={styles.statusPillLabel}>{label}</Text>
      <Text style={[styles.statusPillValue, valueStyle]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: STATUSBAR_HEIGHT,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },

  // === LOBBY ===
  lobbyWrap: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    padding: 8,
  },
  backBtnText: {
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  lobbyTitle: {
    color: COLORS.goldLight,
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 5,
    marginBottom: 20,
  },
  roomCodeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignItems: 'center',
    marginBottom: 24,
  },
  roomCodeLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  roomCode: {
    color: COLORS.gold,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 10,
  },
  roomCodeHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  playerCountText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  playerList: {
    width: '100%',
    marginBottom: 20,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarYou: {
    backgroundColor: COLORS.gold,
  },
  avatarWinner: {
    backgroundColor: COLORS.gold,
    borderWidth: 2,
    borderColor: COLORS.goldLight,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  playerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  badge: {
    backgroundColor: COLORS.backgroundLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginLeft: 6,
  },
  badgeYou: {
    backgroundColor: 'rgba(212,175,55,0.2)',
  },
  badgeText: {
    color: COLORS.goldLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  goldButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 15,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
  },
  goldButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: COLORS.goldLight,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
  },
  outlineButtonText: {
    color: COLORS.goldLight,
    fontSize: 15,
    fontWeight: '700',
  },
  waitText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
    marginTop: 12,
    textAlign: 'center',
  },

  // === GAME TABLE ===
  gameWrap: {
    flex: 1,
  },
  tableBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  ambientGlow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(243,229,171,0.12)',
  },
  ambientGlowLeft: {
    top: -40,
    left: -90,
  },
  ambientGlowRight: {
    bottom: 90,
    right: -100,
    backgroundColor: 'rgba(26,75,51,0.48)',
  },
  tableShell: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  statusRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  leaveButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  statusCluster: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusPill: {
    minWidth: 84,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  statusPillMuted: {
    opacity: 0.72,
  },
  statusPillLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  statusPillValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  opponentStage: {
    position: 'relative',
    height: 180,
    marginBottom: 6,
  },
  opponentSeat: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(8, 24, 17, 0.78)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
  },
  opponentSeatActive: {
    borderColor: COLORS.goldLight,
    backgroundColor: 'rgba(243,229,171,0.08)',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.28,
  },
  opponentSeatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 3,
  },
  seatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatAvatarActive: {
    backgroundColor: COLORS.gold,
  },
  seatAvatarText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '900',
  },
  opponentSeatMeta: {
    flex: 1,
    minWidth: 0,
  },
  seatNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  opponentName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
    flex: 1,
  },
  opponentScore: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '600',
  },
  opponentBody: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  centerStage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
  },
  turnBanner: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    marginBottom: 10,
  },
  trickTable: {
    width: '100%',
    maxWidth: 420,
    minHeight: 210,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(7, 21, 15, 0.72)',
    padding: 14,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tableHeaderLabel: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  tableHeaderBadge: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  trickResultCard: {
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    marginBottom: 10,
  },
  infoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  leaveBtn: {
    padding: 6,
  },
  leaveBtnText: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '600',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Opponents
  opponentsScroll: {
    maxHeight: 80,
  },
  opponentsContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
  },
  oppCard: {
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 90,
    alignItems: 'center',
  },
  oppCardActive: {
    borderColor: COLORS.goldLight,
    backgroundColor: 'rgba(243,229,171,0.08)',
  },
  oppTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  oppName: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: 70,
  },
  dealerBadge: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  oppBid: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  oppScore: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '600',
  },
  disconnected: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '600',
  },

  // Trick Area
  trickArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 8,
  },
  trickWinnerText: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  trickCards: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  trickCardWrap: {
    alignItems: 'center',
  },
  winnerHighlight: {
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: 10,
    padding: 2,
  },
  trickCardName: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 2,
    fontWeight: '600',
  },
  emptyTrick: {
    minHeight: 90,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  emptyTrickLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },

  turnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
  turnTextActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },

  selfDock: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  selfMeta: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  selfName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '900',
  },
  selfSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  selfScore: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '900',
  },
  handDock: {
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  handLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 6,
  },
  handContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    gap: 6,
  },

  // Error Banner
  errorBanner: {
    position: 'absolute',
    top: 70,
    left: 18,
    right: 18,
    backgroundColor: 'rgba(239,68,68,0.92)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  errorBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },

  // === ROUND END ===
  roundEndWrap: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  roundEndTitle: {
    color: COLORS.goldLight,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 20,
  },

  // === GAME OVER ===
  gameOverWrap: {
    padding: 24,
    alignItems: 'center',
    flexGrow: 1,
  },
  gameOverTitle: {
    color: COLORS.goldLight,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 20,
    marginTop: 20,
  },
  podium: {
    width: '100%',
    marginBottom: 20,
  },
  standingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  standingRank: {
    color: COLORS.goldLight,
    fontSize: 18,
    fontWeight: '800',
    width: 36,
    textAlign: 'center',
  },
  standingName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  standingScore: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  gameOverBtns: {
    width: '100%',
    gap: 12,
    marginTop: 20,
  },
});
