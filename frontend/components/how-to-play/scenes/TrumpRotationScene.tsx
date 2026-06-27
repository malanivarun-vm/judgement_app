import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SUIT_SYMBOLS } from '../../../utils/theme';

const ROTATION = [
  { sym: SUIT_SYMBOLS.hearts,   color: COLORS.suitRed,  label: 'Game 1', active: false },
  { sym: SUIT_SYMBOLS.spades,   color: COLORS.text,     label: 'Game 2', active: true  },
  { sym: SUIT_SYMBOLS.diamonds, color: COLORS.suitRed,  label: 'Game 3', active: false },
  { sym: SUIT_SYMBOLS.clubs,    color: COLORS.text,     label: 'Game 4', active: false },
];

export default function TrumpRotationScene() {
  return (
    <View style={styles.row}>
      {ROTATION.map((item, i) => (
        <React.Fragment key={i}>
          <View style={[styles.badge, item.active && styles.badgeActive]}>
            <Text style={[styles.sym, { color: item.color }, !item.active && styles.dimmed]}>
              {item.sym}
            </Text>
            <Text style={[styles.label, item.active && styles.labelActive]}>{item.label}</Text>
          </View>
          {i < ROTATION.length - 1 && (
            <Text style={styles.arrow}>→</Text>
          )}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  badgeActive: {
    backgroundColor: 'rgba(212,175,55,0.15)',
    borderColor: 'rgba(212,175,55,0.4)',
  },
  sym: { fontSize: 32 },
  dimmed: { opacity: 0.35 },
  label: { color: COLORS.textSecondary, fontSize: 10, marginTop: 4 },
  labelActive: { color: COLORS.gold, fontWeight: '700' },
  arrow: { color: COLORS.textSecondary, fontSize: 14 },
});
