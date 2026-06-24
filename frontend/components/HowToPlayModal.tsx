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
  AccessibilityInfo,
} from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';
import { SCORE_ROWS } from '../utils/variations';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ visible, onClose }: Props) {
  const [reduceMotion, setReduceMotion] = React.useState(false);

  React.useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  return (
    <Modal
      visible={visible}
      transparent={Platform.OS !== 'ios'}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.shell}>
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>HOW TO PLAY</Text>
              <Text style={styles.headerSubtitle}>The fast version, then the full flow.</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.closeButton}
            >
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <Text style={styles.heroKicker}>Judgement / Oh Hell</Text>
              <Text style={styles.heroTitle}>Bid the exact number of tricks you will take.</Text>
              <Text style={styles.heroBody}>
                Every round is a prediction game. Exact bids score. Misses punish. The dealer has one
                forbidden bid that keeps the round honest.
              </Text>
            </View>

            <Section label="🃏 The Game">
              {'3–7 players. Each round you get a hand, predict tricks, and play cards in turn. The app handles the rules for you.'}
            </Section>

            <Section label="🎴 Playing Tricks">
              {'Lead any card. Others '}
              <Text style={styles.bold}>must follow suit</Text>
              {' if they can. If not, play any card. Highest trump wins; otherwise highest card of the lead suit wins.'}
            </Section>

            <Section label={`${SUIT_SYMBOLS.spades} Trump Suits`}>
              {'Trump rotates each round: '}
              <Text style={styles.red}>{SUIT_SYMBOLS.hearts} Hearts</Text>
              {' → '}
              <Text style={styles.bold}>{SUIT_SYMBOLS.spades} Spades</Text>
              {' → '}
              <Text style={styles.red}>{SUIT_SYMBOLS.diamonds} Diamonds</Text>
              {' → '}
              <Text style={styles.bold}>{SUIT_SYMBOLS.clubs} Clubs</Text>
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
        </View>
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
  shell: {
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
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  headerTitle: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  headerSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
  },
  closeBtn: {
    color: COLORS.textSecondary,
    fontSize: 18,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    padding: 18,
    marginBottom: 18,
  },
  heroKicker: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  heroBody: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
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
