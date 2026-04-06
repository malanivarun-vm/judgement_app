import React, { useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, SUIT_SYMBOLS } from '../utils/theme';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

function generateId(): string {
  return 'p_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function HomeScreen() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);

  const createRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert('Enter Name', 'Please enter your player name');
      return;
    }
    setLoading(true);
    try {
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
    } catch (e) {
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
    } catch (e) {
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
        <View style={styles.decoRow}>
          {Object.values(SUIT_SYMBOLS).map((s, i) => (
            <Text key={i} style={[styles.decoSuit, i % 2 === 0 ? styles.decoRed : styles.decoWhite]}>
              {s}
            </Text>
          ))}
        </View>

        <Text style={styles.title}>JUDGEMENT</Text>
        <Text style={styles.subtitle}>The Trick-Taking Card Game</Text>

        {/* Player Name */}
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

        {/* Rules hint */}
        <View style={styles.rulesBox}>
          <Text style={styles.rulesTitle}>How to Play</Text>
          <Text style={styles.rulesText}>
            Bid exactly how many tricks you'll win each round. Score points for accuracy — lose points for missing!
          </Text>
          <Text style={styles.rulesText}>3-7 players • Share room code to invite</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 32,
    letterSpacing: 1,
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
  rulesBox: {
    marginTop: 28,
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  rulesTitle: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rulesText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 4,
  },
});
