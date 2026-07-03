import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
  Platform,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, SUIT_DISPLAY_COLORS } from '../utils/theme';
import { VARIATIONS } from '../utils/variations';
import { bidStatus, BID_STATUS_COLORS, BID_STATUS_LABELS, scoreColor } from '../utils/bidStatus';
import PlayingCard from '../components/PlayingCard';
import BiddingModal from '../components/BiddingModal';
import HandDisplay from '../components/HandDisplay';
import ScoreBoard from '../components/ScoreBoard';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

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
    offline_for: number | null;
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
  variation: string;
  variation_config: { cards_per_round?: number; total_rounds?: number };
  trump_caller_index: number;
  force_grace_seconds: number;
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
  const [error, setError] = useState('');
  const [trickResult, setTrickResult] = useState<any>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const trickResultTimer = useRef<any>(null);
  const prevTrickRef = useRef<string>('');
  const prevPhaseRef = useRef<string>('');
  const [showBidLock, setShowBidLock] = useState(false);
  const bidLockTimer = useRef<any>(null);
  const bidLockAnim = useRef(new Animated.Value(0)).current;
  const [trumpReveal, setTrumpReveal] = useState<string | null>(null);
  const trumpRevealTimer = useRef<any>(null);
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const turnPulse = useRef(new Animated.Value(0)).current;
  const trickPop = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);
  const { width: SCREEN_W } = useWindowDimensions();
  const [nowTick, setNowTick] = useState(0);
  const stateReceivedAt = useRef(Date.now());

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

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
          stateReceivedAt.current = Date.now();
          // Handle trick completion display
          if (data.last_completed_trick) {
            const key = `${data.current_round}-${data.tricks_played}`;
            if (prevTrickRef.current !== key) {
              prevTrickRef.current = key;
              setTrickResult(data.last_completed_trick);
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

  const getOpponentSeatStyle = (index: number, count: number) => {
    const stageWidth = Math.max(280, SCREEN_W - 32);
    const seatWidth = Math.min(128, Math.max(96, Math.floor(stageWidth / Math.max(3, count + 1))));
    const seatHeight = 76;
    const centerX = stageWidth / 2;
    const centerY = 104;
    const radiusX = Math.max(64, stageWidth * 0.34);
    const radiusY = 52;
    const thetaStart = Math.PI * 1.12;
    const thetaEnd = Math.PI * 1.88;
    const theta = count === 1
      ? Math.PI * 1.5
      : thetaStart + ((thetaEnd - thetaStart) * index) / Math.max(1, count - 1);

    return {
      left: centerX + Math.cos(theta) * radiusX - seatWidth / 2,
      top: centerY + Math.sin(theta) * radiusY - seatHeight / 2,
      width: seatWidth,
      height: seatHeight,
    };
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

  // Phase transition effects: bid lock confirmation + trump reveal flash
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const next = gameState.phase;
    if (prev === next) return;
    prevPhaseRef.current = next;

    if (prev === 'bidding' && (next === 'playing' || next === 'trump_selection_v3')) {
      setShowBidLock(true);
      if (reduceMotionRef.current) {
        bidLockAnim.setValue(1);
      } else {
        bidLockAnim.setValue(0);
        Animated.timing(bidLockAnim, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.back(1.4)),
          useNativeDriver: true,
        }).start();
      }
      void fireHaptic('success');
      if (bidLockTimer.current) clearTimeout(bidLockTimer.current);
      bidLockTimer.current = setTimeout(() => setShowBidLock(false), 4000);
    }

    if ((prev === 'trump_selection' || prev === 'trump_selection_v3') && gameState.trump_suit) {
      setTrumpReveal(gameState.trump_suit);
      if (trumpRevealTimer.current) clearTimeout(trumpRevealTimer.current);
      trumpRevealTimer.current = setTimeout(() => setTrumpReveal(null), 1500);
    }
  }, [gameState, bidLockAnim, fireHaptic]);

  useEffect(() => {
    return () => {
      if (bidLockTimer.current) clearTimeout(bidLockTimer.current);
      if (trumpRevealTimer.current) clearTimeout(trumpRevealTimer.current);
    };
  }, []);

  // Loading state
  if (!gameState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.gold} />
          <Text style={styles.loadingText}>
            {connected ? 'Loading game...' : 'Connecting...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const { phase, players, your_id, your_index } = gameState;
  const isHost = players.find((p) => p.id === your_id)?.is_host || false;
  const myInfo = players[your_index] || players.find((p) => p.id === your_id);
  const currentPlayerName = players[gameState.current_player_index]?.name || '';
  const isMyTurn = gameState.current_player_index === your_index;
  const opponents = players.filter((p) => p.id !== your_id);
  const currentPlayer = players[gameState.current_player_index];
  const currentPlayerOffline = currentPlayer && !currentPlayer.is_connected;
  const offlineElapsed = currentPlayerOffline && currentPlayer.offline_for !== null
    ? currentPlayer.offline_for + (Date.now() - stateReceivedAt.current) / 1000
    : 0;
  const forceRemaining = Math.max(0, Math.ceil((gameState.force_grace_seconds ?? 15) - offlineElapsed));
  void nowTick; // re-render driver for the countdown

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
    const variation = gameState.variation || 'v1';
    const variationConfig = gameState.variation_config || {};
    const selectedVariation = VARIATIONS.find((v) => v.key === variation) || VARIATIONS[0];
    const needsConfig = variation === 'v1.1' || variation === 'v3';
    const maxCardsPerRound = Math.floor(52 / Math.max(3, players.length));
    const maxRounds = variation === 'v3' ? 17 : maxCardsPerRound;
    const cardsPerRound = variationConfig.cards_per_round ?? 5;
    const totalRounds = variationConfig.total_rounds ?? 5;

    const selectVariation = (key: string) => {
      const config = key === 'v1.1' || key === 'v3'
        ? { cards_per_round: cardsPerRound, total_rounds: totalRounds }
        : {};
      void sendAction({ action: 'set_variation', variation: key, config }, 'selection');
    };

    const updateConfig = (field: 'cards_per_round' | 'total_rounds', delta: number) => {
      const max = field === 'cards_per_round' ? maxCardsPerRound : maxRounds;
      const current = field === 'cards_per_round' ? cardsPerRound : totalRounds;
      const next = Math.max(1, Math.min(current + delta, max));
      if (next === current) return;
      void sendAction({
        action: 'set_variation',
        variation,
        config: { cards_per_round: cardsPerRound, total_rounds: totalRounds, [field]: next },
      }, 'selection');
    };

    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity testID="leave-btn" style={styles.backBtn} onPress={handleLeave}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.lobbyWrap}>
          <Text style={styles.lobbyTitle}>JUDGEMENT</Text>

          <View style={styles.roomCodeBox}>
            <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
            <Text style={styles.roomCode}>{gameState.room_id}</Text>
            <Text style={styles.roomCodeHint}>Share this code with friends</Text>
          </View>

          <Text style={styles.playerCountText}>
            Players ({players.length}/7)
          </Text>

          <View style={styles.playerList}>
            {players.map((p) => (
              <View key={p.id} testID={`player-${p.id}`} style={styles.playerItem}>
                <View style={[styles.avatar, p.id === your_id && styles.avatarYou]}>
                  <Text style={styles.avatarText}>{p.name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.playerName}>{p.name}</Text>
                {p.is_host && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>HOST</Text>
                  </View>
                )}
                {p.id === your_id && (
                  <View style={[styles.badge, styles.badgeYou]}>
                    <Text style={styles.badgeText}>YOU</Text>
                  </View>
                )}
              </View>
            ))}
          </View>

          <View style={styles.variationSection}>
            <Text style={styles.variationLabel}>GAME VARIATION</Text>
            {isHost ? (
              <View style={styles.variationGrid}>
                {VARIATIONS.map((v) => {
                  const selected = v.key === variation;
                  return (
                    <TouchableOpacity
                      key={v.key}
                      testID={`variation-${v.key}`}
                      style={[styles.variationOption, selected && styles.variationOptionSelected]}
                      onPress={() => selectVariation(v.key)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.variationName, selected && styles.variationNameSelected]}>
                        {v.name}
                      </Text>
                      <Text style={styles.variationDesc}>{v.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.variationReadonly}>
                <Text style={styles.variationName}>{selectedVariation.name}</Text>
                <Text style={styles.variationDesc}>{selectedVariation.desc}</Text>
                <TouchableOpacity
                  onPress={() => router.push(`/game-modes/${variation}` as any)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.modeInfoBtn}
                >
                  <Text style={styles.modeInfoText}>What's this? →</Text>
                </TouchableOpacity>
              </View>
            )}

            {needsConfig && (
              isHost ? (
                <View style={styles.configRows}>
                  <ConfigStepper
                    label="Cards per round"
                    value={cardsPerRound}
                    max={maxCardsPerRound}
                    onChange={(delta) => updateConfig('cards_per_round', delta)}
                  />
                  <ConfigStepper
                    label="Number of rounds"
                    value={totalRounds}
                    max={maxRounds}
                    onChange={(delta) => updateConfig('total_rounds', delta)}
                  />
                </View>
              ) : (
                <Text style={styles.configReadonlyText}>
                  {cardsPerRound} cards per round • {totalRounds} rounds
                </Text>
              )
            )}
          </View>

          {isHost && players.length >= 3 && (
            <TouchableOpacity
              testID="start-game-btn"
              style={styles.goldButton}
              onPress={() => void sendAction({ action: 'start_game' }, 'medium')}
              activeOpacity={0.8}
            >
              <Text style={styles.goldButtonText}>Start Game</Text>
            </TouchableOpacity>
          )}
          {isHost && players.length < 3 && (
            <Text style={styles.waitText}>Need at least 3 players to start</Text>
          )}
          {!isHost && (
            <Text style={styles.waitText}>Waiting for host to start...</Text>
          )}

          <TouchableOpacity
            style={styles.howToPlayLobbyLink}
            onPress={() => router.push('/how-to-play?lockDone=false' as any)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.howToPlayLobbyText}>
              New here?{'  '}
              <Text style={styles.howToPlayLobbyAction}>How to Play →</Text>
            </Text>
          </TouchableOpacity>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // === GAME OVER ===
  if (phase === 'game_over') {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.gameOverWrap}>
          <Text style={styles.gameOverTitle}>Game Over!</Text>

          <View style={styles.podium}>
            {sorted.map((p, i) => (
              <View key={p.id} style={styles.standingItem}>
                <Text style={styles.standingRank}>#{i + 1}</Text>
                <View style={[styles.avatar, i === 0 && styles.avatarWinner]}>
                  <Text style={styles.avatarText}>{p.name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.standingName}>{p.name}</Text>
                <Text style={[styles.standingScore, i === 0 && { color: COLORS.gold }]}>
                  {p.total_score} pts
                </Text>
              </View>
            ))}
          </View>

          <ScoreBoard
            roundHistory={gameState.round_history}
            players={players}
          />

          <View style={styles.gameOverBtns}>
            {isHost && (
              <TouchableOpacity
                testID="new-game-btn"
                style={styles.goldButton}
                onPress={() => void sendAction({ action: 'new_game' }, 'medium')}
                activeOpacity={0.8}
              >
                <Text style={styles.goldButtonText}>Play Again</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              testID="home-btn"
              style={styles.outlineButton}
              onPress={() => {
                ws.current?.close();
                router.replace('/');
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.outlineButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // === ROUND END ===
  if (phase === 'round_end') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.roundEndWrap}>
          <Text style={styles.roundEndTitle}>Round Complete</Text>

          <ScoreBoard
            roundHistory={gameState.round_history}
            players={players}
            currentRound={gameState.current_round}
          />

          {isHost && (
            <TouchableOpacity
              testID="next-round-btn"
              style={[styles.goldButton, { marginTop: 20 }]}
              onPress={() => void sendAction({ action: 'next_round' }, 'medium')}
              activeOpacity={0.8}
            >
              <Text style={styles.goldButtonText}>Next Round</Text>
            </TouchableOpacity>
          )}
          {!isHost && (
            <Text style={[styles.waitText, { marginTop: 16 }]}>
              Waiting for host to start next round...
            </Text>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // === BIDDING / PLAYING (Main Game Table) ===
  const trumpColor = SUIT_DISPLAY_COLORS[gameState.trump_suit] || '#FFF';
  const trumpSymbol = SUIT_SYMBOLS[gameState.trump_suit] || '';
  const showBiddingModal = phase === 'bidding' && isMyTurn;
  const seatCount = opponents.length;
  const totalBids = players.filter((p) => p.has_bid).reduce((sum, p) => sum + (p.bid ?? 0), 0);
  const showTrumpSelection = phase === 'trump_selection' || phase === 'trump_selection_v3';
  const trumpCaller = players[gameState.trump_caller_index];
  const iAmTrumpCaller = gameState.trump_caller_index === your_index;
  const isTightGame = totalBids > gameState.cards_this_round;

  // Determine trick cards to display
  const displayTrickCards = trickResult
    ? trickResult.cards
    : gameState.current_trick;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameWrap}>
        <View style={styles.tableBackdrop}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ambientGlow,
              styles.ambientGlowLeft,
              {
                opacity: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.42] }),
                transform: [
                  {
                    scale: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.06] }),
                  },
                ],
              },
            ]}
          />
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ambientGlow,
              styles.ambientGlowRight,
              {
                opacity: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.34] }),
                transform: [
                  {
                    scale: ambientPulse.interpolate({ inputRange: [0, 1], outputRange: [1.06, 0.96] }),
                  },
                ],
              },
            ]}
          />
        </View>

        <View style={styles.tableShell}>
          <View style={styles.statusRail}>
            <TouchableOpacity testID="leave-game-btn" onPress={handleLeave} style={styles.leaveButton}>
              <Text style={styles.leaveBtnText}>← Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push({ pathname: '/how-to-play', params: { lockDone: 'false' } } as any)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.helpBtn}
            >
              <Text style={styles.helpBtnText}>?</Text>
            </TouchableOpacity>

            <View
              testID="connection-dot"
              accessibilityLabel={connected ? 'Connected' : 'Reconnecting'}
              style={[styles.connDot, { backgroundColor: connected ? COLORS.success : COLORS.danger }]}
            />

            <View style={styles.statusCluster}>
              <StatusPill
                label="Trump"
                value={
                  gameState.trump_suit
                    ? `${trumpSymbol} ${gameState.trump_suit.charAt(0).toUpperCase() + gameState.trump_suit.slice(1)}`
                    : '—'
                }
                valueStyle={{ color: trumpColor }}
                primary
              />
              <StatusPill
                label="Round"
                value={`${gameState.current_round}/${gameState.total_rounds}`}
                primary
              />
              <StatusPill label="Tricks" value={`${gameState.tricks_played}/${gameState.cards_this_round}`} />
              <StatusPill label="Bids" value={`${totalBids}/${gameState.cards_this_round}`} />
            </View>
          </View>

          <View style={styles.opponentStage}>
            {opponents.map((opp, index) => {
              const oppIdx = players.findIndex((p) => p.id === opp.id);
              const isOppTurn = gameState.current_player_index === oppIdx;
              const isDealer = gameState.dealer_index === oppIdx;
              return (
                <View
                  key={opp.id}
                  testID={`opponent-${opp.id}`}
                  style={[
                    styles.opponentSeat,
                    getOpponentSeatStyle(index, seatCount),
                    isOppTurn && styles.opponentSeatActive,
                  ]}
                >
                  <View style={styles.opponentSeatTop}>
                    <View style={[styles.seatAvatar, isOppTurn && styles.seatAvatarActive]}>
                      <Text style={styles.seatAvatarText}>{opp.name[0]?.toUpperCase()}</Text>
                    </View>
                    <View style={styles.opponentSeatMeta}>
                      <View style={styles.seatNameRow}>
                        <Text style={styles.opponentName} numberOfLines={1}>
                          {opp.name}
                        </Text>
                        {isDealer && <Text style={styles.dealerBadge}>D</Text>}
                      </View>
                      <Text
                        style={[styles.opponentScore, { color: scoreColor(opp.total_score) }]}
                        numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}
                      >
                        {opp.total_score} pts
                      </Text>
                    </View>
                  </View>
                  {(() => {
                    if (opp.has_bid || opp.bid !== null) {
                      const st = bidStatus(opp.bid, opp.tricks_won);
                      const label = BID_STATUS_LABELS[st];
                      return (
                        <Text
                          style={[styles.opponentBody, { color: BID_STATUS_COLORS[st] }]}
                          numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                        >
                          {`Bid ${opp.bid} · Won ${opp.tricks_won}${label ? ` · ${label}` : ''}`}
                        </Text>
                      );
                    }
                    return (
                      <Text style={styles.opponentBody} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {phase === 'bidding' ? 'Waiting to bid' : `Cards ${opp.card_count}`}
                      </Text>
                    );
                  })()}
                  {!opp.is_connected && (
                    <Text style={styles.disconnected}>Offline</Text>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.centerStage}>
            {currentPlayerOffline && (phase === 'playing' || phase === 'bidding') && (
              <OfflineRecoveryBanner
                name={currentPlayer.name}
                remaining={forceRemaining}
                isHost={isHost}
                onForce={() => void sendAction({ action: 'force_action' }, 'medium')}
              />
            )}
            <Animated.View
              style={[
                styles.turnBanner,
                {
                  opacity: turnPulse.interpolate({ inputRange: [0.2, 1], outputRange: [0.7, 1] }),
                  transform: [
                    {
                      scale: turnPulse.interpolate({ inputRange: [0.2, 1], outputRange: [0.98, 1.02] }),
                    },
                  ],
                },
              ]}
            >
              <Text style={[styles.turnText, isMyTurn && styles.turnTextActive]}>
                {phase === 'bidding'
                  ? isMyTurn
                    ? 'Your turn to bid'
                    : `Waiting for ${currentPlayerName} to bid`
                  : isMyTurn
                    ? 'Your turn to play'
                    : `Waiting for ${currentPlayerName}`}
              </Text>
            </Animated.View>

            <View style={styles.trickTable}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableHeaderLabel}>
                  {phase === 'bidding' ? 'Bidding round' : 'Table'}
                </Text>
                {gameState.current_player_index === your_index && (
                  <Text style={styles.tableHeaderBadge}>Your move</Text>
                )}
              </View>

              {trickResult && (
                <Animated.View
                  style={[
                    styles.trickResultCard,
                    {
                      opacity: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }),
                      transform: [
                        {
                          scale: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                        },
                      ],
                    },
                  ]}
                >
                  <Text style={styles.trickWinnerText}>{trickResult.winner_name} took the trick</Text>
                </Animated.View>
              )}

              {displayTrickCards && displayTrickCards.length > 0 ? (
                <View style={styles.trickCards}>
                  {displayTrickCards.map((tc: any, i: number) => {
                    const isWinner =
                      trickResult && tc.player_index === trickResult.winner_index;
                    return (
                      <View key={i} style={styles.trickCardWrap}>
                        <View style={isWinner ? styles.winnerHighlight : undefined}>
                          <PlayingCard card={tc.card} size="trick" highlighted={isWinner} />
                        </View>
                        <Text style={styles.trickCardName}>
                          {players[tc.player_index]?.name || '?'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptyTrick}>
                  <Text style={styles.emptyTrickLabel}>
                    {phase === 'bidding' ? 'Bids are being locked in' : 'Play a card to begin'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.selfDock}>
            <View style={styles.selfMeta}>
              <View>
                <Text style={styles.selfName}>{myInfo?.name || params.player_name}</Text>
                <Text
                  style={[
                    styles.selfSubtext,
                    myInfo?.bid !== null && myInfo?.bid !== undefined
                      ? { color: BID_STATUS_COLORS[bidStatus(myInfo.bid, myInfo.tricks_won)] }
                      : null,
                  ]}
                  numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
                >
                  {gameState.dealer_index === your_index ? 'Dealer' : ''}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? `${gameState.dealer_index === your_index ? ' • ' : ''}Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : `${gameState.dealer_index === your_index ? ' • ' : ''}No bid yet`}
                </Text>
              </View>
              <Text style={[styles.selfScore, { color: scoreColor(myInfo?.total_score || 0) }]}>{myInfo?.total_score || 0} pts</Text>
            </View>
          </View>

          <View style={styles.handDock}>
            <HandDisplay
              hand={gameState.your_hand}
              playableIndices={phase === 'playing' && isMyTurn ? playableIndices : null}
              onPlayCard={(card) => void sendAction({ action: 'play_card', card }, 'medium')}
              phase={phase}
            />
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorBannerText}>{error}</Text>
            </View>
          ) : null}

          <BiddingModal
            visible={showBiddingModal}
            yourHand={gameState.your_hand}
            cardsThisRound={gameState.cards_this_round}
            trumpSuit={gameState.trump_suit}
            currentRound={gameState.current_round}
            totalRounds={gameState.total_rounds}
            restrictedBids={gameState.restricted_bids || []}
            onPlaceBid={(bid) => void sendAction({ action: 'place_bid', bid }, 'medium')}
          />

          {showTrumpSelection && !showBidLock && (
            <View style={styles.trumpOverlay}>
              <View style={styles.trumpPanel}>
                {iAmTrumpCaller ? (
                  <>
                    <Text style={styles.trumpTitle}>
                      {phase === 'trump_selection' ? 'Call Trump' : 'You won the bid'}
                    </Text>
                    <Text style={styles.trumpSubtitle}>
                      {phase === 'trump_selection'
                        ? `You've seen ${gameState.your_hand.length} of ${gameState.cards_this_round} cards`
                        : 'Choose the trump suit for this round'}
                    </Text>
                    <View style={styles.trumpHandRow}>
                      {gameState.your_hand.map((c, i) => (
                        <PlayingCard key={`${c.suit}-${c.rank}-${i}`} card={c} size="small" />
                      ))}
                    </View>
                    <View style={styles.suitGrid}>
                      {['hearts', 'diamonds', 'spades', 'clubs'].map((s) => (
                        <TouchableOpacity
                          key={s}
                          testID={`trump-suit-${s}`}
                          style={styles.suitButton}
                          onPress={() => void sendAction({ action: 'call_trump', suit: s }, 'medium')}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.suitButtonSymbol, { color: SUIT_DISPLAY_COLORS[s] }]}>
                            {SUIT_SYMBOLS[s]}
                          </Text>
                          <Text style={styles.suitButtonLabel}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {phase === 'trump_selection' && (
                      <TouchableOpacity
                        testID="trump-blind-draw"
                        style={styles.blindDrawButton}
                        onPress={() => void sendAction({ action: 'call_trump', suit: null }, 'medium')}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.blindDrawText}>Blind Draw — random suit</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="small" color={COLORS.gold} />
                    <Text style={styles.trumpWaitText}>
                      Waiting for {trumpCaller?.name || 'player'} to{' '}
                      {phase === 'trump_selection' ? 'call trump' : 'choose trump'}
                    </Text>
                  </>
                )}
              </View>
            </View>
          )}

          {trumpReveal && (
            <View style={styles.trumpRevealBanner} pointerEvents="none">
              <Text style={styles.trumpRevealText}>
                Trump:{' '}
                <Text style={{ color: SUIT_DISPLAY_COLORS[trumpReveal] }}>
                  {SUIT_SYMBOLS[trumpReveal]}
                </Text>{' '}
                {trumpReveal.charAt(0).toUpperCase() + trumpReveal.slice(1)}
              </Text>
            </View>
          )}

          {showBidLock && (
            <Animated.View
              pointerEvents="none"
              style={[
                styles.bidLockOverlay,
                {
                  opacity: bidLockAnim,
                  transform: [
                    {
                      scale: bidLockAnim.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }),
                    },
                  ],
                },
              ]}
            >
              <View style={styles.bidLockPanel}>
                <Text style={styles.bidLockTitle}>All bids locked!</Text>
                <Text style={styles.bidLockTotal}>
                  Total bids: {totalBids} / {gameState.cards_this_round} sets
                </Text>
                <Text style={[styles.bidLockVerdict, { color: isTightGame ? COLORS.danger : COLORS.success }]}>
                  {isTightGame ? 'Tight game' : 'Loose game'}
                </Text>
                <Text style={styles.bidLockExplain}>
                  {isTightGame
                    ? 'More bids than sets available — Someone will fall short. Make sure it is not you!'
                    : 'Fewer bids than sets — Play smart and make others win the extra sets.'}
                </Text>
              </View>
            </Animated.View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

function ConfigStepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (delta: number) => void;
}) {
  return (
    <View style={styles.configRow}>
      <View style={styles.configRowMeta}>
        <Text style={styles.configRowLabel}>{label}</Text>
        <Text style={styles.configRowMax}>max {max}</Text>
      </View>
      <View style={styles.stepper}>
        <TouchableOpacity
          style={[styles.stepperBtn, value <= 1 && styles.stepperBtnDisabled]}
          onPress={() => onChange(-1)}
          disabled={value <= 1}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepperBtn, value >= max && styles.stepperBtnDisabled]}
          onPress={() => onChange(1)}
          disabled={value >= max}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function StatusPill({
  label,
  value,
  muted,
  primary,
  valueStyle,
}: {
  label: string;
  value: string;
  muted?: boolean;
  primary?: boolean;
  valueStyle?: object;
}) {
  return (
    <View style={[styles.statusPill, primary && styles.statusPillPrimary, muted && styles.statusPillMuted]}>
      <Text style={styles.statusPillLabel} numberOfLines={1}>{label}</Text>
      <Text
        style={[styles.statusPillValue, primary && styles.statusPillValuePrimary, valueStyle]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function OfflineRecoveryBanner({
  name,
  remaining,
  isHost,
  onForce,
}: {
  name: string;
  remaining: number;
  isHost: boolean;
  onForce: () => void;
}) {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerTitle}>{name} is offline</Text>
      {remaining > 0 ? (
        <Text style={styles.offlineBannerSub}>
          Giving them {remaining}s to reconnect…
        </Text>
      ) : isHost ? (
        <TouchableOpacity
          testID="force-action-btn"
          style={styles.offlineForceBtn}
          onPress={onForce}
          activeOpacity={0.8}
        >
          <Text style={styles.offlineForceBtnText}>Play for {name}</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.offlineBannerSub}>
          The host can play their turn for them
        </Text>
      )}
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
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    top: 12,
    left: 16,
    padding: 8,
    zIndex: 10,
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
    flexGrow: 1,
    flexBasis: '22%',
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
  statusPillPrimary: {
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(212,175,55,0.08)',
    flexBasis: '46%',
  },
  statusPillValuePrimary: {
    fontSize: 15,
  },
  connDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-start',
    marginTop: 4,
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
    minHeight: 160,
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
  helpBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
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
  offlineBanner: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: 10,
    gap: 6,
  },
  offlineBannerTitle: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  offlineBannerSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  offlineForceBtn: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: COLORS.gold,
  },
  offlineForceBtnText: {
    color: '#000',
    fontSize: 14,
    fontWeight: '800',
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

  // === VARIATION SELECTOR (LOBBY) ===
  variationSection: {
    width: '100%',
    marginBottom: 20,
  },
  variationLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
    textAlign: 'center',
  },
  variationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  variationOption: {
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  variationOptionSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  variationName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 2,
  },
  variationNameSelected: {
    color: COLORS.goldLight,
  },
  variationDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '500',
  },
  variationReadonly: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: COLORS.surfaceGlass,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modeInfoBtn: { marginTop: 6 },
  modeInfoText: { color: COLORS.gold, fontSize: 12, fontWeight: '600' },
  configRows: {
    marginTop: 10,
    gap: 8,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  configRowMeta: {
    flex: 1,
    minWidth: 0,
  },
  configRowLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  configRowMax: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  configReadonlyText: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 10,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(212,175,55,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnDisabled: {
    opacity: 0.35,
  },
  stepperBtnText: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 26,
  },
  stepperValue: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    minWidth: 28,
    textAlign: 'center',
  },

  // === TRUMP SELECTION ===
  trumpOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 9, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  trumpPanel: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(10, 28, 19, 0.96)',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  trumpTitle: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 4,
  },
  trumpSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  trumpHandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
  },
  suitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  suitButton: {
    width: 76,
    height: 76,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suitButtonSymbol: {
    fontSize: 30,
    lineHeight: 34,
  },
  suitButtonLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'capitalize',
    marginTop: 2,
  },
  blindDrawButton: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.goldLight,
  },
  blindDrawText: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '700',
  },
  trumpWaitText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },
  trumpRevealBanner: {
    position: 'absolute',
    top: 110,
    left: 30,
    right: 30,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(10, 28, 19, 0.94)',
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
  },
  trumpRevealText: {
    color: COLORS.goldLight,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
  },

  // === BID LOCK CONFIRMATION ===
  bidLockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 14, 9, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  bidLockPanel: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(10, 28, 19, 0.96)',
    padding: 24,
    alignItems: 'center',
  },
  bidLockTitle: {
    color: COLORS.goldLight,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bidLockTotal: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  bidLockVerdict: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bidLockExplain: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  howToPlayLobbyLink: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 6,
  },
  howToPlayLobbyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
  },
  howToPlayLobbyAction: {
    color: 'rgba(212,175,55,0.8)',
    fontWeight: '600',
  },
});
