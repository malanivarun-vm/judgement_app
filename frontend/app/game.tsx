import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Share,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
  AppState,
  Alert,
  BackHandler,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { buildShareMessage } from '../utils/share';
import { COLORS, SUIT_SYMBOLS, SUIT_DISPLAY_COLORS, SERIF } from '../utils/theme';
import { VARIATIONS } from '../utils/variations';
import { bidStatus, BID_STATUS_COLORS, scoreColor } from '../utils/bidStatus';
import PlayingCard from '../components/PlayingCard';
import BiddingModal from '../components/BiddingModal';
import HandDisplay from '../components/HandDisplay';
import ScoreBoard from '../components/ScoreBoard';
import OpponentSeat from '../components/OpponentSeat';
import ReactionOverlay, { IncomingReaction } from '../components/ReactionOverlay';
import ReactionTray from '../components/ReactionTray';
import TrickCardEntry from '../components/TrickCardEntry';
import ChatDrawer, { FeedItem } from '../components/ChatDrawer';
import TurnClock, { DANGER_AT_SECONDS } from '../components/TurnClock';
import GoldRain from '../components/GoldRain';
import { EntranceView, WinnerAura } from '../components/WinnerCelebration';
import SirenVignette from '../components/SirenVignette';
import AnimatedScore from '../components/AnimatedScore';
import BidTensionMeter from '../components/BidTensionMeter';
import DealDeck from '../components/DealDeck';
import TrumpCinematic from '../components/TrumpCinematic';
import TravelingTurnMarker from '../components/TravelingTurnMarker';
import {
  BACKEND_CONFIG_ERROR,
  BACKEND_URL,
  buildWebSocketUrl,
} from '../utils/backend';
import { seatPositions, seatSize } from '../utils/tableLayout';
import { SoundPack, useTableSound } from '../utils/useCardSound';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

interface GameState {
  type: string;
  room_id: string;
  phase: string;
  active_phase?: string;
  players: {
    id: string;
    name: string;
    avatar?: string;
    is_host: boolean;
    bid: number | null;
    tricks_won: number;
    total_score: number;
    card_count: number;
    is_connected: boolean;
    has_bid: boolean;
    offline_for: number | null;
    streak: number;
    is_bot?: boolean;
    bot_personality?: string | null;
    waiting_for_lobby?: boolean;
  }[];
  your_id: string;
  your_index: number;
  your_hand: { suit: string; rank: string }[];
  current_round: number;
  total_rounds: number;
  cards_this_round: number;
  trump_suit: string | null;
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
  turn_expires_in: number | null;
  turn_timer_seconds: number;
  round_end_auto_seconds: number;
  pace: string;
  blind_draw_available: boolean;
  resume_token?: string | null;
  event_seq: number;
  recent_events: {
    seq: number;
    ts: number;
    round: number;
    kind: string;
    data: Record<string, unknown>;
  }[];
  waiting_count: number;
}

const PACE_OPTIONS = [
  { key: 'chill', label: '🐢 Chill', desc: '30s per move' },
  { key: 'standard', label: '⚡ Standard', desc: '15s per move' },
  { key: 'blitz', label: '🔥 Blitz', desc: '7s — pure adrenaline' },
] as const;

const BOT_OPTIONS = [
  { key: 'safe_uncle', name: 'Safe Uncle', icon: '🛡', desc: 'Conservative and hard to bait' },
  { key: 'chaos_goblin', name: 'Chaos Goblin', icon: '🎲', desc: 'Unpredictable by design' },
  { key: 'probability_nerd', name: 'Probability Nerd', icon: '🧠', desc: 'Counts strength and plays efficiently' },
] as const;

const SOUND_PACKS: { key: SoundPack; label: string; icon: string }[] = [
  { key: 'luxury', label: 'Luxury', icon: '♛' },
  { key: 'indian', label: 'Game Night', icon: '🪘' },
  { key: 'minimal', label: 'Minimal', icon: '◌' },
  { key: 'chaotic', label: 'Chaotic', icon: '⚡' },
];

