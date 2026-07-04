// Compact seat chip pinned to the oval table edge for one opponent.

import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { COLORS } from '../utils/theme';
import { bidStatus, BID_STATUS_COLORS, BID_STATUS_LABELS, scoreColor } from '../utils/bidStatus';
import AnimatedScore from './AnimatedScore';

export interface SeatPlayer {
  id: string;
  name: string;
  avatar?: string;
  bid: number | null;
  has_bid: boolean;
  tricks_won: number;
  total_score: number;
  card_count: number;
  is_connected: boolean;
  streak?: number;
  is_bot?: boolean;
  bot_personality?: string | null;
}

interface Props {
  player: SeatPlayer;
  isTurn: boolean;
  isDealer: boolean;
  phase: string;
  style?: ViewStyle;
}

export default function OpponentSeat({ player, isTurn, isDealer, phase, style }: Props) {
  const focus = useRef(new Animated.Value(isTurn ? 1 : 0)).current;
  const reactionPop = useRef(new Animated.Value(0)).current;
  const previousTricks = useRef(player.tricks_won);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reaction, setReaction] = useState('');
  const hasBid = player.has_bid || player.bid !== null;
  const st = hasBid ? bidStatus(player.bid, player.tricks_won) : 'pending';
  const statusLabel = BID_STATUS_LABELS[st];

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      focus.setValue(isTurn ? 1 : 0);
      return;
    }
    Animated.spring(focus, {
      toValue: isTurn ? 1 : 0,
      speed: 16,
      bounciness: isTurn ? 8 : 2,
      useNativeDriver: true,
    }).start();
  }, [focus, isTurn, reduceMotion]);

  useEffect(() => {
    let nextReaction = '';
    if (player.tricks_won > previousTricks.current) nextReaction = '✦';
    if (st === 'secured' && player.tricks_won > previousTricks.current) nextReaction = '🎯';
    if (st === 'busted') nextReaction = '💥';
    previousTricks.current = player.tricks_won;
    if (!nextReaction) return;

    setReaction(nextReaction);
    reactionPop.setValue(reduceMotion ? 1 : 0);
    Animated.spring(reactionPop, {
      toValue: 1,
      speed: 18,
      bounciness: 12,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => setReaction(''), 1200);
    return () => clearTimeout(timer);
  }, [player.tricks_won, reactionPop, reduceMotion, st]);

  return (
    <Animated.View
      testID={`opponent-${player.id}`}
      style={[
        styles.seat,
        isTurn && styles.seatActive,
        !player.is_connected && styles.seatOffline,
        style,
        {
          transform: [
            { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) },
            { scale: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] }) },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={[styles.avatar, isTurn && styles.avatarActive]}>
          <Text style={styles.avatarText}>
            {player.avatar || (player.is_bot ? '♟' : player.name[0]?.toUpperCase())}
          </Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
        {(player.streak ?? 0) >= 2 && (
          <Text style={styles.streakBadge}>🔥{player.streak}</Text>
        )}
        {isDealer && <Text style={styles.dealerBadge}>D</Text>}
      </View>
      <View style={styles.bottomRow}>
        {hasBid ? (
          <Text style={[styles.bidLine, { color: BID_STATUS_COLORS[st] }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {`${player.bid}/${player.tricks_won}${statusLabel ? ` ${statusLabel}` : ''}`}
          </Text>
        ) : (
          <Text style={styles.bidLine} numberOfLines={1}>
            {phase === 'bidding' ? 'bidding…' : `${player.card_count} cards`}
          </Text>
        )}
        <AnimatedScore
          value={player.total_score}
          style={[styles.score, { color: scoreColor(player.total_score) }]}
        />
      </View>
      {!player.is_connected && <Text style={styles.offline}>Offline</Text>}
      {reaction ? (
        <Animated.Text
          pointerEvents="none"
          style={[
            styles.reaction,
            {
              opacity: reactionPop,
              transform: [
                { translateY: reactionPop.interpolate({ inputRange: [0, 1], outputRange: [8, -22] }) },
                { scale: reactionPop.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.4, 1.35, 1] }) },
              ],
            },
          ]}
        >
          {reaction}
        </Animated.Text>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  seat: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(8, 24, 17, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 3,
    gap: 3,
  },
  seatActive: {
    borderColor: COLORS.gold,
    borderWidth: 2,
    backgroundColor: 'rgba(243,229,171,0.1)',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  seatOffline: {
    opacity: 0.75,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarActive: {
    backgroundColor: COLORS.gold,
  },
  avatarText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: '900',
  },
  name: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
  },
  dealerBadge: {
    color: COLORS.gold,
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(212,175,55,0.2)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  streakBadge: {
    color: '#FF9F43',
    fontSize: 9,
    fontWeight: '800',
    backgroundColor: 'rgba(255,159,67,0.15)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    overflow: 'hidden',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  bidLine: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 1,
  },
  score: {
    fontSize: 11,
    fontWeight: '800',
  },
  offline: {
    color: COLORS.danger,
    fontSize: 9,
    fontWeight: '700',
  },
  reaction: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    fontSize: 23,
    textShadowColor: 'rgba(212,175,55,0.8)',
    textShadowRadius: 12,
  },
});
