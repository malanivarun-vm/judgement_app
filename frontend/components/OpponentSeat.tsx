// Compact seat chip pinned to the oval table edge for one opponent.

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS } from '../utils/theme';
import { bidStatus, BID_STATUS_COLORS, BID_STATUS_LABELS, scoreColor } from '../utils/bidStatus';

export interface SeatPlayer {
  id: string;
  name: string;
  bid: number | null;
  has_bid: boolean;
  tricks_won: number;
  total_score: number;
  card_count: number;
  is_connected: boolean;
}

interface Props {
  player: SeatPlayer;
  isTurn: boolean;
  isDealer: boolean;
  phase: string;
  style?: ViewStyle;
}

export default function OpponentSeat({ player, isTurn, isDealer, phase, style }: Props) {
  const hasBid = player.has_bid || player.bid !== null;
  const st = hasBid ? bidStatus(player.bid, player.tricks_won) : 'pending';
  const statusLabel = BID_STATUS_LABELS[st];

  return (
    <View
      testID={`opponent-${player.id}`}
      style={[styles.seat, isTurn && styles.seatActive, !player.is_connected && styles.seatOffline, style]}
    >
      <View style={styles.topRow}>
        <View style={[styles.avatar, isTurn && styles.avatarActive]}>
          <Text style={styles.avatarText}>{player.name[0]?.toUpperCase()}</Text>
        </View>
        <Text style={styles.name} numberOfLines={1}>{player.name}</Text>
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
        <Text style={[styles.score, { color: scoreColor(player.total_score) }]} numberOfLines={1}>
          {player.total_score}
        </Text>
      </View>
      {!player.is_connected && <Text style={styles.offline}>Offline</Text>}
    </View>
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
});
