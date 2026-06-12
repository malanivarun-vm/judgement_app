import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { theme } from '../utils/theme';
import { LinearGradient } from 'expo-linear-gradient';
import Reanimated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { PlayingCard } from './PlayingCard';

const SCORE_ROWS = [
  { label: 'Exact bid',            value: '+bid × 10 pts', positive: true },
  { label: 'Miss bid',             value: '−bid × 10 pts', positive: false },
  { label: 'Zero bid, 0 tricks',   value: '+25 pts',       positive: true },
  { label: 'Zero bid, any tricks', value: '−25 pts',       positive: false },
];

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function HowToPlayModal({ visible, onClose }: Props) {
  const [step, setStep] = useState(0);
  const { width } = useWindowDimensions();

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else {
      setStep(0);
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <Reanimated.View key="s0" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.stepTitle}>The Goal</Text>
            <Text style={styles.stepDesc}>
              Judgement is a game of exact prediction. Before each round, you look at your hand and bid exactly how many tricks you think you'll win.
            </Text>
            <View style={styles.demoBox}>
              <View style={styles.bidDemo}>
                <Text style={styles.demoLabel}>YOUR BID</Text>
                <Text style={styles.demoValue}>2</Text>
              </View>
              <Text style={{color: theme.gold, fontSize: 24}}>=</Text>
              <View style={styles.bidDemo}>
                <Text style={styles.demoLabel}>WON TRICKS</Text>
                <Text style={styles.demoValue}>2</Text>
              </View>
            </View>
            <Text style={styles.stepDesc}>
              Hit your exact bid, and you win big points. Miss by even one trick, and you lose points!
            </Text>
          </Reanimated.View>
        );
      case 1:
        return (
          <Reanimated.View key="s1" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Playing Tricks</Text>
            <Text style={styles.stepDesc}>
              Players take turns playing one card to the center. The highest card of the led suit wins. You must follow suit if you have one.
            </Text>
            <View style={styles.demoBoxCenter}>
              <View style={{flexDirection: 'row', gap: -20}}>
                <View style={{transform: [{rotate: '-15deg'}]}}><PlayingCard card={{suit: 'H', rank: '5'}} size="md" /></View>
                <View style={{transform: [{translateY: -10}], zIndex: 2, borderWidth: 2, borderColor: theme.goldBright, borderRadius: 8}}>
                  <PlayingCard card={{suit: 'H', rank: 'K'}} size="md" />
                  <View style={styles.winnerBadge}><Text style={styles.winnerBadgeText}>WINNER</Text></View>
                </View>
                <View style={{transform: [{rotate: '15deg'}]}}><PlayingCard card={{suit: 'H', rank: '8'}} size="md" /></View>
              </View>
            </View>
          </Reanimated.View>
        );
      case 2:
        return (
          <Reanimated.View key="s2" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Trump Suits</Text>
            <Text style={styles.stepDesc}>
              One suit is designated as the "Trump" suit for the round. A Trump card automatically beats any non-trump card, even an Ace!
            </Text>
            <View style={styles.demoBoxCenter}>
              <Text style={{color: theme.goldLight, fontWeight: '800', marginBottom: 16}}>TRUMP IS SPADES (♠)</Text>
              <View style={{flexDirection: 'row', gap: 20, alignItems: 'center'}}>
                <PlayingCard card={{suit: 'H', rank: 'A'}} size="md" />
                <Text style={{color: theme.rose, fontSize: 24, fontWeight: '900'}}>LOSES TO</Text>
                <View style={{borderWidth: 2, borderColor: theme.goldBright, borderRadius: 8}}>
                  <PlayingCard card={{suit: 'S', rank: '2'}} size="md" />
                  <View style={styles.winnerBadge}><Text style={styles.winnerBadgeText}>WINNER</Text></View>
                </View>
              </View>
            </View>
          </Reanimated.View>
        );
      case 3:
        return (
          <Reanimated.View key="s3" entering={FadeInRight} exiting={FadeOutLeft} style={styles.stepContent}>
            <Text style={styles.stepTitle}>Scoring</Text>
            <View style={styles.scoreTable}>
              {SCORE_ROWS.map((row, i) => (
                <View key={row.label} style={[styles.scoreRow, i < SCORE_ROWS.length - 1 && styles.scoreRowBorder]}>
                  <Text style={styles.scoreLabel}>{row.label}</Text>
                  <Text style={[styles.scoreValue, row.positive ? styles.positive : styles.negative]}>
                    {row.value}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.stepDesc}>
              The dealer bids last, and is restricted: the total sum of bids cannot equal the total tricks available. Someone must fail!
            </Text>
          </Reanimated.View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'} onRequestClose={onClose}>
      <LinearGradient colors={[theme.feltDeep, '#060e09']} style={styles.safe}>
        <SafeAreaView style={styles.safe}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>HOW TO PLAY</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressRow}>
            {[0, 1, 2, 3].map(i => (
              <View key={i} style={[styles.progressDot, step >= i && styles.progressDotActive]} />
            ))}
          </View>

          <View style={styles.contentWrap}>
            {renderStepContent()}
          </View>

          <View style={styles.footer}>
            {step > 0 ? (
              <TouchableOpacity style={styles.navBtnOutline} onPress={handlePrev}>
                <Text style={styles.navBtnOutlineText}>Back</Text>
              </TouchableOpacity>
            ) : <View style={{flex: 1}} />}
            
            <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
              <Text style={styles.navBtnText}>{step === 3 ? "Let's Play" : "Next"}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    color: theme.goldLight,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 2,
  },
  closeBtn: {
    color: theme.ivory,
    fontSize: 18,
    opacity: 0.5,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 24,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressDotActive: {
    backgroundColor: theme.gold,
  },
  contentWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: theme.ivory,
    fontSize: 32,
    fontWeight: '900',
    marginBottom: 16,
  },
  stepDesc: {
    color: 'rgba(245,241,230,0.7)',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 32,
  },
  demoBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  demoBoxCenter: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    marginBottom: 32,
  },
  bidDemo: {
    alignItems: 'center',
  },
  demoLabel: {
    color: theme.goldDim,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
  demoValue: {
    color: theme.ivory,
    fontSize: 48,
    fontWeight: '900',
  },
  winnerBadge: {
    position: 'absolute',
    bottom: -10,
    left: -10,
    right: -10,
    backgroundColor: theme.gold,
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center',
  },
  winnerBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  scoreTable: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    overflow: 'hidden',
    marginBottom: 32,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scoreRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  scoreLabel: {
    color: theme.ivory,
    fontSize: 14,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  positive: {
    color: theme.goldLight,
  },
  negative: {
    color: theme.rose,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    gap: 16,
  },
  navBtn: {
    flex: 1,
    backgroundColor: theme.gold,
    paddingVertical: 16,
    borderRadius: 99,
    alignItems: 'center',
  },
  navBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  navBtnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 16,
    borderRadius: 99,
    alignItems: 'center',
  },
  navBtnOutlineText: {
    color: theme.ivory,
    fontSize: 16,
    fontWeight: '800',
  },
});
