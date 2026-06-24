import React, { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlideShell from '../components/how-to-play/SlideShell';
import IntroScene from '../components/how-to-play/scenes/IntroScene';
import HandScene from '../components/how-to-play/scenes/HandScene';
import TrumpRotationScene from '../components/how-to-play/scenes/TrumpRotationScene';
import TrickScene from '../components/how-to-play/scenes/TrickScene';
import BidScene from '../components/how-to-play/scenes/BidScene';
import ScoreScene from '../components/how-to-play/scenes/ScoreScene';
import { HAS_SEEN_HOW_TO_PLAY_KEY } from '../utils/variations';

const SLIDES = [
  {
    title: 'Judgement / Oh Hell',
    heading: 'Bid the exact number of tricks you will take.',
    body: 'Every round is a prediction game. Exact bids score. Misses punish.',
    scene: <IntroScene />,
  },
  {
    title: 'The Deal',
    heading: 'You get a hand of cards each round.',
    body: 'Cards dealt = floor(52 ÷ players). The count drops by 1 every round, down to 1-card rounds.',
    scene: <HandScene />,
  },
  {
    title: 'Trump Suits',
    heading: 'Trump rotates every round.',
    body: 'Trump beats any non-trump card. ♥ → ♠ → ♦ → ♣, cycling each round.',
    scene: <TrumpRotationScene />,
  },
  {
    title: 'Playing a Trick',
    heading: 'Lead any card. Follow suit if you can.',
    body: "If you can't follow suit, play trump or any card. Highest trump wins; otherwise highest card of the lead suit wins.",
    scene: <TrickScene />,
  },
  {
    title: 'Bidding',
    heading: 'Predict exactly how many tricks you will win.',
    body: 'Bid clockwise after the deal. The dealer bids last and cannot bid a number that makes total bids equal tricks available.',
    scene: <BidScene />,
  },
  {
    title: 'Scoring',
    heading: 'Exact bids win. Misses punish.',
    body: 'Zero bids are high-risk, high-reward. One trick when you bid zero costs you 25 points.',
    scene: <ScoreScene />,
  },
  {
    title: 'Game Modes',
    heading: 'Four ways to play Judgement.',
    body: 'The host picks a mode before the game starts. Tap below to explore what makes each one different.',
    scene: undefined,
  },
  {
    title: "You're Ready",
    heading: "Time to play.",
    body: 'Bid precisely. Play smart. The table is waiting.',
    scene: undefined,
  },
];

export default function HowToPlayScreen() {
  const router = useRouter();
  const { lockDone: lockDoneParam } = useLocalSearchParams<{ lockDone?: string }>();
  const lockDone = lockDoneParam !== 'false'; // true by default, false only when explicitly passed
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    router.push('/game-modes' as any);
  }, [router]);

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;
  const isModeSlide = current === 6;

  return (
    <SlideShell
      title={slide.title}
      heading={slide.heading}
      body={isModeSlide
        ? slide.body + (isModeSlide ? '' : '')
        : slide.body}
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
