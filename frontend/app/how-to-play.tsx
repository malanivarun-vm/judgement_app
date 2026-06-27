import React, { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlideShell from '../components/how-to-play/SlideShell';
import IntroScene from '../components/how-to-play/scenes/IntroScene';
import GameStructureScene from '../components/how-to-play/scenes/GameStructureScene';
import BidScene from '../components/how-to-play/scenes/BidScene';
import CardRankScene from '../components/how-to-play/scenes/CardRankScene';
import TrumpRotationScene from '../components/how-to-play/scenes/TrumpRotationScene';
import TrickScene from '../components/how-to-play/scenes/TrickScene';
import ScoreScene from '../components/how-to-play/scenes/ScoreScene';
import QuickRefScene from '../components/how-to-play/scenes/QuickRefScene';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';

const SLIDES = [
  {
    title: "WHAT'S THE GOAL?",
    heading: "Predict exactly how many rounds you'll win.",
    body: "Every player declares their prediction before play. Hit it exactly and you score. Miss it and you don't. The player with the most points at the end of the game wins.",
    scene: <IntroScene />,
  },
  {
    title: 'HOW IS A GAME STRUCTURED?',
    heading: 'Game → Sessions → Rounds.',
    body: 'A game runs through multiple sessions. Each session deals a fixed number of cards — starting at the maximum, dropping by 1 each session down to 1. Inside each session everyone plays as many rounds as they have cards. If 52 doesn\'t divide evenly among players, the extra cards are set aside and not used.',
    scene: <GameStructureScene />,
  },
  {
    title: 'HOW DO I MAKE A PREDICTION?',
    heading: "Before each session, predict how many rounds you'll win.",
    body: "All players declare after seeing their cards. The goal is to match your prediction exactly — not exceed it, not fall short.",
    scene: <BidScene />,
  },
  {
    title: 'HOW DO CARDS RANK?',
    heading: 'Ace is high. 2 is low.',
    body: "A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2. Suit doesn't affect rank — except when trump changes everything.",
    scene: <CardRankScene />,
  },
  {
    title: 'WHAT IS THE TRUMP SUIT?',
    heading: 'Trump beats every other suit.',
    body: 'One suit is designated trump each session. Any trump card beats any non-trump card regardless of rank. In Classic mode trump rotates every session: ♥ → ♠ → ♦ → ♣.',
    scene: <TrumpRotationScene />,
  },
  {
    title: 'HOW DO I WIN A ROUND?',
    heading: 'Lead any card. Follow suit if you can.',
    body: "Can't follow suit? Play trump or any card. Highest trump wins. No trump played? Highest card of the lead suit wins.",
    scene: <TrickScene />,
  },
  {
    title: 'HOW DOES SCORING WORK?',
    heading: 'Exact predictions score. Misses punish.',
    body: 'Hit your prediction exactly — earn points. Miss — lose points. Predict zero and take no rounds for a big bonus.',
    scene: <ScoreScene />,
  },
  {
    title: 'WHAT SPECIAL RULES SHOULD I KNOW?',
    heading: "The dealer can't let everyone break even.",
    body: "The dealer predicts last and is blocked from any number that would make total predictions equal the rounds in that session. Someone has to be wrong.",
    scene: undefined,
  },
  {
    title: 'QUICK REFERENCE',
    heading: 'Keep this handy.',
    body: '',
    scene: <QuickRefScene />,
  },
  {
    title: "YOU'RE READY",
    heading: 'Four ways to play Judgement.',
    body: 'The host picks a mode before the game starts. Tap below to explore what makes each one different.',
    scene: undefined,
  },
];

export default function HowToPlayScreen() {
  const router = useRouter();
  const { lockDone: lockDoneParam } = useLocalSearchParams<{ lockDone?: string }>();
  const lockDone = lockDoneParam !== 'false';
  const [current, setCurrent] = useState(0);
  const [maxSeen, setMaxSeen] = useState(0);

  const advance = useCallback(() => {
    const next = current + 1;
    setCurrent(next);
    setMaxSeen((prev) => Math.max(prev, next));
  }, [current]);

  const back = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);

  const exit = useCallback(async () => {
    await AsyncStorage.setItem(HAS_SEEN_HOW_TO_PLAY_KEY, 'true');
    router.back();
  }, [router]);

  const goToModes = useCallback(() => {
    advance();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/game-modes' as any);
  }, [advance, router]);

  const slide = SLIDES[current];
  const isModeSlide = current === 9;
  // Suppress Done button on the mode slide so "Next →" fires goToModes instead.
  const isLast = current === SLIDES.length - 1 && !isModeSlide;

  return (
    <SlideShell
      title={slide.title}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={SLIDES.length}
      currentSlide={current}
      onNext={isModeSlide ? goToModes : advance}
      onBack={back}
      onSkip={exit}
      onDone={exit}
      doneUnlocked={maxSeen >= SLIDES.length - 1}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={lockDone}
    />
  );
}
