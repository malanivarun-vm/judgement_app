import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';
import AnimatedScore from './AnimatedScore';

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
  players: { id: string; name: string; total_score: number }[];
  currentRound?: number;
}

export default function ScoreBoard({ roundHistory, players, currentRound }: ScoreBoardProps) {
  if (!roundHistory || roundHistory.length === 0) {
    return null;
  }

  const lastRound = roundHistory[roundHistory.length - 1];
  const sortedPlayers = [...players].sort((a, b) => b.total_score - a.total_score);
  const leader = sortedPlayers[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>
            {currentRound ? `Game ${currentRound} recap` : `Game ${lastRound.round} recap`}
          </Text>
          <Text style={styles.title}>Scoreboard</Text>
        </View>
        <View style={styles.headerMeta}>
          <MetaChip label={`${SUIT_SYMBOLS[lastRound.trump]} ${lastRound.trump}`} />
          <MetaChip label={`${lastRound.cards} cards`} />
        </View>
      </View>

      <View style={styles.summaryRow}>
        <SummaryChip label="Leader" value={`${leader?.name || '—'} ${leader ? `• ${leader.total_score}` : ''}`} />
        <SummaryChip label="Perfect predictions" value={String(countPerfectBids(lastRound, players))} />
      </View>

      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, styles.nameCol]}>Player</Text>
          <Text style={styles.headerCell} numberOfLines={1} adjustsFontSizeToFit>Predict</Text>
          <Text style={styles.headerCell}>Won</Text>
          <Text style={styles.headerCell}>Pts</Text>
          <Text style={[styles.headerCell, styles.totalCol]}>Total</Text>
        </View>
        {players.map((p, index) => {
          const roundData = lastRound.scores[p.id];
          if (!roundData) return null;
          const success = roundData.bid === roundData.tricks_won;
          return (
            <View
              key={p.id}
              style={[
                styles.row,
                index % 2 === 0 && styles.rowAlt,
                success && styles.rowSuccess,
                p.id === leader?.id && styles.rowFirst,
              ]}
            >
              <Text style={[styles.cell, styles.nameCol]} numberOfLines={1}>
                {roundData.name}
              </Text>
              <Text style={styles.cell}>{roundData.bid}</Text>
              <Text style={styles.cell}>{roundData.tricks_won}</Text>
              <AnimatedScore
                value={roundData.round_score}
                signed
                style={[
                  styles.cell,
                  styles.scoreCell,
                  { color: success ? COLORS.success : COLORS.danger },
                ]}
              />
              <AnimatedScore
                value={roundData.total_score}
                style={[styles.cell, styles.totalCol, styles.totalValue]}
              />
            </View>
          );
        })}
      </View>

      {roundHistory.length > 1 && (
        <ScrollView horizontal style={styles.historyScroll} showsHorizontalScrollIndicator={false}>
          <View style={styles.historyWrap}>
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
                    <Text
                      key={rh.round}
                      style={[
                        styles.histCell,
                        { color: success ? COLORS.success : COLORS.danger }
                      ]}
                    >
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

function countPerfectBids(lastRound: RoundHistory, players: { id: string }[]) {
  return players.reduce((count, p) => {
    const data = lastRound.scores[p.id];
    return count + (data && data.bid === data.tricks_won ? 1 : 0);
  }, 0);
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={styles.metaChipText}>{label}</Text>
    </View>
  );
}

function SummaryChip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  kicker: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '900',
  },
  headerMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  metaChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  metaChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  summaryChip: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  summaryLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  table: {
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
    paddingBottom: 10,
    marginBottom: 6,
  },
  headerCell: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    flex: 1,
    textAlign: 'center',
    letterSpacing: 0.8,
  },
  nameCol: {
    flex: 2,
    textAlign: 'left',
  },
  totalCol: {
    flex: 1.15,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  rowAlt: {
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  rowSuccess: {
    backgroundColor: 'rgba(16,185,129,0.08)',
  },
  rowFirst: {
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)',
  },
  cell: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
    textAlign: 'center',
  },
  scoreCell: {
    fontWeight: '800',
  },
  totalValue: {
    fontWeight: '900',
    color: COLORS.goldLight,
  },
  historyScroll: {
    marginTop: 8,
  },
  historyWrap: {
    minWidth: 100,
  },
  histHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
    paddingBottom: 8,
  },
  histRow: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  histCell: {
    color: COLORS.text,
    fontSize: 12,
    width: 40,
    textAlign: 'center',
    fontWeight: '600',
  },
  histNameCol: {
    width: 80,
    textAlign: 'left',
    color: COLORS.textSecondary,
  },
});
