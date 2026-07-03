import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { EMOJI_REACTIONS, PHRASE_REACTIONS } from '../constants/reactions';
import { COLORS } from '../utils/theme';

const COOLDOWN_MS = 1000;

type Props = {
  onSend: (reactionId: string) => void;
};

export default function ReactionTray({ onSend }: Props) {
  const [open, setOpen] = useState(false);
  const [coolingDown, setCoolingDown] = useState(false);
  const lastSentAt = useRef(0);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const handleSend = (reactionId: string) => {
    const now = Date.now();
    if (now - lastSentAt.current < COOLDOWN_MS) return;
    lastSentAt.current = now;
    onSend(reactionId);
    setOpen(false);
    setCoolingDown(true);
    if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    cooldownTimer.current = setTimeout(() => setCoolingDown(false), COOLDOWN_MS);
  };

  return (
    <>
      <TouchableOpacity
        testID="reaction-tray-btn"
        style={[styles.trigger, coolingDown && styles.triggerDisabled]}
        onPress={() => setOpen(true)}
        disabled={coolingDown}
        activeOpacity={0.85}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel="Open reactions"
      >
        <Text style={styles.triggerEmoji}>😊</Text>
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.tray} onPress={(e: any) => e.stopPropagation()}>
            <View style={styles.emojiRow}>
              {EMOJI_REACTIONS.map((reaction) => (
                <TouchableOpacity
                  key={reaction.id}
                  testID={`reaction-${reaction.id}`}
                  style={styles.emojiBtn}
                  onPress={() => handleSend(reaction.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emojiText}>{reaction.display}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.phraseRow}>
              {PHRASE_REACTIONS.map((reaction) => (
                <TouchableOpacity
                  key={reaction.id}
                  testID={`reaction-${reaction.id}`}
                  style={styles.phrasePill}
                  onPress={() => handleSend(reaction.id)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.phraseText}>{reaction.display}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerDisabled: {
    opacity: 0.4,
  },
  triggerEmoji: {
    fontSize: 22,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 190,
    paddingHorizontal: 16,
  },
  tray: {
    backgroundColor: 'rgba(20, 24, 38, 0.96)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  emojiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 26,
  },
  phraseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  phrasePill: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 32,
  },
  phraseText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
});
