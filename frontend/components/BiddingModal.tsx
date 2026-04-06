import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';

interface BiddingModalProps {
  visible: boolean;
  cardsThisRound: number;
  trumpSuit: string;
  currentRound: number;
  totalRounds: number;
  restrictedBids: number[];
  onPlaceBid: (bid: number) => void;
}

export default function BiddingModal({
  visible,
  cardsThisRound,
  trumpSuit,
  currentRound,
  totalRounds,
  restrictedBids,
  onPlaceBid,
}: BiddingModalProps) {
  const [selectedBid, setSelectedBid] = useState(0);

  const bidOptions = Array.from({ length: cardsThisRound + 1 }, (_, i) => i);
  const isRestricted = (bid: number) => restrictedBids.includes(bid);
  const trumpSymbol = SUIT_SYMBOLS[trumpSuit] || '';
  const trumpColor = trumpSuit === 'hearts' || trumpSuit === 'diamonds' ? COLORS.suitRed : '#FFFFFF';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Place Your Bid</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              Round {currentRound}/{totalRounds}
            </Text>
            <View style={styles.trumpBadge}>
              <Text style={[styles.trumpText, { color: trumpColor }]}>
                {trumpSymbol} {trumpSuit}
              </Text>
            </View>
          </View>
          <Text style={styles.cardsText}>{cardsThisRound} cards dealt</Text>

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
                  onPress={() => !restricted && setSelectedBid(bid)}
                  disabled={restricted}
                  activeOpacity={0.7}
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

          {restrictedBids.length > 0 && (
            <Text style={styles.restrictionNote}>
              Cannot bid {restrictedBids.join(', ')} (dealer rule)
            </Text>
          )}

          <TouchableOpacity
            testID="confirm-bid-button"
            style={styles.confirmButton}
            onPress={() => onPlaceBid(selectedBid)}
            activeOpacity={0.8}
          >
            <Text style={styles.confirmText}>Confirm Bid: {selectedBid}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  infoText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  trumpBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  trumpText: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  cardsText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 20,
  },
  bidGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16,
  },
  bidButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bidButtonSelected: {
    backgroundColor: COLORS.gold,
    borderColor: COLORS.gold,
  },
  bidButtonRestricted: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderColor: 'rgba(239,68,68,0.3)',
  },
  bidButtonText: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  bidButtonTextSelected: {
    color: '#000',
  },
  bidButtonTextRestricted: {
    color: 'rgba(239,68,68,0.5)',
  },
  restrictionNote: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  confirmText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
  },
});
