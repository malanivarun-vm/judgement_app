import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';
import HowToPlayModal from '../components/HowToPlayModal';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

function generateId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function HomeScreen() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [howToPlayVisible, setHowToPlayVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 6500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, reduceMotion]);

  const fireHaptic = async (kind: 'selection' | 'medium') => {
    try {
      if (kind === 'selection') {
        await Haptics.selectionAsync();
      } else {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {
      // ignore unsupported platforms
    }
  };

  const createRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert('Enter Name', 'Please enter your player name');
      return;
    }
    setLoading(true);
    try {
      void fireHaptic('medium');
      const res = await fetch(`${BACKEND_URL}/api/rooms`, { method: 'POST' });
      const data = await res.json();
      const playerId = generateId();
      router.push({
        pathname: '/game',
        params: {
          room_id: data.room_id,
          player_name: playerName.trim(),
          player_id: playerId,
          is_host: 'true',
        },
      });
    } catch {
      Alert.alert('Error', 'Could not create room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert('Enter Name', 'Please enter your player name');
      return;
    }
    if (!roomCode.trim()) {
      Alert.alert('Enter Code', 'Please enter the room code');
      return;
    }
    setLoading(true);
    try {
      void fireHaptic('selection');
      const code = roomCode.trim().toUpperCase();
      const res = await fetch(`${BACKEND_URL}/api/rooms/${code}/exists`);
      const data = await res.json();
      if (!data.exists) {
        Alert.alert('Not Found', 'Room does not exist');
        return;
      }
      if (!data.joinable) {
        Alert.alert('Cannot Join', 'Room is full or game already started');
        return;
      }
      const playerId = generateId();
      router.push({
        pathname: '/game',
        params: {
          room_id: code,
          player_name: playerName.trim(),
          player_id: playerId,
          is_host: 'false',
        },
      });
    } catch {
      Alert.alert('Error', 'Could not check room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Decorative suit symbols */}
        <Animated.View
          style={[
            styles.decoRow,
            !reduceMotion && {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -6],
                  }),
                },
              ],
              opacity: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.74, 1],
              }),
            },
          ]}
        >
          {Object.values(SUIT_SYMBOLS).map((s, i) => (
            <Text key={i} style={[styles.decoSuit, i % 2 === 0 ? styles.decoRed : styles.decoWhite]}>
              {s}
            </Text>
          ))}
        </Animated.View>

        <Animated.View
          style={[
            styles.heroPanel,
            !reduceMotion && {
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -3],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.kicker}>Live Card Table</Text>
          <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>Judgement</Text>
          <Text style={styles.subtitle}>Bid the exact number of tricks. Win the table. Miss by one and pay for it.</Text>

          <View style={styles.heroChips}>
            <View style={styles.heroChip}><Text style={styles.heroChipText}>Real-time</Text></View>
            <View style={styles.heroChip}><Text style={styles.heroChipText}>3-7 players</Text></View>
            <View style={styles.heroChip}><Text style={styles.heroChipText}>Exact bids</Text></View>
          </View>
        </Animated.View>

        {/* Player Name */}
        <View style={styles.panel}>
          <View style={styles.inputGroup}>
          <Text style={styles.label}>Your Name</Text>
          <TextInput
            testID="player-name-input"
            style={styles.input}
            value={playerName}
            onChangeText={setPlayerName}
            placeholder="Enter your name"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={16}
            autoCapitalize="words"
          />
        </View>

        {/* Create Room */}
        <TouchableOpacity
          testID="create-room-btn"
          style={styles.goldButton}
          onPress={createRoom}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.goldButtonText}>Create Room</Text>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Join Room */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Room Code</Text>
          <TextInput
            testID="room-code-input"
            style={styles.input}
            value={roomCode}
            onChangeText={(t) => setRoomCode(t.toUpperCase())}
            placeholder="Enter 4-letter code"
            placeholderTextColor="rgba(255,255,255,0.3)"
            maxLength={4}
            autoCapitalize="characters"
          />
        </View>

        <TouchableOpacity
          testID="join-room-btn"
          style={styles.outlineButton}
          onPress={joinRoom}
          disabled={loading}
          activeOpacity={0.8}
        >
          <Text style={styles.outlineButtonText}>Join Room</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.howToPlayLink}
          onPress={async () => {
            await fireHaptic('selection');
            setHowToPlayVisible(true);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.howToPlayText}>
            New to Judgement?{' '}
            <Text style={styles.howToPlayAction}>How to Play →</Text>
          </Text>
        </TouchableOpacity>
        </View>

        <HowToPlayModal
          visible={howToPlayVisible}
          onClose={() => setHowToPlayVisible(false)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: STATUSBAR_HEIGHT,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroPanel: {
    width: '100%',
    marginBottom: 18,
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderAccent,
    backgroundColor: COLORS.surfaceSolid,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 4,
  },
  kicker: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  decoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 8,
  },
  decoSuit: {
    fontSize: 28,
    opacity: 0.4,
  },
  decoRed: {
    color: COLORS.suitRed,
  },
  decoWhite: {
    color: '#FFFFFF',
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 6,
    marginBottom: 4,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  heroChip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroChipText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '700',
  },
  panel: {
    width: '100%',
    padding: 18,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 12,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  goldButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 16,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  goldButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.borderGlass,
  },
  dividerText: {
    color: COLORS.textSecondary,
    marginHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: COLORS.goldLight,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  outlineButtonText: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  howToPlayLink: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  howToPlayText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  howToPlayAction: {
    color: COLORS.goldLight,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
