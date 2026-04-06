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
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { COLORS, SUIT_SYMBOLS, SUIT_DISPLAY_COLORS } from '../utils/theme';
import PlayingCard from '../components/PlayingCard';
import BiddingModal from '../components/BiddingModal';
import ScoreBoard from '../components/ScoreBoard';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface GameState {
  type: string;
  room_id: string;
  phase: string;
  players: Array<{
    id: string;
    name: string;
    is_host: boolean;
    bid: number | null;
    tricks_won: number;
    total_score: number;
    card_count: number;
    is_connected: boolean;
    has_bid: boolean;
  }>;
  your_id: string;
  your_index: number;
  your_hand: Array<{ suit: string; rank: string }>;
  current_round: number;
  total_rounds: number;
  cards_this_round: number;
  trump_suit: string;
  dealer_index: number;
  current_player_index: number;
  current_trick: Array<{ player_index: number; card: { suit: string; rank: string } }>;
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
  const trickResultTimer = useRef<any>(null);
  const prevTrickRef = useRef<string>('');

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
              if (trickResultTimer.current) clearTimeout(trickResultTimer.current);
              trickResultTimer.current = setTimeout(() => setTrickResult(null), 2500);
            }
          }
        } else if (data.type === 'error') {
          setError(data.message);
          setTimeout(() => setError(''), 4000);
        }
      } catch (e) {
        // ignore parse errors
      }
    };
  }, [params.room_id, params.player_name, params.player_id, params.is_host]);

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
              onPress={() => send({ action: 'start_game' })}
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
                onPress={() => send({ action: 'new_game' })}
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
              onPress={() => send({ action: 'next_round' })}
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

  // Determine trick cards to display
  const displayTrickCards = trickResult
    ? trickResult.cards
    : gameState.current_trick;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gameWrap}>
        {/* Top Info Bar */}
        <View style={styles.infoBar}>
          <TouchableOpacity testID="leave-game-btn" onPress={handleLeave} style={styles.leaveBtn}>
            <Text style={styles.leaveBtnText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.infoItem}>
            <Text style={[styles.infoValue, { color: trumpColor }]}>{trumpSymbol}</Text>
            <Text style={styles.infoLabel}>Trump</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>
              {gameState.current_round}/{gameState.total_rounds}
            </Text>
            <Text style={styles.infoLabel}>Round</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>{gameState.cards_this_round}</Text>
            <Text style={styles.infoLabel}>Cards</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoValue}>
              {gameState.tricks_played}/{gameState.cards_this_round}
            </Text>
            <Text style={styles.infoLabel}>Tricks</Text>
          </View>
        </View>

        {/* Opponents Row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.opponentsScroll}
          contentContainerStyle={styles.opponentsContent}
        >
          {opponents.map((opp) => {
            const oppIdx = players.findIndex((p) => p.id === opp.id);
            const isOppTurn = gameState.current_player_index === oppIdx;
            const isDealer = gameState.dealer_index === oppIdx;
            return (
              <View
                key={opp.id}
                testID={`opponent-${opp.id}`}
                style={[styles.oppCard, isOppTurn && styles.oppCardActive]}
              >
                <View style={styles.oppTop}>
                  <Text style={styles.oppName} numberOfLines={1}>
                    {opp.name}
                  </Text>
                  {isDealer && <Text style={styles.dealerBadge}>D</Text>}
                </View>
                {opp.has_bid || opp.bid !== null ? (
                  <Text style={styles.oppBid}>
                    Bid: {opp.bid} | Won: {opp.tricks_won}
                  </Text>
                ) : (
                  <Text style={styles.oppBid}>
                    {phase === 'bidding' ? '...' : `Cards: ${opp.card_count}`}
                  </Text>
                )}
                <Text style={styles.oppScore}>{opp.total_score} pts</Text>
                {!opp.is_connected && (
                  <Text style={styles.disconnected}>Offline</Text>
                )}
              </View>
            );
          })}
        </ScrollView>

        {/* Trick Area */}
        <View style={styles.trickArea}>
          {trickResult && (
            <Text style={styles.trickWinnerText}>
              {trickResult.winner_name} won the trick!
            </Text>
          )}
          {displayTrickCards && displayTrickCards.length > 0 ? (
            <View style={styles.trickCards}>
              {displayTrickCards.map((tc: any, i: number) => {
                const isWinner =
                  trickResult && tc.player_index === trickResult.winner_index;
                return (
                  <View key={i} style={styles.trickCardWrap}>
                    <View style={isWinner ? styles.winnerHighlight : undefined}>
                      <PlayingCard card={tc.card} size="trick" />
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
              <Text style={styles.emptyTrickText}>
                {phase === 'bidding' ? 'Bidding in progress...' : 'Play a card'}
              </Text>
            </View>
          )}
        </View>

        {/* Turn Indicator */}
        <View style={styles.turnBar}>
          {phase === 'bidding' ? (
            <Text style={[styles.turnText, isMyTurn && styles.turnTextActive]}>
              {isMyTurn ? "Your turn to bid!" : `Waiting for ${currentPlayerName} to bid...`}
            </Text>
          ) : (
            <Text style={[styles.turnText, isMyTurn && styles.turnTextActive]}>
              {isMyTurn ? "Your turn! Play a card" : `Waiting for ${currentPlayerName}...`}
            </Text>
          )}
        </View>

        {/* Player Info */}
        <View style={styles.myInfoBar}>
          <Text style={styles.myName}>{myInfo?.name || params.player_name}</Text>
          {myInfo?.bid !== null && myInfo?.bid !== undefined && (
            <View style={styles.myStatRow}>
              <Text style={styles.myStat}>Bid: {myInfo.bid}</Text>
              <Text style={styles.myStat}>Won: {myInfo.tricks_won}</Text>
            </View>
          )}
          <Text style={styles.myScore}>{myInfo?.total_score || 0} pts</Text>
          {gameState.dealer_index === your_index && (
            <Text style={styles.dealerTag}>Dealer</Text>
          )}
        </View>

        {/* Player Hand */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.handScroll}
          contentContainerStyle={styles.handContent}
        >
          {gameState.your_hand.map((card, idx) => {
            const canPlay = playableIndices.has(idx);
            return (
              <PlayingCard
                key={`${card.rank}-${card.suit}-${idx}`}
                card={card}
                size="hand"
                dimmed={phase === 'playing' && isMyTurn && !canPlay}
                onPress={
                  phase === 'playing' && isMyTurn && canPlay
                    ? () => send({ action: 'play_card', card })
                    : undefined
                }
                disabled={!(phase === 'playing' && isMyTurn && canPlay)}
              />
            );
          })}
        </ScrollView>

        {/* Error Banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        ) : null}

        {/* Bidding Modal */}
        <BiddingModal
          visible={showBiddingModal}
          cardsThisRound={gameState.cards_this_round}
          trumpSuit={gameState.trump_suit}
          currentRound={gameState.current_round}
          totalRounds={gameState.total_rounds}
          restrictedBids={gameState.restricted_bids || []}
          onPlaceBid={(bid) => send({ action: 'place_bid', bid })}
        />
      </View>
    </SafeAreaView>
  );
}

const { width: SCREEN_W } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    width: 140,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTrickText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },

  // Turn Indicator
  turnBar: {
    paddingVertical: 6,
    alignItems: 'center',
  },
  turnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
  },
  turnTextActive: {
    color: COLORS.gold,
    fontWeight: '700',
  },

  // My Info
  myInfoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  myName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  myStatRow: {
    flexDirection: 'row',
    gap: 8,
  },
  myStat: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  myScore: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '700',
  },
  dealerTag: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // Hand
  handScroll: {
    maxHeight: 90,
    minHeight: 90,
  },
  handContent: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: 'center',
    gap: 2,
  },

  // Error Banner
  errorBanner: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(239,68,68,0.9)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
  },
  errorBannerText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
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