export default function GameScreen() {
  const params = useLocalSearchParams<{
    room_id: string;
    player_name: string;
    player_id: string;
    host_token?: string;
    avatar?: string;
  }>();
  const router = useRouter();
  const navigation = useNavigation();
  const ws = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<any>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTokenRef = useRef<string | null>(null);
  const sessionReadyRef = useRef(false);
  const resumeStorageKey = `judgement_resume:${params.room_id}:${params.player_id}`;

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
  const [reactions, setReactions] = useState<IncomingReaction[]>([]);
  const [trumpReveal, setTrumpReveal] = useState<string | null>(null);
  const trumpRevealTimer = useRef<any>(null);
  const ambientPulse = useRef(new Animated.Value(0)).current;
  const turnPulse = useRef(new Animated.Value(0)).current;
  const trickPop = useRef(new Animated.Value(0)).current;
  const trickCollect = useRef(new Animated.Value(0)).current;
  const reduceMotionRef = useRef(false);
  const [nowTick, setNowTick] = useState(0);
  const stateReceivedAt = useRef(Date.now());
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [soundPack, setSoundPack] = useState<SoundPack>('luxury');
  const tableSound = useTableSound(soundPack);
  const playCardSound = tableSound.card;
  const playTrickSound = tableSound.trick;
  const playDealSound = tableSound.deal;
  const playTrumpSound = tableSound.trump;
  const prevTrickLenRef = useRef(0);
  const pendingActionRef = useRef<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [leaveMenuOpen, setLeaveMenuOpen] = useState(false);

  // === Table Talk (chat + live event feed) ===
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const chatOpenRef = useRef(false);
  const feedSeq = useRef(0);
  const gameStateRef = useRef<GameState | null>(null);

  // === Authoritative turn countdown ===
  const deadlineRef = useRef<number | null>(null);
  const timerTotalRef = useRef(15);
  const lastWarnAtRef = useRef(-1);

  useEffect(() => {
    chatOpenRef.current = chatOpen;
    if (chatOpen) setUnread(0);
  }, [chatOpen]);

  const pushFeed = useCallback((item: Omit<FeedItem, 'key'>) => {
    feedSeq.current += 1;
    const entry: FeedItem = { ...item, key: `f${feedSeq.current}` };
    setFeed((prev) => {
      const next = [...prev, entry];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, []);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('judgement_sound_pack')
      .then((saved) => {
        if (saved && SOUND_PACKS.some((pack) => pack.key === saved)) {
          setSoundPack(saved as SoundPack);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    // 500ms tick keeps the countdown + offline timers feeling live
    const t = setInterval(() => setNowTick((n) => n + 1), 500);
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

  const [codeCopied, setCodeCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const getShareOrigin = (): string => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
      return window.location.origin;
    }
    return '';
  };

  const copyRoomCode = async (roomId: string) => {
    try {
      await Clipboard.setStringAsync(roomId);
      void fireHaptic('light');
      setCodeCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      Alert.alert('Copy failed', `Room code: ${roomId}`);
    }
  };

  const shareRoomCode = async (roomId: string) => {
    const message = buildShareMessage(roomId, getShareOrigin());
    void fireHaptic('selection');
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
        if (nav?.share) {
          await nav.share({ text: message });
        } else {
          await Clipboard.setStringAsync(message);
          Alert.alert('Message copied', 'Paste it anywhere to invite friends');
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      // user dismissed the share sheet — not an error
    }
  };

  const heartbeatTimer = useRef<any>(null);
  const intentionalClose = useRef(false);

  const connect = useCallback(() => {
    if (intentionalClose.current) return;
    if (!sessionReadyRef.current) return;
    if (!BACKEND_URL) {
      setError(BACKEND_CONFIG_ERROR);
      return;
    }
    if (
      ws.current &&
      (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }

    const url = buildWebSocketUrl(
      BACKEND_URL,
      params.room_id,
      params.player_name || '',
      params.player_id,
      params.host_token,
      resumeTokenRef.current || undefined,
      params.avatar,
    );

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (ws.current !== socket) return;
      setConnected(true);
      setError('');
      void fireHaptic('selection');
      // Heartbeat keeps proxies from dropping the socket and tells the
      // server the room is alive even when the game is idle.
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      heartbeatTimer.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ action: 'ping' }));
        }
      }, 20000);
    };

    socket.onclose = () => {
      if (ws.current !== socket) return;
      setConnected(false);
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
        heartbeatTimer.current = null;
      }
      // Don't resurrect the socket after the player deliberately left
      if (!intentionalClose.current) {
        reconnectTimer.current = setTimeout(connect, 3000);
      }
    };

    socket.onerror = () => {
      if (ws.current !== socket) return;
      setError('Connection error');
    };

    socket.onmessage = (event) => {
      if (ws.current !== socket) return;
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        if (data.type === 'state') {
          const prev = gameStateRef.current;
          gameStateRef.current = data;
          setGameState(data);
          if (data.resume_token && data.resume_token !== resumeTokenRef.current) {
            resumeTokenRef.current = data.resume_token;
            void AsyncStorage.setItem(resumeStorageKey, data.resume_token).catch(() => {});
          }
          pendingActionRef.current = null;
          setPendingAction(null);
          stateReceivedAt.current = Date.now();

          // Arm the local mirror of the server's move countdown
          if (typeof data.turn_expires_in === 'number') {
            deadlineRef.current = Date.now() + data.turn_expires_in * 1000;
            timerTotalRef.current = data.phase === 'round_end'
              ? (data.round_end_auto_seconds ?? 25)
              : (data.turn_timer_seconds ?? 15);
          } else {
            deadlineRef.current = null;
          }

          // Derive live feed events from state changes
          if (prev) {
            if (
              data.phase === 'bidding' &&
              (prev.phase === 'waiting' || prev.current_round !== data.current_round)
            ) {
              pushFeed({
                kind: 'event',
                text: `— Round ${data.current_round} · ${data.cards_this_round} cards each —`,
              });
            }
            data.players.forEach((p: any, i: number) => {
              const old = prev.players[i];
              if (!old || old.id !== p.id) return;
              if (
                !old.has_bid && p.has_bid && p.bid !== null &&
                prev.current_round === data.current_round
              ) {
                pushFeed({ kind: 'event', text: `${p.name} calls ${p.bid}` });
              }
              if ((p.streak ?? 0) >= 2 && (p.streak ?? 0) > (old.streak ?? 0)) {
                pushFeed({
                  kind: 'event',
                  text: `🔥 ${p.name} is ON FIRE — ${p.streak} perfect rounds straight`,
                });
              }
            });
          }
          const trickLen = (data.current_trick || []).length;
          if (trickLen > prevTrickLenRef.current) {
            playCardSound();
          }
          prevTrickLenRef.current = trickLen;
          // Handle trick completion display
          if (data.last_completed_trick) {
            const key = `${data.current_round}-${data.tricks_played}`;
            if (prevTrickRef.current !== key) {
              prevTrickRef.current = key;
              setTrickResult(data.last_completed_trick);
              pushFeed({
                kind: 'event',
                text: `${data.last_completed_trick.winner_name} takes the trick`,
              });
              if (!reduceMotionRef.current) {
                trickPop.setValue(0);
                trickCollect.setValue(0);
                Animated.timing(trickPop, {
                  toValue: 1,
                  duration: 260,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }).start();
                Animated.sequence([
                  Animated.delay(760),
                  Animated.timing(trickCollect, {
                    toValue: 1,
                    duration: 560,
                    easing: Easing.inOut(Easing.cubic),
                    useNativeDriver: true,
                  }),
                ]).start();
              }
              void fireHaptic('success');
              playTrickSound();
              if (trickResultTimer.current) clearTimeout(trickResultTimer.current);
              trickResultTimer.current = setTimeout(() => setTrickResult(null), 1650);
            }
          }
        } else if (data.type === 'error') {
          pendingActionRef.current = null;
          setPendingAction(null);
          setError(data.message);
          void fireHaptic('error');
          setTimeout(() => setError(''), 4000);
        } else if (data.type === 'reaction') {
          const key = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          setReactions((prev) => {
            const next = [
              ...prev,
              {
                key,
                player_index: data.player_index,
                player_name: data.player_name,
                display: data.display,
                kind: data.kind,
              },
            ];
            return next.length > 8 ? next.slice(next.length - 8) : next;
          });
        } else if (data.type === 'chat') {
          const mine = data.player_index === gameStateRef.current?.your_index;
          pushFeed({
            kind: 'chat',
            name: data.player_name,
            text: data.text,
            mine,
          });
          if (!mine && !chatOpenRef.current) {
            setUnread((u) => Math.min(99, u + 1));
            void fireHaptic('light');
          }
        } else if (data.type === 'chat_ack' && !data.accepted) {
          setError(data.message || 'Message was not sent');
          setTimeout(() => setError(''), 4000);
        } else if (data.type === 'timeout') {
          pushFeed({
            kind: 'timeout',
            text: `⏱ ${data.player_name} ran out of time — auto-played`,
          });
        } else if (data.type === 'bot_action') {
          pushFeed({
            kind: 'event',
            text: `♟ ${data.player_name} makes its move`,
          });
        } else if (data.type === 'leave_ack') {
          intentionalClose.current = true;
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          void AsyncStorage.removeItem(resumeStorageKey).catch(() => {});
          socket.close();
          router.replace('/');
        }
      } catch {
        // ignore parse errors
      }
    };
  }, [fireHaptic, params.room_id, params.player_name, params.player_id, params.host_token, params.avatar, resumeStorageKey, router, trickCollect, trickPop, playCardSound, playTrickSound, pushFeed]);

  useEffect(() => {
    let active = true;
    intentionalClose.current = false;
    AsyncStorage.getItem(resumeStorageKey)
      .then((token) => {
        if (!active) return;
        resumeTokenRef.current = token;
        sessionReadyRef.current = true;
        connect();
      })
      .catch(() => {
        if (!active) return;
        sessionReadyRef.current = true;
        connect();
      });
    return () => {
      active = false;
      intentionalClose.current = true;
      sessionReadyRef.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
      if (trickResultTimer.current) clearTimeout(trickResultTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      ws.current?.close();
    };
  }, [connect, resumeStorageKey]);

  // Reconnect the instant the app returns to the foreground. Mobile
  // browsers/OS suspend WebSockets (and throttle timers) while the app is
  // backgrounded — e.g. when switching apps to share the room code — so we
  // cannot rely on the 3s retry loop alone.
  useEffect(() => {
    const onForeground = () => {
      if (!ws.current || ws.current.readyState === WebSocket.CLOSED || ws.current.readyState === WebSocket.CLOSING) {
        connect();
      }
    };

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') onForeground();
    });

    let webCleanup: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibility = () => {
        if (document.visibilityState === 'visible') onForeground();
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('focus', onForeground);
      window.addEventListener('online', onForeground);
      webCleanup = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('focus', onForeground);
        window.removeEventListener('online', onForeground);
      };
    }

    return () => {
      sub.remove();
      webCleanup?.();
    };
  }, [connect]);

  const send = (action: any) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(action));
    }
  };

  const exitGame = () => {
    setLeaveMenuOpen(false);
    intentionalClose.current = true;
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({ action: 'leave_room' }));
      leaveTimer.current = setTimeout(() => {
        void AsyncStorage.removeItem(resumeStorageKey).catch(() => {});
        ws.current?.close();
        router.replace('/');
      }, 800);
    } else {
      void AsyncStorage.removeItem(resumeStorageKey).catch(() => {});
      ws.current?.close();
      router.replace('/');
    }
  };

  const handleLeave = () => {
    setLeaveMenuOpen(true);
  };

  const sendAction = async (action: any, haptic: 'selection' | 'light' | 'medium' | 'success' = 'selection') => {
    const guardedActions = new Set([
      'start_game', 'place_bid', 'play_card', 'call_trump',
      'next_round', 'new_game', 'force_action', 'add_bot', 'remove_bot',
      'return_to_lobby', 'end_game_for_all',
    ]);
    if (ws.current?.readyState !== WebSocket.OPEN) {
      setError('Reconnecting — your move was not sent');
      return;
    }
    if (guardedActions.has(action.action)) {
      if (pendingActionRef.current) return;
      pendingActionRef.current = action.action;
      setPendingAction(action.action);
    }
    await fireHaptic(haptic);
    send(action);
  };

  const returnToLobby = () => {
    setLeaveMenuOpen(false);
    void sendAction({ action: 'return_to_lobby' }, 'medium');
  };

  const endGameForAll = () => {
    setLeaveMenuOpen(false);
    void sendAction({ action: 'end_game_for_all' }, 'medium');
  };

  useEffect(() => {
    const hardwareBack = BackHandler.addEventListener('hardwareBackPress', () => {
      setLeaveMenuOpen(true);
      return true;
    });
    const removeBefore = navigation.addListener('beforeRemove', (event) => {
      if (intentionalClose.current) return;
      event.preventDefault();
      setLeaveMenuOpen(true);
    });
    return () => {
      hardwareBack.remove();
      removeBefore();
    };
  }, [navigation]);

  const removeReaction = useCallback((key: string) => {
    setReactions((prev) => prev.filter((reaction) => reaction.key !== key));
  }, []);

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
      bidLockTimer.current = setTimeout(() => setShowBidLock(false), 2400);
    }

    if ((prev === 'trump_selection' || prev === 'trump_selection_v3') && gameState.trump_suit) {
      setTrumpReveal(gameState.trump_suit);
      playTrumpSound();
      if (trumpRevealTimer.current) clearTimeout(trumpRevealTimer.current);
      trumpRevealTimer.current = setTimeout(() => setTrumpReveal(null), 1700);
    }

    if (next === 'game_over') {
      void fireHaptic('success');
    }
  }, [gameState, bidLockAnim, fireHaptic, playTrumpSound]);

  const currentRoundForSound = gameState?.current_round ?? 0;
  useEffect(() => {
    if (currentRoundForSound <= 0) return;
    playDealSound();
  }, [currentRoundForSound, playDealSound]);

  useEffect(() => {
    return () => {
      if (bidLockTimer.current) clearTimeout(bidLockTimer.current);
      if (trumpRevealTimer.current) clearTimeout(trumpRevealTimer.current);
    };
  }, []);

  // Siren haptics: buzz once per second during the final 3 seconds of MY move
  useEffect(() => {
    const id = setInterval(() => {
      const gs = gameStateRef.current;
      if (!gs || deadlineRef.current === null) return;
      if (gs.current_player_index !== gs.your_index) return;
      if (!['bidding', 'playing', 'trump_selection', 'trump_selection_v3'].includes(gs.phase)) return;
      const rem = Math.ceil((deadlineRef.current - Date.now()) / 1000);
      if (rem > 0 && rem <= DANGER_AT_SECONDS && lastWarnAtRef.current !== rem) {
        lastWarnAtRef.current = rem;
        void fireHaptic('error');
      }
    }, 250);
    return () => clearInterval(id);
  }, [fireHaptic]);

  // Loading state
  if (!gameState) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          {!error && <ActivityIndicator size="large" color={COLORS.gold} />}
          <Text style={styles.loadingText}>
            {error || (connected ? 'Loading game...' : 'Connecting...')}
          </Text>
          {error && (
            <TouchableOpacity style={styles.outlineButton} onPress={() => router.replace('/')}>
              <Text style={styles.outlineButtonText}>Back to Home</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const { phase, players, your_id, your_index } = gameState;
  const isHost = players.find((p) => p.id === your_id)?.is_host || false;
  const hostPlayer = players.find((p) => p.is_host);
  // If the host is offline, any connected player may act for a stuck player
  const canForce = isHost || !hostPlayer || !hostPlayer.is_connected;
  const myInfo = players[your_index] || players.find((p) => p.id === your_id);
  const currentPlayerName = players[gameState.current_player_index]?.name || '';
  const isMyTurn = gameState.current_player_index === your_index;
  const opponents = players.length > 1
    ? Array.from(
        { length: players.length - 1 },
        (_, offset) => players[(your_index + offset + 1) % players.length],
      )
    : [];
  const currentPlayer = players[gameState.current_player_index];
  const currentPlayerOffline = currentPlayer && !currentPlayer.is_connected;
  const offlineElapsed = currentPlayerOffline && currentPlayer.offline_for !== null
    ? currentPlayer.offline_for + (Date.now() - stateReceivedAt.current) / 1000
    : 0;
  const forceRemaining = Math.max(0, Math.ceil((gameState.force_grace_seconds ?? 15) - offlineElapsed));
  void nowTick; // re-render driver for the countdown

  // Server-authoritative move countdown, mirrored locally
  const timerRemaining = deadlineRef.current !== null
    ? Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000))
    : null;
  const timerTotal = timerTotalRef.current;
  const effectivePhase = gameState.active_phase || phase;
  const activeGameForLeave = !['waiting', 'waiting_for_lobby', 'game_over'].includes(effectivePhase);
  const leaveModal = (
    <LeaveOptionsModal
      visible={leaveMenuOpen}
      isHost={isHost}
      activeGame={activeGameForLeave}
      onLobby={returnToLobby}
      onEndAll={endGameForAll}
      onExit={exitGame}
      onCancel={() => setLeaveMenuOpen(false)}
    />
  );
  const sendChat = (text: string) => {
    if (ws.current?.readyState !== WebSocket.OPEN) {
      setError('Message not sent while reconnecting');
      return;
    }
    const messageId = `${params.player_id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    void sendAction({ action: 'chat', text, message_id: messageId }, 'light');
  };

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

  if (phase === 'waiting_for_lobby') {
    const selectedVariation = VARIATIONS.find((item) => item.key === gameState.variation) || VARIATIONS[0];
    return (
      <SafeAreaView style={styles.container}>
        <TouchableOpacity testID="leave-waiting-btn" style={styles.backBtn} onPress={handleLeave}>
          <Text style={styles.backBtnText}>← Leave</Text>
        </TouchableOpacity>
        <ScrollView contentContainerStyle={styles.waitingLobbyWrap}>
          <Text style={styles.lobbyKicker}>GAME LOBBY</Text>
          <Text style={styles.lobbyTitle}>Waiting Room</Text>
          <View style={styles.waitingMessageCard}>
            <ActivityIndicator color={COLORS.gold} />
            <Text style={styles.waitingMessage}>
              Waiting for the host and other users to come back to Lobby
            </Text>
            <Text style={styles.waitingMessageSub}>
              The current {selectedVariation.name} game is still in progress. You’ll be included
              when the table starts a fresh game.
            </Text>
          </View>

          <Text style={styles.playerCountText}>Room members ({players.length})</Text>
          <View style={styles.playerList}>
            {players.map((player) => (
              <View key={player.id} style={styles.playerItem}>
                <View style={[styles.avatar, player.id === your_id && styles.avatarYou]}>
                  <Text style={styles.avatarText}>{player.is_bot ? '♟' : player.name[0]?.toUpperCase()}</Text>
                </View>
                <Text style={styles.playerName}>{player.name}</Text>
                {player.is_host && (
                  <View style={styles.badge}><Text style={styles.badgeText}>HOST</Text></View>
                )}
                {player.waiting_for_lobby && (
                  <View style={[styles.badge, styles.badgeYou]}><Text style={styles.badgeText}>LOBBY</Text></View>
                )}
              </View>
            ))}
          </View>

          <Text style={styles.variationLabel}>GAME MODE — LOCKED DURING PLAY</Text>
          <View style={styles.disabledPicker}>
            {VARIATIONS.map((variation) => (
              <View
                key={variation.key}
                style={[
                  styles.variationOption,
                  variation.key === gameState.variation && styles.variationOptionSelected,
                ]}
              >
                <Text style={styles.variationName}>{variation.name}</Text>
                <Text style={styles.variationDesc}>{variation.desc}</Text>
              </View>
            ))}
          </View>

          <View style={styles.lobbyChatWrap}>
            <ChatDrawer inline items={feed} onSend={sendChat} />
          </View>
        </ScrollView>
        {leaveModal}
      </SafeAreaView>
    );
  }

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
          <View style={styles.lobbyKickerRow}>
            <View style={styles.lobbyKickerRule} />
            <Text style={styles.lobbyKicker}>PRIVATE TABLE</Text>
            <View style={styles.lobbyKickerRule} />
          </View>
          <Text style={styles.lobbyTitle}>Judgement</Text>

          <View style={styles.roomCodeBox}>
            <View style={styles.roomCodeInner}>
              <Text style={styles.roomCodeLabel}>ROOM CODE</Text>
              <Text style={styles.roomCode}>{gameState.room_id}</Text>
              <Text style={styles.roomCodeHint}>Share this code with friends</Text>
            </View>
            <View style={styles.roomCodeActions}>
              <TouchableOpacity
                testID="copy-code-btn"
                style={styles.roomCodeActionBtn}
                onPress={() => void copyRoomCode(gameState.room_id)}
                activeOpacity={0.7}
                accessibilityLabel="Copy room code"
              >
                <Ionicons
                  name={codeCopied ? 'checkmark' : 'copy-outline'}
                  size={16}
                  color={codeCopied ? COLORS.success : COLORS.gold}
                />
                <Text style={[styles.roomCodeActionText, codeCopied && styles.roomCodeActionTextDone]}>
                  {codeCopied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="share-code-btn"
                style={styles.roomCodeActionBtn}
                onPress={() => void shareRoomCode(gameState.room_id)}
                activeOpacity={0.7}
                accessibilityLabel="Share room code"
              >
                <Ionicons name="share-social-outline" size={16} color={COLORS.gold} />
                <Text style={styles.roomCodeActionText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.playerCountText}>
            Players ({players.length}/7)
          </Text>

          <View style={styles.playerList}>
            {players.map((p) => (
              <View
                key={p.id}
                testID={`player-${p.id}`}
                style={[styles.playerItem, !p.is_connected && styles.playerItemAway]}
              >
                <View style={[styles.avatar, p.id === your_id && styles.avatarYou]}>
                  <Text style={styles.avatarText}>{p.avatar || (p.is_bot ? '♟' : p.name[0]?.toUpperCase())}</Text>
                </View>
                <Text style={styles.playerName}>{p.name}</Text>
                {!p.is_connected && (
                  <View style={[styles.badge, styles.badgeAway]}>
                    <Text style={styles.badgeText}>AWAY</Text>
                  </View>
                )}
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
                {isHost && p.is_bot && (
                  <TouchableOpacity
                    testID={`remove-bot-${p.id}`}
                    style={styles.removeBotBtn}
                    onPress={() => void sendAction({ action: 'remove_bot', bot_id: p.id }, 'light')}
                  >
                    <Text style={styles.removeBotText}>×</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {isHost && players.length < 7 && (
            <View style={styles.ghostDealerSection}>
              <View style={styles.ghostDealerHeader}>
                <Text style={styles.variationLabel}>GHOST DEALERS</Text>
                <Text style={styles.ghostDealerHint}>Fill an empty seat</Text>
              </View>
              <View style={styles.botGrid}>
                {BOT_OPTIONS.map((bot) => (
                  <TouchableOpacity
                    key={bot.key}
                    testID={`add-bot-${bot.key}`}
                    style={styles.botOption}
                    disabled={pendingAction === 'add_bot'}
                    onPress={() => void sendAction({
                      action: 'add_bot',
                      personality: bot.key,
                    }, 'medium')}
                  >
                    <Text style={styles.botIcon}>{bot.icon}</Text>
                    <Text style={styles.botName}>{bot.name}</Text>
                    <Text style={styles.botDesc}>{bot.desc}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

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
                  <Text style={styles.modeInfoText}>What&apos;s this? →</Text>
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

          <View style={styles.variationSection}>
            <Text style={styles.variationLabel}>TABLE PACE</Text>
            <View style={styles.paceRow}>
              {PACE_OPTIONS.map((opt) => {
                const selected = (gameState.pace || 'standard') === opt.key;
                if (!isHost) {
                  return selected ? (
                    <View key={opt.key} style={[styles.paceChip, styles.paceChipSelected]}>
                      <Text style={styles.paceChipLabelSelected}>{opt.label}</Text>
                      <Text style={styles.paceChipDesc}>{opt.desc}</Text>
                    </View>
                  ) : null;
                }
                return (
                  <TouchableOpacity
                    key={opt.key}
                    testID={`pace-${opt.key}`}
                    style={[styles.paceChip, selected && styles.paceChipSelected]}
                    onPress={() => void sendAction({ action: 'set_pace', pace: opt.key }, 'selection')}
                    activeOpacity={0.8}
                  >
                    <Text style={selected ? styles.paceChipLabelSelected : styles.paceChipLabel}>
                      {opt.label}
                    </Text>
                    <Text style={styles.paceChipDesc}>{opt.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.variationSection}>
            <Text style={styles.variationLabel}>YOUR SOUND PACK</Text>
            <View style={styles.soundPackRow}>
              {SOUND_PACKS.map((pack) => {
                const selected = soundPack === pack.key;
                return (
                  <TouchableOpacity
                    key={pack.key}
                    testID={`sound-pack-${pack.key}`}
                    style={[styles.soundPackChip, selected && styles.soundPackChipSelected]}
                    onPress={() => {
                      setSoundPack(pack.key);
                      void AsyncStorage.setItem('judgement_sound_pack', pack.key).catch(() => {});
                      void fireHaptic('selection');
                    }}
                  >
                    <Text style={styles.soundPackIcon}>{pack.icon}</Text>
                    <Text style={selected ? styles.soundPackLabelSelected : styles.soundPackLabel}>
                      {pack.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.lobbyChatWrap}>
            <ChatDrawer inline items={feed} onSend={sendChat} />
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
        <View style={styles.lobbyReactionWrap}>
          <ReactionTray onSend={(id) => void sendAction({ action: 'reaction', reaction_id: id }, 'light')} />
        </View>
        <ReactionOverlay
          reactions={reactions}
          playerCount={players.length}
          reduceMotion={reduceMotion}
          onDone={removeReaction}
        />
        {leaveModal}
      </SafeAreaView>
    );
  }

  // === GAME OVER ===
  if (phase === 'game_over') {
    const sorted = [...players].sort((a, b) => b.total_score - a.total_score);
    // Choreography: title → runners-up rise one by one → winner lands
    // last → crown drops → champion line. All delays from mount.
    const runnerUpDelay = (i: number) => 140 + (i - 1) * 90;
    const winnerDelay = 140 + Math.max(0, sorted.length - 1) * 90 + 160;
    const crownAt = winnerDelay + 320;
    return (
      <SafeAreaView style={styles.container}>
        <GoldRain reduceMotion={reduceMotion} />
        <ScrollView contentContainerStyle={styles.gameOverWrap}>
          <EntranceView reduceMotion={reduceMotion}>
            <Text style={styles.gameOverTitle}>Game Over!</Text>
          </EntranceView>
          {sorted[0] && (
            <EntranceView delay={crownAt + 300} distance={8} reduceMotion={reduceMotion}>
              <Text style={styles.championLabel}>👑 {sorted[0].name} runs the table</Text>
            </EntranceView>
          )}

          <View style={styles.podium}>
            {sorted.map((p, i) => (
              <EntranceView
                key={p.id}
                delay={i === 0 ? winnerDelay : runnerUpDelay(i)}
                reduceMotion={reduceMotion}
              >
                <View style={[styles.standingItem, i === 0 && styles.standingItemWinner]}>
                  <Text style={styles.standingRank}>#{i + 1}</Text>
                  {i === 0 ? (
                    <WinnerAura
                      size={48}
                      crownDelay={crownAt}
                      reduceMotion={reduceMotion}
                      style={styles.winnerAura}
                    >
                      <View style={[styles.avatar, styles.avatarWinner, styles.avatarWinnerBig]}>
                        <Text style={[styles.avatarText, styles.avatarTextBig]}>
                          {p.avatar || p.name[0]?.toUpperCase()}
                        </Text>
                      </View>
                    </WinnerAura>
                  ) : (
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{p.avatar || p.name[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <Text style={[styles.standingName, i === 0 && styles.standingNameWinner]}>
                    {p.name}
                  </Text>
                  <Text style={[styles.standingScore, i === 0 && { color: COLORS.gold }]}>
                    {p.total_score} pts
                  </Text>
                </View>
              </EntranceView>
            ))}
          </View>

          <ScoreBoard
            roundHistory={gameState.round_history}
            players={players}
          />

          <View style={styles.gameOverBtns}>
            {isHost && (
              <>
                <TouchableOpacity
                  testID="new-game-btn"
                  style={styles.goldButton}
                  onPress={() => void sendAction({ action: 'new_game' }, 'medium')}
                  activeOpacity={0.8}
                >
                  <Text style={styles.goldButtonText}>Play Again</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="choose-mode-btn"
                  style={styles.outlineButton}
                  onPress={endGameForAll}
                  activeOpacity={0.8}
                >
                  <Text style={styles.outlineButtonText}>Choose a New Mode</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              testID="home-btn"
              style={styles.outlineButton}
              onPress={exitGame}
              activeOpacity={0.8}
            >
              <Text style={styles.outlineButtonText}>Back to Home</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        {leaveModal}
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

          {timerRemaining !== null && (
            <Text style={styles.roundEndCountdown}>
              Next round starts in {timerRemaining}s
            </Text>
          )}

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
        {leaveModal}
      </SafeAreaView>
    );
  }

  // === BIDDING / PLAYING (Main Game Table) ===
  const trumpColor = gameState.trump_suit
    ? SUIT_DISPLAY_COLORS[gameState.trump_suit] || '#FFF'
    : COLORS.textSecondary;
  const trumpSymbol = gameState.trump_suit ? SUIT_SYMBOLS[gameState.trump_suit] || '' : '—';
  const showBiddingModal = phase === 'bidding' && isMyTurn;
  const totalBids = players.filter((p) => p.has_bid).reduce((sum, p) => sum + (p.bid ?? 0), 0);
  const activeModeName = VARIATIONS.find((item) => item.key === gameState.variation)?.name || 'Classic';
  const showTrumpSelection = phase === 'trump_selection' || phase === 'trump_selection_v3';
  const trumpCaller = players[gameState.trump_caller_index];
  const iAmTrumpCaller = gameState.trump_caller_index === your_index;
  const isTightGame = totalBids > gameState.cards_this_round;

  // Determine trick cards to display
  const displayTrickCards = trickResult
    ? trickResult.cards
    : gameState.current_trick;
  const winnerRelative = trickResult
    ? (trickResult.winner_index - your_index + players.length) % players.length
    : 0;
  const collectToX = winnerRelative === 0
    ? 0
    : winnerRelative <= players.length / 2 ? -145 : 145;
  const collectToY = winnerRelative === 0 ? 170 : -115;

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

        {!connected && (
          <View style={styles.reconnectBanner} accessibilityRole="alert">
            <ActivityIndicator size="small" color={COLORS.gold} />
            <Text style={styles.reconnectBannerText}>Reconnecting — moves are paused</Text>
          </View>
        )}

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

            <TouchableOpacity
              testID="chat-toggle-btn"
              onPress={() => setChatOpen(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.helpBtn}
            >
              <Text style={styles.helpBtnText}>💬</Text>
              {unread > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unread}</Text>
                </View>
              )}
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
              <StatusPill label="Mode" value={activeModeName} />
              {gameState.waiting_count > 0 && (
                <StatusPill label="Lobby" value={`${gameState.waiting_count} waiting`} />
              )}
            </View>
            <BidTensionMeter total={totalBids} available={gameState.cards_this_round} />
          </View>

          <View
            style={styles.ovalStage}
            onLayout={(e) => setStageSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
          >
            <DealDeck
              round={gameState.current_round}
              active={
                (phase === 'bidding' && totalBids === 0)
                || phase === 'trump_selection'
                || phase === 'trump_selection_v3'
              }
              reduceMotion={reduceMotion}
            />
            {stageSize.w > 0 && (() => {
              const { width: seatW, height: seatH } = seatSize(opponents.length, stageSize.w);
              const positions = seatPositions(opponents.length, stageSize.w, stageSize.h, seatW, seatH);
              return (
                <>
                  <View
                    style={[
                      styles.tableSurface,
                      {
                        left: seatW * 0.5,
                        right: seatW * 0.5,
                        top: seatH * 0.8,
                        bottom: seatH * 0.3,
                        borderRadius: Math.max(60, (stageSize.h - seatH * 1.1) / 2),
                      },
                    ]}
                  >
                    {currentPlayerOffline && (phase === 'playing' || phase === 'bidding') && (
                      <OfflineRecoveryBanner
                        name={currentPlayer.name}
                        remaining={forceRemaining}
                        canForce={canForce}
                        onForce={() => void sendAction({ action: 'force_action' }, 'medium')}
                      />
                    )}

                    {trickResult && (
                      <Animated.View
                        style={[
                          styles.trickResultCard,
                          {
                            opacity: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.1, 1] }),
                            transform: [
                              { scale: trickPop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
                            ],
                          },
                        ]}
                      >
                        <Text style={styles.trickWinnerText}>{trickResult.winner_name} took the trick</Text>
                      </Animated.View>
                    )}

                    {displayTrickCards && displayTrickCards.length > 0 ? (
                      <Animated.View
                        style={[
                          styles.trickCards,
                          trickResult && {
                            opacity: trickCollect.interpolate({
                              inputRange: [0, 0.72, 1],
                              outputRange: [1, 1, 0],
                            }),
                            transform: [
                              {
                                translateX: trickCollect.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, collectToX],
                                }),
                              },
                              {
                                translateY: trickCollect.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, collectToY],
                                }),
                              },
                              {
                                scale: trickCollect.interpolate({
                                  inputRange: [0, 0.6, 1],
                                  outputRange: [1, 1.08, 0.38],
                                }),
                              },
                            ],
                          },
                        ]}
                      >
                        {displayTrickCards.map((tc: any, i: number) => {
                          const isWinner = trickResult && tc.player_index === trickResult.winner_index;
                          return (
                            <View key={i} style={styles.trickCardWrap}>
                              <TrickCardEntry
                                animate={!trickResult && i === displayTrickCards.length - 1}
                                playerIndex={tc.player_index}
                                yourIndex={your_index}
                                playerCount={players.length}
                              >
                                <View style={isWinner ? styles.winnerHighlight : undefined}>
                                  <PlayingCard card={tc.card} size="trick" highlighted={isWinner} />
                                </View>
                              </TrickCardEntry>
                              <Text style={styles.trickCardName}>
                                {players[tc.player_index]?.name || '?'}
                              </Text>
                            </View>
                          );
                        })}
                      </Animated.View>
                    ) : (
                      <Text style={styles.tableCenterLabel}>
                        {phase === 'bidding'
                          ? isMyTurn
                            ? 'Your turn to bid'
                            : `Waiting for ${currentPlayerName} to bid`
                          : isMyTurn
                            ? 'Your turn — play a card'
                            : `Waiting for ${currentPlayerName} to ${gameState.current_trick.length === 0 ? 'lead' : 'play'}`}
                      </Text>
                    )}

                    {displayTrickCards && displayTrickCards.length > 0 && !trickResult && (
                      <Animated.Text
                        style={[
                          styles.tableTurnHint,
                          isMyTurn && styles.tableTurnHintActive,
                          { opacity: turnPulse.interpolate({ inputRange: [0.2, 1], outputRange: [0.7, 1] }) },
                        ]}
                      >
                        {isMyTurn ? 'Your turn' : `Waiting for ${currentPlayerName}`}
                      </Animated.Text>
                    )}
                  </View>

                  {opponents.map((opp, index) => {
                    const oppIdx = players.findIndex((p) => p.id === opp.id);
                    return (
                      <OpponentSeat
                        key={opp.id}
                        player={opp}
                        isTurn={gameState.current_player_index === oppIdx}
                        isDealer={gameState.dealer_index === oppIdx}
                        phase={phase}
                        style={{ ...positions[index], width: seatW, minHeight: seatH }}
                      />
                    );
                  })}
                  {(() => {
                    const current = players[gameState.current_player_index];
                    const opponentIndex = opponents.findIndex((p) => p.id === current?.id);
                    const turnTarget = opponentIndex >= 0
                      ? {
                          x: positions[opponentIndex].left + seatW / 2 - 9,
                          y: positions[opponentIndex].top - 13,
                        }
                      : {
                          x: stageSize.w / 2 - 9,
                          y: stageSize.h - 30,
                        };
                    const dealer = players[gameState.dealer_index];
                    const dealerOpponentIndex = opponents.findIndex((p) => p.id === dealer?.id);
                    const dealerTarget = dealerOpponentIndex >= 0
                      ? {
                          x: positions[dealerOpponentIndex].left + seatW / 2 - 9,
                          y: positions[dealerOpponentIndex].top + seatH - 5,
                        }
                      : {
                          x: stageSize.w / 2 + 24,
                          y: stageSize.h - 32,
                        };
                    return (
                      <>
                        <TravelingTurnMarker
                          x={turnTarget.x}
                          y={turnTarget.y}
                          reduceMotion={reduceMotion}
                        />
                        <TravelingTurnMarker
                          x={dealerTarget.x}
                          y={dealerTarget.y}
                          reduceMotion={reduceMotion}
                          variant="dealer"
                        />
                      </>
                    );
                  })()}
                </>
              );
            })()}

            {(phase === 'bidding' || phase === 'playing') && timerRemaining !== null && (
              <View style={styles.turnClockWrap} pointerEvents="none">
                <TurnClock
                  remaining={timerRemaining}
                  total={timerTotal}
                  playerName={currentPlayerName}
                  myTurn={isMyTurn}
                  reduceMotion={reduceMotion}
                />
              </View>
            )}
          </View>

          <View style={styles.selfDock}>
            <View style={styles.selfMeta}>
              <View>
                <Text style={styles.selfName}>
                  {myInfo?.name || params.player_name}
                  {(myInfo?.streak ?? 0) >= 2 ? `  🔥${myInfo?.streak}` : ''}
                </Text>
                <Text
                  style={[
                    styles.selfSubtext,
                    myInfo?.bid !== null && myInfo?.bid !== undefined
                      ? { color: BID_STATUS_COLORS[bidStatus(myInfo.bid, myInfo.tricks_won)] }
                      : null,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {gameState.dealer_index === your_index ? 'Dealer' : ''}
                  {myInfo?.bid !== null && myInfo?.bid !== undefined
                    ? `${gameState.dealer_index === your_index ? ' • ' : ''}Bid ${myInfo.bid} / Won ${myInfo.tricks_won}`
                    : `${gameState.dealer_index === your_index ? ' • ' : ''}No bid yet`}
                </Text>
              </View>
              <ReactionTray onSend={(id) => void sendAction({ action: 'reaction', reaction_id: id }, 'light')} />
              <AnimatedScore
                value={myInfo?.total_score || 0}
                suffix=" pts"
                style={[styles.selfScore, { color: scoreColor(myInfo?.total_score || 0) }]}
              />
            </View>
          </View>

          <View style={styles.handDock}>
            <HandDisplay
              hand={gameState.your_hand}
              playableIndices={
                phase === 'playing' && isMyTurn && pendingAction !== 'play_card'
                  ? playableIndices
                  : null
              }
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
            priorBids={players
              .filter((player) => player.has_bid && player.bid !== null)
              .map((player) => ({ id: player.id, name: player.name, bid: player.bid as number }))}
            onPlaceBid={(bid) => void sendAction({ action: 'place_bid', bid }, 'medium')}
            secondsLeft={timerRemaining}
            submitting={pendingAction === 'place_bid'}
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
                          disabled={pendingAction === 'call_trump'}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.suitButtonSymbol, { color: SUIT_DISPLAY_COLORS[s] }]}>
                            {SUIT_SYMBOLS[s]}
                          </Text>
                          <Text style={styles.suitButtonLabel}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    {phase === 'trump_selection' && gameState.blind_draw_available && (
                      <TouchableOpacity
                        testID="trump-blind-draw"
                        style={styles.blindDrawButton}
                        onPress={() => void sendAction({ action: 'call_trump', suit: null }, 'medium')}
                        disabled={pendingAction === 'call_trump'}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.blindDrawText}>Blind Draw — random suit</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : currentPlayerOffline ? (
                  <OfflineRecoveryBanner
                    name={currentPlayer.name}
                    remaining={forceRemaining}
                    canForce={canForce}
                    onForce={() => void sendAction({ action: 'force_action' }, 'medium')}
                  />
                ) : (
                  <>
                    <ActivityIndicator size="small" color={COLORS.gold} />
                    <Text style={styles.trumpWaitText}>
                      Waiting for {trumpCaller?.name || 'player'} to{' '}
                      {phase === 'trump_selection' ? 'call trump' : 'choose trump'}
                    </Text>
                  </>
                )}
                {timerRemaining !== null && (
                  <View style={styles.trumpClockWrap}>
                    <TurnClock
                      remaining={timerRemaining}
                      total={timerTotal}
                      playerName={trumpCaller?.name || ''}
                      myTurn={iAmTrumpCaller}
                      reduceMotion={reduceMotion}
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {trumpReveal && <TrumpCinematic suit={trumpReveal} reduceMotion={reduceMotion} />}

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
                <Animated.Text
                  style={[
                    styles.bidLockStamp,
                    {
                      transform: [
                        { rotate: '-7deg' },
                        {
                          scale: bidLockAnim.interpolate({
                            inputRange: [0, 0.72, 1],
                            outputRange: [2.4, 0.88, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  LOCKED
                </Animated.Text>
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

          <ReactionOverlay
            reactions={reactions}
            playerCount={players.length}
            reduceMotion={reduceMotion}
            onDone={removeReaction}
          />

        </View>

        {isMyTurn &&
          timerRemaining !== null &&
          timerRemaining > 0 &&
          timerRemaining <= DANGER_AT_SECONDS &&
          (phase === 'bidding' || phase === 'playing') && (
            <SirenVignette reduceMotion={reduceMotion} />
        )}

        <ChatDrawer
          items={feed}
          visible={chatOpen}
          onClose={() => setChatOpen(false)}
          onSend={sendChat}
        />
        {leaveModal}
      </View>
    </SafeAreaView>
  );
}

function LeaveOptionsModal({
  visible,
  isHost,
  activeGame,
  onLobby,
  onEndAll,
  onExit,
  onCancel,
}: {
  visible: boolean;
  isHost: boolean;
  activeGame: boolean;
  onLobby: () => void;
  onEndAll: () => void;
  onExit: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.leaveModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onCancel} />
        <View style={styles.leaveModalPanel}>
          <Text style={styles.leaveModalKicker}>LEAVE TABLE</Text>
          <Text style={styles.leaveModalTitle}>Where would you like to go?</Text>
          <Text style={styles.leaveModalBody}>
            Returning to the lobby keeps you in this room for the next game.
          </Text>

          {activeGame && (
            <TouchableOpacity style={styles.leaveChoicePrimary} onPress={onLobby}>
              <Text style={styles.leaveChoicePrimaryTitle}>Return to Lobby</Text>
              <Text style={styles.leaveChoicePrimaryBody}>Wait for everyone and choose a new mode</Text>
            </TouchableOpacity>
          )}

          {isHost && activeGame && (
            <TouchableOpacity style={styles.leaveChoiceDanger} onPress={onEndAll}>
              <Text style={styles.leaveChoiceDangerTitle}>End Game for Everyone</Text>
              <Text style={styles.leaveChoiceBody}>Move the whole table back to the lobby</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.leaveChoice} onPress={onExit}>
            <Text style={styles.leaveChoiceTitle}>
              {isHost && activeGame ? 'Leave & Keep Game Running' : 'Exit Game'}
            </Text>
            <Text style={styles.leaveChoiceBody}>
              {isHost && activeGame
                ? 'Host rights pass to the next joined player'
                : 'Return to the home screen'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.leaveCancel} onPress={onCancel}>
            <Text style={styles.leaveCancelText}>Stay at the Table</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
  canForce,
  onForce,
}: {
  name: string;
  remaining: number;
  canForce: boolean;
  onForce: () => void;
}) {
  return (
    <View style={styles.offlineBanner}>
      <Text style={styles.offlineBannerTitle}>{name} is offline</Text>
      {remaining > 0 ? (
        <Text style={styles.offlineBannerSub}>
          Giving them {remaining}s to reconnect…
        </Text>
      ) : canForce ? (
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
  waitingLobbyWrap: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 54,
    alignItems: 'center',
  },
  waitingMessageCard: {
    width: '100%',
    alignItems: 'center',
    gap: 10,
    padding: 20,
    marginBottom: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.07)',
  },
  waitingMessage: {
    color: COLORS.goldLight,
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    fontWeight: '900',
  },
  waitingMessageSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  disabledPicker: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    opacity: 0.42,
    marginBottom: 20,
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
  lobbyKickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  lobbyKickerRule: {
    width: 44,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.45)',
  },
  lobbyKicker: {
    color: 'rgba(243,229,171,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
  },
  lobbyTitle: {
    color: COLORS.goldLight,
    fontFamily: SERIF,
    fontSize: 38,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
    textShadowColor: 'rgba(212,175,55,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 16,
  },
  roomCodeBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: 18,
    padding: 6,
    alignItems: 'center',
    marginBottom: 24,
    alignSelf: 'stretch',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  roomCodeInner: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 13,
    paddingVertical: 14,
    paddingHorizontal: 28,
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
  roomCodeActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    marginBottom: 8,
  },
  roomCodeActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    minHeight: 44,
  },
  roomCodeActionText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
  },
  roomCodeActionTextDone: {
    color: COLORS.success,
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
  badgeAway: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  playerItemAway: {
    opacity: 0.55,
  },
  badgeText: {
    color: COLORS.goldLight,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  removeBotBtn: {
    width: 28,
    height: 28,
    marginLeft: 8,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  removeBotText: {
    color: '#FF8D8D',
    fontSize: 19,
    lineHeight: 20,
    fontWeight: '700',
  },
  ghostDealerSection: {
    width: '100%',
    marginBottom: 20,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(155,126,255,0.24)',
    backgroundColor: 'rgba(92,65,160,0.08)',
  },
  ghostDealerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  ghostDealerHint: {
    color: COLORS.textSecondary,
    fontSize: 10,
  },
  botGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  botOption: {
    flexGrow: 1,
    flexBasis: '30%',
    minWidth: 96,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  botIcon: {
    fontSize: 22,
    marginBottom: 4,
  },
  botName: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '900',
    textAlign: 'center',
  },
  botDesc: {
    color: COLORS.textSecondary,
    fontSize: 9,
    lineHeight: 12,
    marginTop: 3,
    textAlign: 'center',
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
  lobbyReactionWrap: {
    position: 'absolute',
    right: 20,
    bottom: 28,
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
    flexWrap: 'wrap',
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
  reconnectBanner: {
    position: 'absolute',
    top: 10,
    alignSelf: 'center',
    zIndex: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(8,24,17,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
  },
  reconnectBannerText: {
    color: COLORS.goldLight,
    fontSize: 12,
    fontWeight: '800',
  },
  leaveModalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(2,8,5,0.82)',
  },
  leaveModalPanel: {
    width: '100%',
    maxWidth: 390,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.34)',
    backgroundColor: '#0B2117',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 20,
  },
  leaveModalKicker: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 2.4,
    textAlign: 'center',
  },
  leaveModalTitle: {
    color: COLORS.goldLight,
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  leaveModalBody: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 16,
  },
  leaveChoicePrimary: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 9,
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  leaveChoicePrimaryTitle: {
    color: COLORS.goldLight,
    fontSize: 15,
    fontWeight: '900',
  },
  leaveChoicePrimaryBody: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  leaveChoiceDanger: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 9,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.5)',
  },
  leaveChoiceDangerTitle: {
    color: '#FF8F8F',
    fontSize: 15,
    fontWeight: '900',
  },
  leaveChoice: {
    padding: 14,
    borderRadius: 14,
    marginBottom: 9,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  leaveChoiceTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '800',
  },
  leaveChoiceBody: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  leaveCancel: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  leaveCancelText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
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
  ovalStage: {
    flex: 1,
    position: 'relative',
    marginVertical: 4,
  },
  tableSurface: {
    position: 'absolute',
    borderWidth: 1.5,
    borderColor: COLORS.borderAccent,
    backgroundColor: 'rgba(15, 43, 29, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 4,
    overflow: 'hidden',
  },
  tableCenterLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  tableTurnHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tableTurnHintActive: {
    color: COLORS.gold,
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
  unreadBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: COLORS.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  turnClockWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 6,
  },
  trumpClockWrap: {
    marginTop: 14,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  lobbyChatWrap: {
    width: '100%',
    marginBottom: 20,
  },
  paceRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  paceChip: {
    flexGrow: 1,
    flexBasis: '30%',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  paceChipSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  paceChipLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  paceChipLabelSelected: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '800',
  },
  paceChipDesc: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  soundPackRow: {
    flexDirection: 'row',
    gap: 7,
  },
  soundPackChip: {
    flex: 1,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: COLORS.surfaceGlass,
    gap: 3,
  },
  soundPackChipSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.12)',
  },
  soundPackIcon: {
    fontSize: 17,
  },
  soundPackLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
  },
  soundPackLabelSelected: {
    color: COLORS.goldLight,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  roundEndCountdown: {
    color: COLORS.goldLight,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 15,
    marginTop: 14,
    textAlign: 'center',
  },
  championLabel: {
    color: COLORS.goldLight,
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 17,
    marginTop: -10,
    marginBottom: 18,
    textAlign: 'center',
  },
  // Trick Area
  trickWinnerText: {
    color: COLORS.gold,
    fontFamily: SERIF,
    fontSize: 15,
    fontWeight: '700',
    fontStyle: 'italic',
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
    fontFamily: SERIF,
    fontSize: 28,
    fontWeight: '700',
    textShadowColor: 'rgba(212,175,55,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
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
    fontFamily: SERIF,
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 20,
    marginTop: 20,
    textShadowColor: 'rgba(212,175,55,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
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
  standingItemWinner: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.45)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingVertical: 18,
  },
  winnerAura: {
    marginRight: 12,
  },
  avatarWinnerBig: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 0,
  },
  avatarTextBig: {
    fontSize: 22,
  },
  standingNameWinner: {
    fontSize: 17,
    fontWeight: '800',
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
    fontFamily: SERIF,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
    textShadowColor: 'rgba(212,175,55,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
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
    fontFamily: SERIF,
    fontSize: 20,
    fontWeight: '700',
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
  bidLockStamp: {
    color: COLORS.gold,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 4,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: 5,
    overflow: 'hidden',
  },
  bidLockTitle: {
    color: COLORS.goldLight,
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    textShadowColor: 'rgba(212,175,55,0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
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
