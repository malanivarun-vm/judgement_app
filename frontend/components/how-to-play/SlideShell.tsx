import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { COLORS } from '../../utils/theme';
import ProgressDots from './ProgressDots';

interface Props {
  title: string;
  heading: string;
  body: string;
  scene?: React.ReactNode;
  totalSlides: number;
  currentSlide: number;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onDone: () => void;
  doneUnlocked: boolean;
  isLast: boolean;
  isFirst: boolean;
  lockDone: boolean;
}

export default function SlideShell({
  title, heading, body, scene,
  totalSlides, currentSlide,
  onNext, onBack, onSkip, onDone,
  doneUnlocked, isLast, isFirst, lockDone,
}: Props) {
  const doneDisabled = lockDone && !doneUnlocked;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>HOW TO PLAY</Text>
        <TouchableOpacity onPress={onSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipBtn}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Scene zone */}
      {scene != null && (
        <View style={styles.sceneZone}>{scene}</View>
      )}

      {/* Text content */}
      <View style={styles.textBlock}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.heading}>{heading}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <ProgressDots total={totalSlides} current={currentSlide} />
        <View style={styles.navRow}>
          {!isFirst && (
            <TouchableOpacity style={styles.backBtn} onPress={onBack}>
              <Text style={styles.backBtnText}>← Back</Text>
            </TouchableOpacity>
          )}
          {isLast ? (
            <TouchableOpacity
              style={[styles.nextBtn, doneDisabled && styles.nextBtnDisabled]}
              onPress={doneDisabled ? undefined : onDone}
              disabled={doneDisabled}
            >
              <Text style={[styles.nextBtnText, doneDisabled && styles.nextBtnTextDisabled]}>
                Done
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.nextBtn} onPress={onNext}>
              <Text style={styles.nextBtnText}>Next →</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGlass,
  },
  headerLabel: {
    color: COLORS.goldLight,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
  },
  skipBtn: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  sceneZone: {
    marginHorizontal: 20,
    marginTop: 20,
    height: 200,
    backgroundColor: COLORS.surfaceSolid,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  textBlock: {
    paddingHorizontal: 20,
    paddingTop: 20,
    flex: 1,
  },
  kicker: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heading: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 28,
    marginBottom: 10,
  },
  body: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 16,
    alignItems: 'center',
    gap: 14,
  },
  navRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: COLORS.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 2,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBtnDisabled: {
    backgroundColor: 'rgba(212,175,55,0.25)',
  },
  nextBtnText: {
    color: COLORS.background,
    fontSize: 14,
    fontWeight: '800',
  },
  nextBtnTextDisabled: {
    color: 'rgba(212,175,55,0.5)',
  },
});
