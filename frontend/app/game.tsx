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
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, SUIT_DISPLAY_COLORS } from '../utils/theme';
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
  const [error, setError] = useState('');
  const [trickResult, setTrickResult] = useState<any>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const trickResultTimer = useRef<any>(null);
  const prevTrickRef = useRef<string>('');
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const turnPulse = useRef(new Animated.Value(0)).current;
  const trickPop = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);
  const { width: SCREEN_W } = useWindowDimensions();

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

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
      <SafeAreaView style={styles.container}>
        <View style={styles.lobbyWrap}>
          <TouchableOpacity testID="leave-btn" style={styles.backBtn} onPress={handleLeave}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>

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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
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

            <View style={styles.statusCluster}>
              <StatusPill label="Trump" value={trumpSymbol || '—'} valueStyle={{ color: trumpColor }} />
              <StatusPill label="Round" value={`${gameState.current_round}/${gameState.total_rounds}`} />
              <StatusPill label="Cards" value={`${gameState.cards_this_round}`} />
              <StatusPill label="Tricks" value={`${gameState.tricks_played}/${gameState.cards_this_round}`} />
              <StatusPill label={connected ? 'Live' : 'Offline'} value={connected ? 'Connected' : 'Retrying'} muted={!connected} />
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
                      <Text style={styles.opponentScore}>{opp.total_score} pts</Text>
                    </View>
                  </View>
                  <Text style={styles.opponentBody}>
                    {opp.has_bid || opp.bid !== null
                      ? `Bid ${opp.bid}  Won ${opp.tricks_won}`
                      : phase === 'bidding'
                        ? 'Waiting to bid'
                        : `Cards ${opp.card_count}`}
                  </Text>
                  {!opp.is_connected && (
                    <Text style={styles.disconnected}>Offline</Text>
                  )}
                </View>
              );
            })}
          </View>

          <View style={styles.centerStage}>
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
                  {phase === 'bidding' ? 'Bidding round' : 'Playing trick'}
                </Text>
                <Text style={styles.tableHeaderBadge}>
                  {gameState.current_player_index === your_index ? 'Your move' : 'Table live'}
                </Text>
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
                    {phase === 'bidding' ? 'Bids are being locked in' : 'Play a card to open the trick'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.selfDock}>
            <View style={styles.selfMeta}>
              <View>
                <Text style={styles.selfName}>{myInfo?.name || params.player_name}</Text>
                <Text style={styles.selfSubtext}>
                  {gameState.dealer_index === your_index ? 'Dealer' : 'Player'}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? ` • Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : ' • No bid yet'}
                </Text>
              </View>
              <Text style={styles.selfScore}>{myInfo?.total_score || 0} pts</Text>
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
        </View>
      </View>
    </SafeAreaView>
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
