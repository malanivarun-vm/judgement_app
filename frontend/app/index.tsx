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
  ActivityIndicator,
  Modal,
  StatusBar,
  Animated,
  Easing,
  AccessibilityInfo,
  useWindowDimensions,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { COLORS, SUIT_SYMBOLS, SERIF } from '../utils/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseRoomCodeParam } from '../utils/share';
import { requireBackendUrl } from '../utils/backend';
import { AVATARS, pickRandomAvatar, sanitizeAvatar } from '../utils/avatars';

const STATUSBAR_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const PLAYER_NAME_KEY = 'judgement_player_name';
const PLAYER_AVATAR_KEY = 'judgement_player_avatar';

type InviteState = {
  code: string;
  status: 'checking' | 'open' | 'gone';
  players?: number;
  capacity?: number;
  message?: string;
};

function generateId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function HomeScreen() {
  const router = useRouter();
  const { code: codeParam } = useLocalSearchParams<{ code?: string }>();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [invite, setInvite] = useState<InviteState | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);
  const floatAnim = useRef(new Animated.Value(0)).current;
  const entryAnim = useRef(new Animated.Value(0)).current;
  const nameRequiredAnim = useRef(new Animated.Value(0)).current;
  const { width } = useWindowDimensions();
  const isNarrow = width < 400;

  useEffect(() => {
    Animated.timing(entryAnim, {
      toValue: 1,
      duration: reduceMotion ? 0 : 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entryAnim, reduceMotion]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    const parsed = parseRoomCodeParam(codeParam);
    if (!parsed) return;
    setRoomCode(parsed);
    // Shared link: skip the create/join decision and raise the invite sheet.
    let cancelled = false;
    setInvite({ code: parsed, status: 'checking' });
    (async () => {
      try {
        const backendUrl = requireBackendUrl();
        const res = await fetch(`${backendUrl}/api/rooms/${parsed}/exists`);
        if (!res.ok) throw new Error(`Room lookup failed (${res.status})`);
        const data = await res.json();
        if (cancelled) return;
        if (!data.exists) {
          setInvite({ code: parsed, status: 'gone', message: 'That table doesn’t exist anymore.' });
        } else if (!data.joinable) {
          setInvite({ code: parsed, status: 'gone', message: 'That table is full or the game already started.' });
        } else {
          setInvite({
            code: parsed,
            status: 'open',
            players: typeof data.players === 'number' ? data.players : undefined,
            capacity: typeof data.capacity === 'number' ? data.capacity : undefined,
          });
        }
      } catch {
        // Lookup failed (offline, cold start) — fall back to the normal
        // home screen with the code prefilled rather than a dead sheet.
        if (!cancelled) setInvite(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [codeParam]);

  useEffect(() => {
    AsyncStorage.getItem(PLAYER_NAME_KEY)
      .then((saved: string | null) => {
        if (saved) setPlayerName((current) => current || saved);
      })
      .catch(() => {
        // storage unavailable — name entry stays manual
      });
  }, []);

  useEffect(() => {
    // Auto-assign an avatar on first launch so nobody is forced to choose;
    // tapping it swaps. Persisted alongside the name.
    AsyncStorage.getItem(PLAYER_AVATAR_KEY)
      .then((saved: string | null) => {
        const valid = sanitizeAvatar(saved);
        if (valid) {
          setAvatar(valid);
        } else {
          const assigned = pickRandomAvatar();
          setAvatar(assigned);
          void AsyncStorage.setItem(PLAYER_AVATAR_KEY, assigned).catch(() => {});
        }
      })
      .catch(() => setAvatar(pickRandomAvatar()));
  }, []);

  const selectAvatar = (next: string) => {
    setAvatar(next);
    setAvatarPickerOpen(false);
    void fireHaptic('selection');
    void AsyncStorage.setItem(PLAYER_AVATAR_KEY, next).catch(() => {});
  };

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

  const showNameRequired = () => {
    setError('Your name is required.');
    void fireHaptic('medium');
    if (reduceMotion) return;
    nameRequiredAnim.setValue(0);
    Animated.timing(nameRequiredAnim, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const codeValid = parseRoomCodeParam(roomCode) !== null;
  const busy = creating || joining;

  const createRoom = async () => {
    if (!playerName.trim()) {
      showNameRequired();
      return;
    }
    setError('');
    setJoinError('');
    setCreating(true);
    try {
      void fireHaptic('medium');
      const backendUrl = requireBackendUrl();
      const res = await fetch(`${backendUrl}/api/rooms`, { method: 'POST' });
      if (!res.ok) throw new Error(`Room creation failed (${res.status})`);
      const data = await res.json();
      if (!data.room_id || !data.host_token) {
        throw new Error('Room creation returned an invalid response');
      }
      const playerId = generateId();
      void AsyncStorage.setItem(PLAYER_NAME_KEY, playerName.trim()).catch(() => {});
      router.push({
        pathname: '/game',
        params: {
          room_id: data.room_id,
          player_name: playerName.trim(),
          player_id: playerId,
          host_token: data.host_token,
          avatar,
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create room. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const joinWithCode = async (
    rawCode: string,
    onFail: (message: string) => void,
  ): Promise<void> => {
    const code = parseRoomCodeParam(rawCode);
    if (!code) {
      onFail('Enter a valid 4-letter room code.');
      return;
    }
    setJoining(true);
    try {
      void fireHaptic('selection');
      const backendUrl = requireBackendUrl();
      const res = await fetch(`${backendUrl}/api/rooms/${code}/exists`);
      if (!res.ok) throw new Error(`Room lookup failed (${res.status})`);
      const data = await res.json();
      if (!data.exists) {
        onFail('That table doesn’t exist — check the code.');
        return;
      }
      if (!data.joinable) {
        onFail('That table is full or the game already started.');
        return;
      }
      const playerId = generateId();
      void AsyncStorage.setItem(PLAYER_NAME_KEY, playerName.trim()).catch(() => {});
      router.push({
        pathname: '/game',
        params: {
          room_id: code,
          player_name: playerName.trim(),
          player_id: playerId,
          avatar,
        },
      });
    } catch (err) {
      onFail(err instanceof Error ? err.message : 'Could not check room. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const joinRoom = async () => {
    if (!playerName.trim()) {
      showNameRequired();
      return;
    }
    setError('');
    setJoinError('');
    await joinWithCode(roomCode, setJoinError);
  };

  const joinFromInvite = async () => {
    if (!invite || invite.status !== 'open') return;
    if (!playerName.trim()) {
      setInvite({ ...invite, message: 'Enter your name to take a seat.' });
      return;
    }
    setInvite({ ...invite, message: undefined });
    await joinWithCode(invite.code, (message) =>
      setInvite((current) => (current ? { ...current, message } : current)),
    );
  };

  const dismissInvite = () => {
    setInvite(null);
    void fireHaptic('selection');
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              isNarrow && styles.heroPanelNarrow,
              {
                opacity: entryAnim,
                transform: [
                  {
                    translateY: entryAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [14, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Text style={styles.kicker}>THE HOUSE PRESENTS</Text>
              <View style={styles.kickerRule} />
            </View>
            <Text style={styles.title} adjustsFontSizeToFit numberOfLines={1}>Judgement</Text>
            <Text style={styles.subtitle}>Call it. Own it.</Text>
            <View style={styles.kickerRow}>
              <View style={styles.kickerRule} />
              <Text style={styles.heroMetaText}>REAL-TIME  ·  3–7 PLAYERS  ·  ONE TABLE</Text>
              <View style={styles.kickerRule} />
            </View>
          </Animated.View>
        </View>

        {/* Unified form */}
        <Animated.View
          style={[
            styles.formPanel,
            {
              opacity: entryAnim,
              transform: [
                {
                  translateY: entryAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [22, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.formPanelAccent} />
          <Animated.View
            style={[
              styles.nameBlock,
              {
                transform: [
                  {
                    translateX: nameRequiredAnim.interpolate({
                      inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1],
                      outputRange: [0, -10, 10, -7, 7, 0],
                    }),
                  },
                  {
                    scale: nameRequiredAnim.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [1, 1.025, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.label}>Your Name</Text>
            <View style={styles.nameRow}>
              <TouchableOpacity
                testID="avatar-chip"
                style={styles.avatarChip}
                onPress={() => setAvatarPickerOpen((open) => !open)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Change your avatar"
              >
                <Text style={styles.avatarChipEmoji}>{avatar}</Text>
                <View style={styles.avatarEditBadge}>
                  <Text style={styles.avatarEditBadgeText}>✎</Text>
                </View>
              </TouchableOpacity>
              <TextInput
                testID="player-name-input"
                style={[styles.input, styles.nameInput]}
                value={playerName}
                onChangeText={setPlayerName}
                placeholder="Enter your name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                maxLength={16}
                autoCapitalize="words"
              />
            </View>
            {avatarPickerOpen ? (
              <View style={styles.avatarGrid}>
                {AVATARS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[styles.avatarOption, option === avatar && styles.avatarOptionSelected]}
                    onPress={() => selectAvatar(option)}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Choose avatar ${option}`}
                  >
                    <Text style={styles.avatarOptionEmoji}>{option}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
          </Animated.View>

          <View style={styles.actionsBlock}>
            <TouchableOpacity
              testID="create-room-btn"
              style={[styles.goldButton, busy && styles.buttonBusy]}
              onPress={createRoom}
              disabled={busy}
              activeOpacity={0.8}
            >
              {creating ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color="#000" size="small" />
                  <Text style={styles.goldButtonText}>Dealing you in…</Text>
                </View>
              ) : (
                <Text style={styles.goldButtonText}>Create Room</Text>
              )}
            </TouchableOpacity>

            <View style={styles.orDividerRow}>
              <View style={styles.orDividerRule} />
              <Text style={styles.sectionLabel}>Or join with a code</Text>
              <View style={styles.orDividerRule} />
            </View>

            <TextInput
              testID="room-code-input"
              style={[styles.input, styles.codeInput, joinError ? styles.codeInputError : null]}
              value={roomCode}
              onChangeText={(t) => {
                setRoomCode(t.toUpperCase());
                if (joinError) setJoinError('');
              }}
              placeholder="ABCD"
              placeholderTextColor="rgba(255,255,255,0.45)"
              maxLength={4}
              autoCapitalize="characters"
            />
            {joinError ? (
              <Text style={styles.joinErrorText} accessibilityRole="alert">
                {joinError}
              </Text>
            ) : null}
            <TouchableOpacity
              testID="join-room-btn"
              style={[styles.outlineButton, (!codeValid || busy) && styles.outlineButtonDisabled]}
              onPress={joinRoom}
              disabled={!codeValid || busy}
              activeOpacity={0.8}
            >
              {joining ? (
                <View style={styles.buttonLoadingRow}>
                  <ActivityIndicator color={COLORS.goldLight} size="small" />
                  <Text style={styles.outlineButtonText}>Finding your table…</Text>
                </View>
              ) : (
                <Text style={[styles.outlineButtonText, !codeValid && styles.outlineButtonTextDisabled]}>
                  Join Room
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {error ? (
          <View style={styles.errorBanner} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.howToPlayLink}
          onPress={async () => {
            await fireHaptic('selection');
            router.push('/how-to-play' as any);
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.howToPlayText}>
            New to Judgement?{' '}
            <Text style={styles.howToPlayAction}>How to Play →</Text>
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Shared-link invitation sheet */}
      <Modal
        visible={invite !== null}
        transparent
        animationType={reduceMotion ? 'fade' : 'slide'}
        onRequestClose={dismissInvite}
      >
        <View style={styles.sheetScrim}>
          <View style={styles.sheet}>
            <View style={styles.sheetGrabber} />
            {invite?.status === 'checking' ? (
              <View style={styles.sheetChecking}>
                <ActivityIndicator color={COLORS.goldLight} />
                <Text style={styles.sheetCheckingText}>Finding your table…</Text>
              </View>
            ) : invite?.status === 'gone' ? (
              <>
                <Text style={styles.sheetKicker}>YOU'RE INVITED</Text>
                <Text style={styles.sheetTitle}>
                  Table <Text style={styles.sheetCode}>{invite.code}</Text>
                </Text>
                <Text style={styles.sheetError}>{invite.message}</Text>
                <TouchableOpacity
                  testID="invite-back-btn"
                  style={styles.outlineButton}
                  onPress={dismissInvite}
                  activeOpacity={0.8}
                >
                  <Text style={styles.outlineButtonText}>Back to Home</Text>
                </TouchableOpacity>
              </>
            ) : invite ? (
              <>
                <Text style={styles.sheetKicker}>YOU'RE INVITED</Text>
                <Text style={styles.sheetTitle}>
                  Table <Text style={styles.sheetCode}>{invite.code}</Text>
                </Text>
                {typeof invite.players === 'number' && typeof invite.capacity === 'number' ? (
                  <Text style={styles.sheetSub}>
                    {invite.players} of {invite.capacity} seats taken
                  </Text>
                ) : null}
                <View style={styles.avatarGrid}>
                  {AVATARS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[styles.avatarOption, option === avatar && styles.avatarOptionSelected]}
                      onPress={() => selectAvatar(option)}
                      activeOpacity={0.7}
                      accessibilityRole="button"
                      accessibilityLabel={`Choose avatar ${option}`}
                    >
                      <Text style={styles.avatarOptionEmoji}>{option}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.label}>Your Name</Text>
                <TextInput
                  testID="invite-name-input"
                  style={styles.input}
                  value={playerName}
                  onChangeText={setPlayerName}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  maxLength={16}
                  autoCapitalize="words"
                />
                {invite.message ? (
                  <Text style={styles.joinErrorText} accessibilityRole="alert">
                    {invite.message}
                  </Text>
                ) : null}
                <TouchableOpacity
                  testID="invite-join-btn"
                  style={[styles.goldButton, styles.sheetJoinButton, joining && styles.buttonBusy]}
                  onPress={joinFromInvite}
                  disabled={joining}
                  activeOpacity={0.8}
                >
                  {joining ? (
                    <View style={styles.buttonLoadingRow}>
                      <ActivityIndicator color="#000" size="small" />
                      <Text style={styles.goldButtonText}>Finding your table…</Text>
                    </View>
                  ) : (
                    <Text style={styles.goldButtonText}>Take a Seat</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  testID="invite-dismiss-btn"
                  style={styles.sheetDismiss}
                  onPress={dismissInvite}
                  activeOpacity={0.7}
                >
                  <Text style={styles.sheetDismissText}>Not now</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: STATUSBAR_HEIGHT,
  },
  keyboard: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 18,
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
    paddingTop: 150,
    paddingBottom: 16,
  },
  heroPanelNarrow: {
    paddingTop: 118,
    paddingBottom: 10,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 10,
  },
  kickerRule: {
    flex: 1,
    maxWidth: 56,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.45)',
  },
  kicker: {
    color: 'rgba(243,229,171,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
  },
  heroMetaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 2,
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
    fontFamily: SERIF,
    fontSize: 52,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
    textAlign: 'center',
    textShadowColor: 'rgba(212,175,55,0.35)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.72)',
    fontFamily: SERIF,
    fontStyle: 'italic',
    fontSize: 16,
    lineHeight: 23,
    marginTop: 6,
    marginBottom: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  formPanel: {
    width: '100%',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.18)',
    backgroundColor: COLORS.surfaceSolid,
    overflow: 'hidden',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  formPanelAccent: {
    height: 2,
    backgroundColor: 'rgba(212,175,55,0.55)',
  },
  nameBlock: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameInput: {
    flex: 1,
  },
  avatarChip: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.55)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarChipEmoji: {
    fontSize: 24,
  },
  avatarEditBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '700',
  },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  avatarOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarOptionSelected: {
    borderColor: COLORS.gold,
    backgroundColor: 'rgba(212,175,55,0.15)',
  },
  avatarOptionEmoji: {
    fontSize: 22,
  },
  actionsBlock: {
    padding: 18,
    paddingTop: 16,
  },
  orDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 12,
  },
  orDividerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buttonBusy: {
    opacity: 0.85,
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
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  codeInput: {
    textAlign: 'center',
    letterSpacing: 5,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
  },
  codeInputError: {
    borderColor: 'rgba(239,68,68,0.6)',
  },
  joinErrorText: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
  outlineButtonDisabled: {
    borderColor: 'rgba(212,175,55,0.35)',
  },
  outlineButtonText: {
    color: COLORS.goldLight,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  outlineButtonTextDisabled: {
    color: 'rgba(243,229,171,0.45)',
  },
  sheetScrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.surfaceSolid,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(212,175,55,0.25)',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 30,
  },
  sheetGrabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 16,
  },
  sheetChecking: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 12,
  },
  sheetCheckingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  sheetKicker: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 6,
  },
  sheetTitle: {
    color: COLORS.text,
    fontFamily: SERIF,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  sheetCode: {
    color: COLORS.goldLight,
    letterSpacing: 3,
  },
  sheetSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  sheetError: {
    color: '#FFB4B4',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 18,
  },
  sheetJoinButton: {
    marginTop: 14,
  },
  sheetDismiss: {
    marginTop: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  sheetDismissText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  howToPlayLink: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  errorBanner: {
    width: '100%',
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.45)',
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  errorText: {
    color: '#FFB4B4',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
