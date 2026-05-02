import React from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
} from 'react-native';
import { COLORS } from '../utils/theme';

const SCORE_ROWS = [
  { label: 'Exact bid',            value: '+bid × 10 pts', positive: true },
  { label: 'Miss bid',             value: '−bid × 10 pts', positive: false },
  { label: 'Zero bid, 0 tricks',   value: '+25 pts',       positive: true },
  { label: 'Zero bid, any tricks', value: '−25 pts',       positive: false },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ visible, onClose }: Props) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HOW TO PLAY</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
        >
          <Section label="🃏 The Game">
            {'Bid exactly how many tricks you\'ll win each round. Hit your bid and you score — miss it and you lose points. 3–7 players.'}
          </Section>

          <Section label="🎴 Playing Tricks">
            {'Lead any card. Others '}
            <Text style={styles.bold}>must follow suit</Text>
            {' if they can. If not, play any card. Highest trump wins; otherwise highest card of the lead suit wins.'}
          </Section>

          <Section label="♠ Trump Suits">
            {'Trump rotates each round: '}
            <Text style={styles.red}>♥ Hearts</Text>
            {' → '}
            <Text style={styles.bold}>♠ Spades</Text>
            {' → '}
            <Text style={styles.red}>♦ Diamonds</Text>
            {' → '}
            <Text style={styles.bold}>♣ Clubs</Text>
            {'. Trump beats any non-trump card.'}
          </Section>

          <Section label="🎯 Bidding">
            {'Bid clockwise after the dealer. The dealer bids last and '}
            <Text style={styles.bold}>
              cannot bid a number that makes total bids equal tricks available
            </Text>
            {' — someone must be set up to fail.'}
          </Section>

          <Section label="🔄 Rounds">
            {'Each round, cards dealt = '}
            <Text style={styles.bold}>floor(52 ÷ players)</Text>
            {'. Decreases by 1 each round down to 1 card.'}
          </Section>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>📊 Scoring</Text>
            <View style={styles.scoreTable}>
              {SCORE_ROWS.map((row, i) => (
                <View
                  key={row.label}
                  style={[styles.scoreRow, i < SCORE_ROWS.length - 1 && styles.scoreRowBorder]}
                >
                  <Text style={styles.scoreLabel}>{row.label}</Text>
                  <Text style={[styles.scoreValue, row.positive ? styles.positive : styles.negative]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  headerTitle: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  closeBtn: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  bold: {
    color: COLORS.text,
    fontWeight: '700',
  },
  red: {
    color: COLORS.suitRed,
    fontWeight: '700',
  },
  scoreTable: {
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 10,
    overflow: 'hidden',
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scoreRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  scoreLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  scoreValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  positive: {
    color: COLORS.success,
  },
  negative: {
    color: COLORS.danger,
  },
});
