import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../utils/theme';

interface Props {
  name: string;
  desc: string;
  modeKey: string;
  isDefault?: boolean;
  onPress: () => void;
}

export default function ModeCard({ name, desc, isDefault, onPress }: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, isDefault && styles.cardDefault]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <View style={styles.row}>
        <View style={styles.textBlock}>
          <Text style={[styles.name, isDefault && styles.nameDefault]}>{name}</Text>
          <Text style={styles.desc}>{desc}</Text>
        </View>
        {isDefault && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>DEFAULT</Text>
          </View>
        )}
        <Text style={styles.arrow}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 16,
    marginBottom: 10,
  },
  cardDefault: { borderColor: COLORS.borderAccent },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textBlock: { flex: 1 },
  name: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  nameDefault: { color: COLORS.goldLight },
  desc: { color: COLORS.textSecondary, fontSize: 13 },
  badge: {
    backgroundColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: { color: COLORS.gold, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  arrow: { color: COLORS.gold, fontSize: 16 },
});
