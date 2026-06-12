import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  StatusBar,
  Animated,
  Easing,
  AccessibilityInfo,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../utils/theme';
import HowToPlayModal from '../components/HowToPlayModal';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

// Fallback so the app works even if the .env isn't loaded yet
const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'http://localhost:8000';

function generateId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// Decorative card suits scattered in background
const BG_SUITS = [
  { sym: '♠', x: -18, y: 30,  size: 120, rot: -22, opacity: 0.06 },
  { sym: '♥', x: SCREEN_W - 80, y: 10,  size: 100, rot: 15,  opacity: 0.07 },
  { sym: '♦', x: SCREEN_W - 40, y: SCREEN_H * 0.5, size: 90, rot: 8, opacity: 0.05 },
  { sym: '♣', x: 10, y: SCREEN_H * 0.55, size: 80, rot: -10, opacity: 0.06 },
  { sym: '♠', x: SCREEN_W * 0.4, y: SCREEN_H * 0.08, size: 48, rot: 35, opacity: 0.04 },
  { sym: '♥', x: 30,  y: SCREEN_H * 0.3, size: 44, rot: -18, opacity: 0.05 },
  { sym: '♦', x: SCREEN_W * 0.6, y: SCREEN_H * 0.78, size: 52, rot: 20, opacity: 0.05 },
  { sym: '♣', x: SCREEN_W * 0.15, y: SCREEN_H * 0.82, size: 38, rot: 12, opacity: 0.04 },
];

