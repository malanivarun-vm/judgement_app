import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS } from '../utils/theme';
import { VARIATIONS } from '../utils/variations';
import ModeCard from '../components/ModeCard';

export default function GameModesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>GAME MODES</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          The host picks a mode before the game. Tap any mode to learn what makes it different.
        </Text>
        {VARIATIONS.map((v) => (
          <ModeCard
            key={v.key}
            modeKey={v.key}
            name={v.name}
            desc={v.desc}
            isDefault={v.key === 'v1'}
            onPress={() => router.push(`/game-modes/${v.key}` as any)}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  back: { color: COLORS.textSecondary, fontSize: 14 },
  title: { color: COLORS.goldLight, fontSize: 13, fontWeight: '800', letterSpacing: 2 },
  headerSpacer: { width: 40 },
  scroll: { padding: 20 },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 20,
  },
});
