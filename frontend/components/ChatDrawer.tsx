// Table Talk — Among-Us-style discussion panel.
// One feed mixes player chat, quick phrases, and live game events
// (bids, trick wins, trump calls, timeouts). Used as a bottom drawer
// in-game and as an inline panel in the lobby.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { COLORS, SERIF } from '../utils/theme';

export interface FeedItem {
  key: string;
  kind: 'chat' | 'event' | 'timeout';
  name?: string;
  text: string;
  mine?: boolean;
}

const QUICK_PHRASES = [
  'Sus prediction 👀',
  'Trust me 🤝',
  'Who took my round?!',
  'Easy money 💰',
  'That was personal 😤',
  'Run it back 🔁',
];

interface Props {
  items: FeedItem[];
  onSend: (text: string) => void;
  /** Inline mode renders a fixed-height always-open panel (lobby). */
  inline?: boolean;
  /** Drawer mode only: whether the drawer is open. */
  visible?: boolean;
  onClose?: () => void;
}

export default function ChatDrawer({ items, onSend, inline, visible, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    // Keep the newest message in view
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [items.length, visible]);

  const submit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed.slice(0, 200));
    setDraft('');
  };

  if (!inline && !visible) return null;

  const panel = (
    <View style={[styles.panel, inline ? styles.panelInline : styles.panelDrawer]}>
      <View style={styles.header}>
        <View style={styles.headerRule} />
        <Text style={styles.headerTitle}>TABLE TALK</Text>
        <View style={styles.headerRule} />
        {!inline && (
          <TouchableOpacity
            testID="chat-close-btn"
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.closeBtn}
          >
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.feed}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {items.length === 0 && (
          <Text style={styles.emptyText}>Nothing yet — talk your talk.</Text>
        )}
        {items.map((item) => {
          if (item.kind === 'chat') {
            return (
              <View
                key={item.key}
                style={[styles.bubbleRow, item.mine && styles.bubbleRowMine]}
              >
                <View style={[styles.bubble, item.mine && styles.bubbleMine]}>
                  {!item.mine && <Text style={styles.bubbleName}>{item.name}</Text>}
                  <Text style={styles.bubbleText}>{item.text}</Text>
                </View>
              </View>
            );
          }
          return (
            <View key={item.key} style={styles.eventRow}>
              <Text
                style={[styles.eventText, item.kind === 'timeout' && styles.timeoutText]}
              >
                {item.text}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickRow}
        contentContainerStyle={styles.quickRowContent}
        keyboardShouldPersistTaps="handled"
      >
        {QUICK_PHRASES.map((phrase) => (
          <TouchableOpacity
            key={phrase}
            style={styles.quickChip}
            onPress={() => submit(phrase)}
            activeOpacity={0.75}
          >
            <Text style={styles.quickChipText}>{phrase}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          testID="chat-input"
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Say something…"
          placeholderTextColor="rgba(255,255,255,0.3)"
          maxLength={200}
          returnKeyType="send"
          onSubmitEditing={() => submit(draft)}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          testID="chat-send-btn"
          style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
          onPress={() => submit(draft)}
          disabled={!draft.trim()}
          activeOpacity={0.8}
        >
          <Text style={styles.sendBtnText}>➤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (inline) return panel;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        pointerEvents="box-none"
      >
        {panel}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 40,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 8, 5, 0.55)',
  },
  panel: {
    backgroundColor: '#0C2218',
    borderColor: 'rgba(212,175,55,0.28)',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
  },
  panelDrawer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: 500,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
  panelInline: {
    borderRadius: 18,
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  headerRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(212,175,55,0.4)',
  },
  headerTitle: {
    color: 'rgba(243,229,171,0.75)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 3,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  feed: {
    maxHeight: 280,
    minHeight: 110,
  },
  feedContent: {
    gap: 6,
    paddingVertical: 4,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 12,
    fontFamily: SERIF,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 16,
  },
  bubbleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '82%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 14,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  bubbleMine: {
    backgroundColor: 'rgba(212,175,55,0.16)',
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 4,
  },
  bubbleName: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
  },
  bubbleText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 18,
  },
  eventRow: {
    alignItems: 'center',
    paddingVertical: 1,
  },
  eventText: {
    color: 'rgba(243,229,171,0.6)',
    fontSize: 11,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  timeoutText: {
    color: COLORS.danger,
  },
  quickRow: {
    marginTop: 8,
    maxHeight: 40,
  },
  quickRowContent: {
    gap: 8,
    paddingVertical: 2,
  },
  quickChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)',
    backgroundColor: 'rgba(212,175,55,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  quickChipText: {
    color: COLORS.goldLight,
    fontSize: 12,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    color: COLORS.text,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },
  sendBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
  },
});