export default function HomeScreen() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [howToPlayVisible, setHowToPlayVisible] = useState(false);
  const [reduceMotion, setReduceMotion]          = useState(false);
  const [nameError, setNameError]   = useState('');
  const [codeError, setCodeError]   = useState('');

  // Ambient animations
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const titleGlow = useRef(new Animated.Value(0)).current;

  // Button press scales
  const createScale = useRef(new Animated.Value(1)).current;
  const joinScale   = useRef(new Animated.Value(1)).current;

  // Mount fade-in for form
  const formFade = useRef(new Animated.Value(0)).current;
  const formSlide = useRef(new Animated.Value(32)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  // Entrance animation on mount
  useEffect(() => {
    Animated.parallel([
      Animated.timing(formFade,  { toValue: 1, duration: 700, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(formSlide, { toValue: 0, duration: 600, delay: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    // Orb 1 — slow drift
    Animated.loop(Animated.sequence([
      Animated.timing(orb1Anim, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(orb1Anim, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Orb 2 — offset drift
    Animated.loop(Animated.sequence([
      Animated.timing(orb2Anim, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(orb2Anim, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Float for suit symbols + title
    Animated.loop(Animated.sequence([
      Animated.timing(floatAnim, { toValue: 1, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatAnim, { toValue: 0, duration: 5500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();

    // Title glow pulse
    Animated.loop(Animated.sequence([
      Animated.timing(titleGlow, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(titleGlow, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ])).start();
  }, [reduceMotion]);

  const pressIn  = (anim: Animated.Value) => Animated.spring(anim, { toValue: 0.94, friction: 4, tension: 300, useNativeDriver: true }).start();
  const pressOut = (anim: Animated.Value) => Animated.spring(anim, { toValue: 1,    friction: 4, tension: 200, useNativeDriver: true }).start();

  const fireHaptic = async (kind: 'selection' | 'medium') => {
    try {
      kind === 'selection'
        ? await Haptics.selectionAsync()
        : await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch { /* ignore */ }
  };

  const validate = () => {
    let ok = true;
    if (!playerName.trim()) { setNameError('Enter your name to play'); ok = false; }
    else setNameError('');
    return ok;
  };

  const createRoom = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      void fireHaptic('medium');
      const res  = await fetch(`${BACKEND_URL}/api/rooms`, { method: 'POST' });
      const data = await res.json();
      router.push({
        pathname: '/game',
        params: {
          room_id:     data.room_id,
          player_name: playerName.trim(),
          player_id:   generateId(),
          is_host:     'true',
        },
      });
    } catch {
      Alert.alert('Error', 'Could not create room. Is the server running?');
    } finally {
      setLoading(false);
    }
  };

  const joinRoom = async () => {
    if (!validate()) return;
    if (!roomCode.trim()) {
      setCodeError('Enter the 4-letter room code');
      return;
    }
    setCodeError('');
    setLoading(true);
    try {
      void fireHaptic('selection');
      const code = roomCode.trim().toUpperCase();
      const res  = await fetch(`${BACKEND_URL}/api/rooms/${code}/exists`);
      const data = await res.json();
      if (!data.exists) {
        setCodeError('Room not found — check the code');
        return;
      }
      if (!data.joinable) {
        setCodeError('Room is full or game already started');
        return;
      }
      router.push({
        pathname: '/game',
        params: {
          room_id:     code,
          player_name: playerName.trim(),
          player_id:   generateId(),
          is_host:     'false',
        },
      });
    } catch {
      Alert.alert('Connection Error', `Could not reach server at ${BACKEND_URL}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

      {/* ── Atmospheric background ──────────────────── */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Deep spotlight top-left */}
        <Animated.View style={[styles.orb, styles.orbTopLeft, !reduceMotion && {
          opacity: orb1Anim.interpolate({ inputRange: [0,1], outputRange: [0.55, 0.85] }),
          transform: [{ translateY: orb1Anim.interpolate({ inputRange: [0,1], outputRange: [0, -18] }) }],
        }]} />
        {/* Warm glow bottom-right */}
        <Animated.View style={[styles.orb, styles.orbBottomRight, !reduceMotion && {
          opacity: orb2Anim.interpolate({ inputRange: [0,1], outputRange: [0.4, 0.7] }),
          transform: [{ translateY: orb2Anim.interpolate({ inputRange: [0,1], outputRange: [0, 14] }) }],
        }]} />
        {/* Subtle center glow */}
        <View style={styles.orbCenter} />

        {/* Scattered oversized suit symbols */}
        {BG_SUITS.map((s, i) => (
          <Animated.Text
            key={i}
            style={[
              styles.bgSuit,
              {
                fontSize: s.size,
                left: s.x,
                top: s.y,
                opacity: s.opacity,
                transform: [
                  { rotate: `${s.rot}deg` },
                  !reduceMotion ? { translateY: floatAnim.interpolate({ inputRange: [0,1], outputRange: [0, i % 2 === 0 ? -8 : 6] }) } : { translateY: 0 },
                ],
                color: s.sym === '♥' || s.sym === '♦' ? COLORS.suitRed : '#FFFFFF',
              },
            ]}
          >
            {s.sym}
          </Animated.Text>
        ))}

        {/* Horizontal table line */}
        <View style={styles.tableLine} />
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Hero title ──────────────────────────────── */}
          <Animated.View style={[styles.hero, !reduceMotion && {
            transform: [{ translateY: floatAnim.interpolate({ inputRange: [0,1], outputRange: [0, -5] }) }],
          }]}>
            {/* Suit crown above title */}
            <View style={styles.suitCrown}>
              {['♠','♥','♦','♣'].map((s, i) => (
                <Text key={i} style={[
                  styles.crownSuit,
                  { color: i % 2 !== 0 ? COLORS.suitRed : COLORS.goldLight },
                ]}>{s}</Text>
              ))}
            </View>

            <Animated.Text style={[
              styles.title,
              !reduceMotion && {
                textShadowRadius: titleGlow.interpolate({ inputRange: [0,1], outputRange: [12, 32] }),
                opacity: titleGlow.interpolate({ inputRange: [0,1], outputRange: [0.88, 1] }),
              },
            ]}>
              JUDGEMENT
            </Animated.Text>

            <Text style={styles.subtitle}>
              Bid the exact number of tricks.{'\n'}Miss by one — and pay for it.
            </Text>

            <View style={styles.tagRow}>
              <Tag label="Real-time" />
              <Tag label="3–7 Players" />
              <Tag label="Exact Bids" />
            </View>
          </Animated.View>

          {/* ── Play card ───────────────────────────────── */}
          <Animated.View style={[
            styles.card,
            !reduceMotion && {
              opacity:   formFade,
              transform: [{ translateY: formSlide }],
            },
          ]}>
            {/* Card header */}
            <View style={styles.cardHeader}>
              <View style={styles.chipDot} />
              <Text style={styles.cardHeading}>Play the Table</Text>
              <View style={styles.chipDot} />
            </View>

            {/* Name input */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Your Name</Text>
              <View style={[styles.inputWrap, nameError ? styles.inputWrapError : null]}>
                <TextInput
                  testID="player-name-input"
                  style={styles.input}
                  value={playerName}
                  onChangeText={(t) => { setPlayerName(t); if (nameError) setNameError(''); }}
                  placeholder="e.g. Lucky Ace"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  maxLength={16}
                  autoCapitalize="words"
                  returnKeyType="done"
                />
              </View>
              {nameError ? <Text style={styles.fieldError}>{nameError}</Text> : null}
            </View>

            {/* Create Room */}
            <Animated.View style={{ transform: [{ scale: createScale }] }}>
              <TouchableOpacity
                testID="create-room-btn"
                style={styles.primaryBtn}
                onPress={createRoom}
                onPressIn={() => !reduceMotion && pressIn(createScale)}
                onPressOut={() => !reduceMotion && pressOut(createScale)}
                disabled={loading}
                activeOpacity={1}
              >
                {loading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Text style={styles.primaryBtnText}>Create Room</Text>
                    <Text style={styles.primaryBtnIcon}>♠</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Ornamental divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>✦  or join  ✦</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Room code input */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Room Code</Text>
              <View style={[styles.inputWrap, codeError ? styles.inputWrapError : null]}>
                <TextInput
                  testID="room-code-input"
                  style={[styles.input, styles.codeInput]}
                  value={roomCode}
                  onChangeText={(t) => { setRoomCode(t.toUpperCase()); if (codeError) setCodeError(''); }}
                  placeholder="A B C D"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  maxLength={4}
                  autoCapitalize="characters"
                  returnKeyType="go"
                  onSubmitEditing={joinRoom}
                />
              </View>
              {codeError ? <Text style={styles.fieldError}>{codeError}</Text> : null}
            </View>

            {/* Join Room */}
            <Animated.View style={{ transform: [{ scale: joinScale }] }}>
              <TouchableOpacity
                testID="join-room-btn"
                style={styles.secondaryBtn}
                onPress={joinRoom}
                onPressIn={() => !reduceMotion && pressIn(joinScale)}
                onPressOut={() => !reduceMotion && pressOut(joinScale)}
                disabled={loading}
                activeOpacity={1}
              >
                <Text style={styles.secondaryBtnText}>Join Room</Text>
                <Text style={styles.secondaryBtnIcon}>♦</Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>

          {/* ── Footer link ──────────────────────────────── */}
          <Animated.View style={[styles.footer, !reduceMotion && { opacity: formFade }]}>
            <TouchableOpacity
              style={styles.rulesBtn}
              onPress={async () => { await fireHaptic('selection'); setHowToPlayVisible(true); }}
              activeOpacity={0.7}
            >
              <Text style={styles.rulesBtnText}>📖  How to Play  →</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>

      <HowToPlayModal visible={howToPlayVisible} onClose={() => setHowToPlayVisible(false)} />
    </SafeAreaView>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <View style={styles.tag}>
      <Text style={styles.tagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: STATUSBAR_HEIGHT,
  },
  keyboardView: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 40,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: SCREEN_H - STATUSBAR_HEIGHT - 40,
  },

  // ── Atmospheric background ──
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTopLeft: {
    width: 340, height: 340,
    top: -100, left: -120,
    backgroundColor: 'rgba(212,175,55,0.09)',
    // layered shadow effect via multiple overlapping views handled by the deep green
  },
  orbBottomRight: {
    width: 280, height: 280,
    bottom: 20, right: -100,
    backgroundColor: 'rgba(180,60,60,0.07)',
  },
  orbCenter: {
    position: 'absolute',
    width: 420, height: 320,
    top: '30%', left: '50%',
    marginLeft: -210,
    borderRadius: 210,
    backgroundColor: 'rgba(26,75,51,0.25)',
  },
  bgSuit: {
    position: 'absolute',
    fontWeight: '900',
  },
  tableLine: {
    position: 'absolute',
    left: 0, right: 0,
    top: '62%',
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.06)',
  },

  // ── Hero ──
  hero: {
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  suitCrown: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 10,
  },
  crownSuit: {
    fontSize: 26,
    opacity: 0.85,
  },
  title: {
    fontSize: 54,
    fontWeight: '900',
    color: COLORS.gold,
    letterSpacing: 8,
    textAlign: 'center',
    textShadowColor: COLORS.gold,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
    marginBottom: 14,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    letterSpacing: 0.3,
    maxWidth: 300,
    marginBottom: 16,
  },
  tagRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
  },
  tagText: {
    color: COLORS.goldLight,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },

  // ── Play card ──
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#081710',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.35)',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 22,
  },
  chipDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: COLORS.gold,
    opacity: 0.7,
  },
  cardHeading: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },

  // ── Fields ──
  fieldWrap: { width: '100%', marginBottom: 14 },
  fieldLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  inputWrap: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  inputWrapError: {
    borderColor: 'rgba(239,68,68,0.55)',
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  codeInput: {
    letterSpacing: 8,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.goldLight,
  },
  fieldError: {
    color: COLORS.danger,
    fontSize: 11,
    marginTop: 5,
    marginLeft: 2,
    fontWeight: '600',
  },

  // ── Buttons ──
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: COLORS.gold,
    paddingVertical: 17,
    borderRadius: 99,
    width: '100%',
    marginTop: 4,
    shadowColor: COLORS.gold,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  primaryBtnText: {
    color: '#000',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  primaryBtnIcon: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
    opacity: 0.6,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.55)',
    paddingVertical: 15,
    borderRadius: 99,
    width: '100%',
    backgroundColor: 'rgba(212,175,55,0.06)',
  },
  secondaryBtnText: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  secondaryBtnIcon: {
    color: COLORS.suitRed,
    fontSize: 16,
    fontWeight: '900',
  },

  // ── Divider ──
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 22,
    gap: 0,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  dividerText: {
    color: 'rgba(212,175,55,0.5)',
    marginHorizontal: 12,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // ── Footer ──
  footer: {
    marginTop: 24,
    alignItems: 'center',
  },
  rulesBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  rulesBtnText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
