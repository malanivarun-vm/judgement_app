import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  AccessibilityInfo,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';
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
}

export default function BiddingModal({
  visible,
  yourHand,
  cardsThisRound,
  trumpSuit,
  currentRound,
  totalRounds,
  restrictedBids,
  onPlaceBid,
}: BiddingModalProps) {
  const bidOptions = useMemo(
    () => Array.from({ length: cardsThisRound + 1 }, (_, i) => i),
    [cardsThisRound]
  );
  const [selectedBid, setSelectedBid] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const firstAllowed = bidOptions.find((bid) => !restrictedBids.includes(bid));
    setSelectedBid(firstAllowed ?? 0);
  }, [visible, bidOptions, restrictedBids]);

  const isRestricted = (bid: number) => restrictedBids.includes(bid);
  const trumpSymbol = SUIT_SYMBOLS[trumpSuit] || '';
  const trumpColor = trumpSuit === 'hearts' || trumpSuit === 'diamonds' ? COLORS.suitRed : '#FFFFFF';

  const handleSelect = async (bid: number) => {
    if (isRestricted(bid)) return;
    setSelectedBid(bid);
    try {
      await Haptics.selectionAsync();
    } catch {
      // ignore haptic failures on unsupported platforms
    }
  };

  const handleConfirm = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // ignore haptic failures on unsupported platforms
    }
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
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.kicker}>Bidding Round</Text>
            <Text style={styles.title}>Choose your exact number</Text>
            <Text style={styles.subtitle}>
              Hit the bid exactly to score. Miss it and the round pushes back.
            </Text>
          </View>

          <View style={styles.metaRow}>
            <MetaChip label={`Round ${currentRound}/${totalRounds}`} />
            <MetaChip label={`${cardsThisRound} cards`} />
            <MetaChip label={`${trumpSymbol} ${trumpSuit}`} color={trumpColor} />
          </View>

          <View style={styles.selectedPanel}>
            <Text style={styles.selectedLabel}>Selected bid</Text>
            <Text style={styles.selectedValue}>{selectedBid}</Text>
            <Text style={styles.selectedHint}>
              {isRestricted(selectedBid)
                ? 'This bid is restricted. Pick another.'
                : restrictedBids.length > 0
                  ? `Dealer rule blocks: ${restrictedBids.join(', ')}`
                  : 'Tap a number to lock it in.'}
            </Text>
          </View>

          <View style={styles.bidGrid}>
            {bidOptions.map((bid) => {
              const restricted = isRestricted(bid);
              const selected = selectedBid === bid && !restricted;
              return (
                <TouchableOpacity
                  key={bid}
                  testID={`bid-button-${bid}`}
                  style={[
                    styles.bidButton,
                    selected && styles.bidButtonSelected,
                    restricted && styles.bidButtonRestricted,
                  ]}
                  onPress={() => void handleSelect(bid)}
                  disabled={restricted}
                  activeOpacity={0.85}
                >
                  <Text
                    style={[
                      styles.bidButtonText,
                      selected && styles.bidButtonTextSelected,
                      restricted && styles.bidButtonTextRestricted,
                    ]}
                  >
                    {bid}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            testID="confirm-bid-button"
            style={styles.confirmButton}
            onPress={() => void handleConfirm()}
            activeOpacity={0.9}
          >
            <Text style={styles.confirmText}>Lock in {selectedBid}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function MetaChip({ label, color }: { label: string; color?: string }) {
  return (
    <View style={styles.metaChip}>
      <Text style={[styles.metaChipText, color ? { color } : undefined]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,10,7,0.78)',
  },
  modal: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 14,
  },
  header: {
    marginBottom: 16,
  },
  kicker: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
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
  selectedPanel: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    marginBottom: 14,
  },
  selectedLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  selectedValue: {
    color: COLORS.goldLight,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  selectedHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 6,
    minHeight: 16,
  },
  bidGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bidButton: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidButtonSelected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  bidButtonRestricted: {
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  bidButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  bidButtonTextSelected: {
    color: '#000',
  },
  bidButtonTextRestricted: {
    color: 'rgba(239,68,68,0.65)',
  },
  confirmButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 15,
    borderRadius: 28,
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  confirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
});
