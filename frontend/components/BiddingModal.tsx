import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Modal, Platform, AccessibilityInfo, ScrollView, Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, CardStyle } from '../utils/theme';
import PlayingCard, { CardData } from './PlayingCard';

interface BiddingModalProps {
  visible: boolean;
  yourHand: CardData[];
  cardsThisRound: number;
  trumpSuit: string;
  currentRound: number;
  totalRounds: number;
  restrictedBids: number[];
  onPlaceBid: (bid: number) => void;
  cardStyle?: CardStyle;
}

export default function BiddingModal({
  visible, yourHand, cardsThisRound, trumpSuit,
  currentRound, totalRounds, restrictedBids, onPlaceBid,
  cardStyle = 'minimal',
}: BiddingModalProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [selectedBid, setSelectedBid]   = useState(0);
  const [displayedBid, setDisplayedBid] = useState(0);

  const bidOptions   = useMemo(() => Array.from({ length: cardsThisRound + 1 }, (_, i) => i), [cardsThisRound]);
  const isRestricted = (b: number) => restrictedBids.includes(b);

  const trumpSymbol = SUIT_SYMBOLS[trumpSuit] || '';
  const trumpColor  = trumpSuit === 'hearts' || trumpSuit === 'diamonds' ? COLORS.suitRed : '#FFFFFF';
  const cardSize    = yourHand.length > 8 ? 'small' : 'bid';

  // Arrow press scale refs
  const decScaleAnim = useRef(new Animated.Value(1)).current;
  const incScaleAnim = useRef(new Animated.Value(1)).current;

  // Number cross-fade
  const numberFade = useRef(new Animated.Value(1)).current;

  // Dot width anims — one per possible bid option (max cards + 1, so allocate generously)
  const dotWidthAnims = useRef<Animated.Value[]>(
    Array.from({ length: 20 }, () => new Animated.Value(8))
  ).current;

  // Restricted flash opacity
  const restrictedFlash = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  // Reset to first valid bid when modal opens
  useEffect(() => {
    if (!visible) return;
    const first = bidOptions.find(b => !isRestricted(b)) ?? 0;
    setSelectedBid(first);
    setDisplayedBid(first);
    // Reset all dot widths
    bidOptions.forEach((b, i) => {
      dotWidthAnims[i]?.setValue(b === first ? 22 : 8);
    });
  }, [visible, bidOptions]);

  // Animate dot widths when selectedBid changes
  useEffect(() => {
    if (reduceMotion) {
      bidOptions.forEach((b, i) => dotWidthAnims[i]?.setValue(b === selectedBid ? 22 : 8));
      return;
    }
    bidOptions.forEach((b, i) => {
      Animated.spring(dotWidthAnims[i], {
        toValue: b === selectedBid ? 22 : 8,
        friction: 7,
        tension: 120,
        useNativeDriver: false,
      }).start();
    });
  }, [selectedBid, reduceMotion]);

  const haptic = async (kind: 'selection' | 'medium') => {
    try {
      kind === 'selection'
        ? await Haptics.selectionAsync()
        : await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { /* ignore */ }
  };

  const animatePressIn = (anim: Animated.Value) => {
    Animated.spring(anim, { toValue: 0.88, friction: 4, tension: 300, useNativeDriver: true }).start();
  };
  const animatePressOut = (anim: Animated.Value) => {
    Animated.spring(anim, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start();
  };

  const changeBid = async (delta: number) => {
    let next = selectedBid + delta;
    while (next >= 0 && next <= cardsThisRound && isRestricted(next)) next += delta;
    if (next >= 0 && next <= cardsThisRound && !isRestricted(next)) {
      if (!reduceMotion) {
        // Fade out → update → fade in
        Animated.timing(numberFade, { toValue: 0, duration: 70, useNativeDriver: true }).start(() => {
          setDisplayedBid(next);
          Animated.timing(numberFade, { toValue: 1, duration: 100, useNativeDriver: true }).start();
        });
      } else {
        setDisplayedBid(next);
      }
      setSelectedBid(next);
      await haptic('selection');
    } else {
      // Flash restricted dots
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(restrictedFlash, { toValue: 0.25, duration: 100, useNativeDriver: true }),
          Animated.timing(restrictedFlash, { toValue: 1,    duration: 200, useNativeDriver: true }),
        ]).start();
      }
    }
  };

  const handleDot = async (b: number) => {
    if (isRestricted(b)) {
      if (!reduceMotion) {
        Animated.sequence([
          Animated.timing(restrictedFlash, { toValue: 0.25, duration: 100, useNativeDriver: true }),
          Animated.timing(restrictedFlash, { toValue: 1,    duration: 200, useNativeDriver: true }),
        ]).start();
      }
      return;
    }
    if (!reduceMotion) {
      Animated.timing(numberFade, { toValue: 0, duration: 70, useNativeDriver: true }).start(() => {
        setDisplayedBid(b);
        Animated.timing(numberFade, { toValue: 1, duration: 100, useNativeDriver: true }).start();
      });
    } else {
      setDisplayedBid(b);
    }
    setSelectedBid(b);
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
        <View style={styles.backdrop} />
        <View style={styles.sheet}>

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
          <Text style={styles.kicker}>Bidding Round</Text>
          <Text style={styles.title}>How many tricks will you win?</Text>
          <View style={styles.chips}>
            <MetaChip label={`Round ${currentRound}/${totalRounds}`} />
            <MetaChip label={`${cardsThisRound} cards`} />
            <MetaChip label={`${trumpSymbol} ${trumpSuit}`} color={trumpColor} />
          </View>

          {/* ── Giant number picker ──────────────────────── */}
          <View style={styles.pickerRow}>
            <Animated.View style={{ transform: [{ scale: decScaleAnim }] }}>
              <TouchableOpacity
                testID="bid-decrease"
                style={styles.arrowBtn}
                onPress={() => changeBid(-1)}
                onPressIn={() => animatePressIn(decScaleAnim)}
                onPressOut={() => animatePressOut(decScaleAnim)}
                activeOpacity={1}
              >
                <Text style={styles.arrowText}>−</Text>
              </TouchableOpacity>
            </Animated.View>

            <View style={styles.numberWrap}>
              <Animated.Text style={[styles.bigNumber, { opacity: numberFade }]}>
                {displayedBid}
              </Animated.Text>
              <Text style={styles.outOf}>out of {cardsThisRound}</Text>
            </View>

            <Animated.View style={{ transform: [{ scale: incScaleAnim }] }}>
              <TouchableOpacity
                testID="bid-increase"
                style={styles.arrowBtn}
                onPress={() => changeBid(1)}
                onPressIn={() => animatePressIn(incScaleAnim)}
                onPressOut={() => animatePressOut(incScaleAnim)}
                activeOpacity={1}
              >
                <Text style={styles.arrowText}>+</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* ── Dot indicators ───────────────────────────── */}
          <View style={styles.dotsRow}>
            {bidOptions.map((b, i) => (
              <TouchableOpacity
                key={b}
                testID={`bid-dot-${b}`}
                onPress={() => handleDot(b)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Animated.View style={[
                  styles.dot,
                  { width: dotWidthAnims[i] ?? 8 },
                  b === selectedBid ? styles.dotActive
                    : isRestricted(b)
                      ? [styles.dotRestricted, { opacity: restrictedFlash }]
                      : styles.dotInactive,
                ]} />
              </TouchableOpacity>
            ))}
          </View>

          {/* ── Confirm ──────────────────────────────────── */}
          <TouchableOpacity
            testID="confirm-bid-button"
            style={styles.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.88}
          >
            <Text style={styles.confirmTxt}>Lock in {selectedBid} →</Text>
          </TouchableOpacity>

        </View>
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
  kicker: {
    color: COLORS.gold, fontSize: 10, fontWeight: '800',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4,
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
  confirmTxt: { color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 0.5 },
});
