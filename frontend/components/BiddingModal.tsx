// Redesigned bidding modal with giant number picker + hand grid preview.
// Drop-in replacement — same required props as previous BiddingModal.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, View, Text, TouchableOpacity, StyleSheet,
  Modal, Platform, AccessibilityInfo, ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, CardStyle } from '../utils/theme';
import PlayingCard, { CardData } from './PlayingCard';

interface BiddingModalProps {
  visible: boolean;
  yourHand: CardData[];
  cardsThisRound: number;
  trumpSuit: string | null;
  currentRound: number;
  totalRounds: number;
  restrictedBids: number[];
  onPlaceBid: (bid: number) => void;
  cardStyle?: CardStyle;
  /** Seconds left on the server move timer; turns red ≤3s. */
  secondsLeft?: number | null;
  submitting?: boolean;
}

export default function BiddingModal({
  visible, yourHand, cardsThisRound, trumpSuit,
  currentRound, totalRounds, restrictedBids, onPlaceBid,
  cardStyle = 'minimal', secondsLeft = null,
  submitting = false,
}: BiddingModalProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedBid, setSelectedBid]   = useState(0);
  const entrance = useRef(new Animated.Value(0)).current;
  const bidPop = useRef(new Animated.Value(1)).current;

  const bidOptions   = useMemo(() => Array.from({ length: cardsThisRound + 1 }, (_, i) => i), [cardsThisRound]);
  const restrictedSet = useMemo(() => new Set(restrictedBids), [restrictedBids]);
  const isRestricted = (b: number) => restrictedSet.has(b);

  const trumpSymbol = trumpSuit ? SUIT_SYMBOLS[trumpSuit] || '' : '';
  const trumpColor  = trumpSuit === 'hearts' || trumpSuit === 'diamonds' ? COLORS.suitRed : '#FFFFFF';

  const cardSize = yourHand.length > 8 ? 'small' : 'bid';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;
    const first = bidOptions.find(b => !restrictedSet.has(b)) ?? 0;
    setSelectedBid(first);
    if (reduceMotion) {
      entrance.setValue(1);
      return;
    }
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      speed: 15,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  }, [visible, bidOptions, entrance, reduceMotion, restrictedSet]);

  const animateBid = () => {
    if (reduceMotion) return;
    bidPop.setValue(0.78);
    Animated.spring(bidPop, {
      toValue: 1,
      speed: 24,
      bounciness: 10,
      useNativeDriver: true,
    }).start();
  };

  const haptic = async (kind: 'selection' | 'medium') => {
    try {
      if (kind === 'selection') {
        await Haptics.selectionAsync();
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch { /* ignore */ }
  };

  const change = async (delta: number) => {
    let next = selectedBid + delta;
    while (next >= 0 && next <= cardsThisRound && isRestricted(next)) next += delta;
    if (next >= 0 && next <= cardsThisRound && !isRestricted(next)) {
      setSelectedBid(next);
      animateBid();
      await haptic('selection');
    }
  };

  const handleDot = async (b: number) => {
    if (isRestricted(b)) return;
    setSelectedBid(b);
    animateBid();
    await haptic('selection');
  };

  const handleConfirm = async () => {
    await haptic('medium');
    onPlaceBid(selectedBid);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reduceMotion ? 'none' : 'fade'}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
            },
          ]}
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              opacity: entrance,
              transform: [
                { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [56, 0] }) },
                { scale: entrance.interpolate({ inputRange: [0, 0.75, 1], outputRange: [0.92, 1.018, 1] }) },
              ],
            },
          ]}
        >

          {/* ── Hand preview ─────────────────────────────── */}
          <Text style={styles.sectionLabel}>
            Your hand · {yourHand.length} cards
          </Text>
          <ScrollView
            style={styles.handScroll}
            contentContainerStyle={styles.handGrid}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {yourHand.map((c, i) => (
              <PlayingCard
                key={`${c.rank}-${c.suit}-${i}`}
                card={c} size={cardSize} cardStyle={cardStyle} disabled
              />
            ))}
          </ScrollView>

          <View style={styles.divider} />

          {/* ── Context chips ────────────────────────────── */}
          <View style={styles.kickerRow}>
            <Text style={styles.kicker}>Bidding Round</Text>
            {typeof secondsLeft === 'number' && (
              <View style={[styles.timerChip, secondsLeft <= 3 && styles.timerChipDanger]}>
                <Text style={[styles.timerChipText, secondsLeft <= 3 && styles.timerChipTextDanger]}>
                  ⏱ {secondsLeft}s
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>How many sets will you win?</Text>
          <View style={styles.chips}>
            <MetaChip label={`Round ${currentRound}/${totalRounds}`} />
            <MetaChip label={`${cardsThisRound} cards`} />
            <MetaChip
              label={trumpSuit ? `Trump ${trumpSymbol} ${trumpSuit}` : 'Trump chosen after bids'}
              color={trumpSuit ? trumpColor : COLORS.textSecondary}
            />
          </View>

          {/* ── Giant number picker ──────────────────────── */}
          <View style={styles.pickerRow}>
            <TouchableOpacity
              testID="bid-decrease"
              style={styles.arrowBtn}
              onPress={() => change(-1)}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowText}>−</Text>
            </TouchableOpacity>

            <View style={styles.numberWrap}>
              <Animated.Text style={[styles.bigNumber, { transform: [{ scale: bidPop }] }]}>
                {selectedBid}
              </Animated.Text>
              <Text style={styles.outOf}>out of {cardsThisRound}</Text>
            </View>

            <TouchableOpacity
              testID="bid-increase"
              style={styles.arrowBtn}
              onPress={() => change(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* ── Dot indicators ───────────────────────────── */}
          <View style={styles.dotsRow}>
            {bidOptions.map(b => (
              <TouchableOpacity
                key={b}
                testID={`bid-dot-${b}`}
                onPress={() => handleDot(b)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <View style={[
                  styles.dot,
                  { width: b === selectedBid ? 22 : 8 },
                  b === selectedBid ? styles.dotActive
                    : isRestricted(b) ? styles.dotRestricted
                    : styles.dotInactive,
                ]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Confirm ──────────────────────────────────── */}
          <TouchableOpacity
            testID="confirm-bid-button"
            style={[styles.confirmBtn, submitting && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={submitting}
              activeOpacity={0.88}
            >
            <Text style={styles.confirmTxt}>
              {submitting ? 'Locking bid…' : `Lock in ${selectedBid} →`}
            </Text>
          </TouchableOpacity>

        </Animated.View>
      </View>
    </Modal>
  );
}

function MetaChip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.chip}>
      <Text style={[styles.chipText, color ? { color } : undefined]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2,8,5,0.90)',
  },
  sheet: {
    width: '100%', maxWidth: 380,
    backgroundColor: '#0C2218',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.28)',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 26,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 18,
  },

  // Hand section
  sectionLabel: {
    color: COLORS.textSecondary, fontSize: 10, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 8,
  },
  handScroll: { maxHeight: 180 },
  handGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 5, justifyContent: 'center', paddingTop: 4, paddingBottom: 8,
  },

  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.07)', marginVertical: 16 },

  // Header
  kickerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 4,
  },
  kicker: {
    color: COLORS.gold, fontSize: 10, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase',
  },
  timerChip: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
    backgroundColor: 'rgba(212,175,55,0.12)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
  },
  timerChipDanger: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: COLORS.danger,
  },
  timerChipText: {
    color: COLORS.goldLight, fontSize: 12, fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  timerChipTextDanger: {
    color: '#FF6B6B',
  },
  title: {
    color: COLORS.goldLight, fontSize: 19, fontWeight: '900',
    marginBottom: 12,
  },

  // Chips
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  chipText: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '700' },

  // Number picker
  pickerRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 20, marginBottom: 18,
  },
  arrowBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  arrowText: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 32 },
  numberWrap: { alignItems: 'center', minWidth: 110 },
  bigNumber: {
    color: COLORS.gold, fontSize: 84, fontWeight: '900',
    lineHeight: 88,
  },
  outOf: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },

  // Dots
  dotsRow: {
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', gap: 5, marginBottom: 22,
  },
  dot: { height: 8, borderRadius: 4 },
  dotActive:     { backgroundColor: COLORS.gold },
  dotInactive:   { backgroundColor: 'rgba(255,255,255,0.22)' },
  dotRestricted: { backgroundColor: 'rgba(239,68,68,0.45)' },

  // Confirm
  confirmBtn: {
    backgroundColor: COLORS.gold,
    paddingVertical: 15, borderRadius: 999,
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.45, shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  confirmBtnDisabled: {
    opacity: 0.62,
  },
  confirmTxt: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
