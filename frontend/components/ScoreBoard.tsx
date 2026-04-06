import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';

interface RoundHistory {
  round: number;
  trump: string;
  cards: number;
  scores: Record<string, {
    name: string;
    bid: number;
    tricks_won: number;
    round_score: number;
    total_score: number;
  }>;
}

interface ScoreBoardProps {
  roundHistory: RoundHistory[];
  players: Array<{ id: string; name: string; total_score: number }>;
  currentRound?: number;
}

export default function ScoreBoard({ roundHistory, players, currentRound }: ScoreBoardProps) {
  if (!roundHistory || roundHistory.length === 0) {
    return null;
  }

  const lastRound = roundHistory[roundHistory.length - 1];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>
        Round {lastRound.round} Results
      </Text>
      <View style={styles.trumpRow}>
        <Text style={styles.trumpLabel}>Trump:</Text>
        <Text style={[
          styles.trumpValue,
          { color: lastRound.trump === 'hearts' || lastRound.trump === 'diamonds' ? COLORS.suitRed : '#FFF' }
        ]}>
          {SUIT_SYMBOLS[lastRound.trump]} {lastRound.trump}
        </Text>
      </View>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
          <Text style={styles.headerCell}>Bid</Text>
          <Text style={styles.headerCell}>Won</Text>
          <Text style={styles.headerCell}>Pts</Text>
          <Text style={[styles.headerCell, styles.totalCol]}>Total</Text>
        </View>
        {players.map((p) => {
          const roundData = lastRound.scores[p.id];
          if (!roundData) return null;
          const success = roundData.bid === roundData.tricks_won;
          return (
            <View key={p.id} style={styles.row}>
              <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
                {roundData.name}
              </Text>
              <Text style={styles.cell}>{roundData.bid}</Text>
              <Text style={styles.cell}>{roundData.tricks_won}</Text>
              <Text style={[
                styles.cell,
                { color: success ? COLORS.success : COLORS.danger }
              ]}>
                {roundData.round_score > 0 ? '+' : ''}{roundData.round_score}
              </Text>
              <Text style={[styles.cell, styles.totalCol, { fontWeight: '700' }]}>
                {roundData.total_score}
              </Text>
            </View>
          );
        })}
      </View>

      {roundHistory.length > 1 && (
        <ScrollView horizontal style={styles.historyScroll} showsHorizontalScrollIndicator={false}>
          <View>
            <View style={styles.histHeaderRow}>
              <Text style={[styles.histCell, styles.histNameCol]}>Player</Text>
              {roundHistory.map((rh) => (
                <Text key={rh.round} style={styles.histCell}>
                  R{rh.round}
                </Text>
              ))}
            </View>
            {players.map((p) => (
              <View key={p.id} style={styles.histRow}>
                <Text style={[styles.histCell, styles.histNameCol]} numberOfLines={1}>
                  {p.name}
                </Text>
                {roundHistory.map((rh) => {
                  const data = rh.scores[p.id];
                  const success = data && data.bid === data.tricks_won;
                  return (
                    <Text key={rh.round} style={[
                      styles.histCell,
                      { color: success ? COLORS.success : COLORS.danger }
                    ]}>
                      {data ? data.round_score : '-'}
                    </Text>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 16,
    width: '100%',
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  trumpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  trumpLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  trumpValue: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  table: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
    paddingBottom: 8,
    marginBottom: 4,
  },
  headerCell: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
  },
  nameCol: {
    flex: 2,
    textAlign: 'left',
  },
  totalCol: {
    flex: 1.2,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  cell: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  historyScroll: {
    marginTop: 8,
  },
  histHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
    paddingBottom: 6,
  },
  histRow: {
    flexDirection: 'row',
    paddingVertical: 4,
  },
  histCell: {
    color: COLORS.text,
    fontSize: 12,
    width: 40,
    textAlign: 'center',
  },
  histNameCol: {
    width: 70,
    textAlign: 'left',
    color: COLORS.textSecondary,
  },
});
