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
        {/* Hero wrapper - suits scatter behind title */}
        <View style={styles.heroWrapper}>
          {!reduceMotion ? (
            <Animated.Text
              style={[
                styles.suitScatter,
                styles.decoRed,
                { top: 28, left: 16, fontSize: 50, opacity: 0.16 },
                {
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -7],
                      }),
                    },
                  ],
                },
              ]}
            >
              {SUIT_SYMBOLS.hearts}
            </Animated.Text>
          ) : (
            <Text style={[styles.suitScatter, styles.decoRed, { top: 28, left: 16, fontSize: 50, opacity: 0.16 }]}>
              {SUIT_SYMBOLS.hearts}
            </Text>
          )}

          {!reduceMotion ? (
            <Animated.Text
              style={[
                styles.suitScatter,
                styles.decoWhite,
                { top: 12, left: 160, fontSize: 26, opacity: 0.1 },
                {
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -4],
                      }),
                    },
                  ],
                },
              ]}
            >
              {SUIT_SYMBOLS.spades}
            </Animated.Text>
          ) : (
            <Text style={[styles.suitScatter, styles.decoWhite, { top: 12, left: 160, fontSize: 26, opacity: 0.1 }]}>
              {SUIT_SYMBOLS.spades}
            </Text>
          )}

          {!reduceMotion ? (
            <Animated.Text
              style={[
                styles.suitScatter,
                styles.decoRed,
                { top: 52, right: 18, fontSize: 40, opacity: 0.13 },
                {
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -9],
                      }),
                    },
                  ],
                },
              ]}
            >
              {SUIT_SYMBOLS.diamonds}
            </Animated.Text>
          ) : (
            <Text style={[styles.suitScatter, styles.decoRed, { top: 52, right: 18, fontSize: 40, opacity: 0.13 }]}>
              {SUIT_SYMBOLS.diamonds}
            </Text>
          )}

          {!reduceMotion ? (
            <Animated.Text
              style={[
                styles.suitScatter,
                styles.decoWhite,
                { top: 118, right: 44, fontSize: 20, opacity: 0.08 },
                {
                  transform: [
                    {
                      translateY: floatAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, -5],
                      }),
                    },
                  ],
                },
              ]}
            >
              {SUIT_SYMBOLS.clubs}
            </Animated.Text>
          ) : (
            <Text style={[styles.suitScatter, styles.decoWhite, { top: 118, right: 44, fontSize: 20, opacity: 0.08 }]}>
              {SUIT_SYMBOLS.clubs}
            </Text>
          )}

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
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>Judgement</Text>
            <Text style={styles.subtitle}>Call it. Own it.</Text>
            <View style={styles.heroChips}>
              <View style={styles.heroChip}><Text style={styles.heroChipText}>Real-time</Text></View>
              <View style={styles.heroChip}><Text style={styles.heroChipText}>3–7 players</Text></View>
            </View>
          </Animated.View>
        </View>

        {/* Unified form */}
        <View style={styles.formPanel}>
          <View style={styles.nameBlock}>
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

          <View style={styles.actionRow}>
            <View style={styles.actionCreate}>
              <Text style={styles.sectionLabel}>Create a room</Text>
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
            </View>

            <View style={styles.actionDivider} />

            <View style={styles.actionJoin}>
              <Text style={styles.sectionLabel}>Have a code?</Text>
              <TextInput
                testID="room-code-input"
                style={[styles.input, styles.codeInput]}
                value={roomCode}
                onChangeText={(t) => setRoomCode(t.toUpperCase())}
                placeholder="ABCD"
                placeholderTextColor="rgba(255,255,255,0.25)"
                maxLength={4}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                testID="join-room-btn"
                style={styles.outlineButton}
                onPress={joinRoom}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.outlineButtonText}>Join Room</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.howToPlayLink}
          onPress={async () => {
            await fireHaptic('selection');
            router.push('/how-to-play');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.howToPlayText}>
            New to Judgement?{' '}
            <Text style={styles.howToPlayAction}>How to Play →</Text>
          </Text>
        </TouchableOpacity>
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
  heroWrapper: {
    width: '100%',
    position: 'relative',
    marginBottom: 8,
  },
  heroPanel: {
    width: '100%',
    marginBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 160,
    paddingBottom: 20,
  },
  suitScatter: {
    position: 'absolute',
    fontFamily: 'serif',
  },
  decoRed: {
    color: COLORS.suitRed,
  },
  decoWhite: {
    color: '#FFFFFF',
  },
  title: {
    color: COLORS.goldLight,
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: 3,
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  heroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    justifyContent: 'center',
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
  formPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
    backgroundColor: COLORS.surfaceSolid,
    overflow: 'hidden',
    marginBottom: 4,
  },
  nameBlock: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  actionRow: {
    flexDirection: 'row',
  },
  actionCreate: {
    flex: 1,
    padding: 14,
    paddingBottom: 18,
  },
  actionJoin: {
    flex: 1,
    padding: 14,
    paddingBottom: 18,
  },
  actionDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
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
  sectionLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 5,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  goldButton: {
    backgroundColor: COLORS.gold,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    shadowColor: COLORS.gold,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  goldButtonText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 1,
  },
  outlineButton: {
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    paddingVertical: 13,
    borderRadius: 20,
    alignItems: 'center',
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
