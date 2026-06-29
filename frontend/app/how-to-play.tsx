import React, { useState, useCallback } from 'react';
import { useRouter, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SlideShell from '../components/how-to-play/SlideShell';
import ModeCard from '../components/ModeCard';
import IntroScene from '../components/how-to-play/scenes/IntroScene';
import BidScene from '../components/how-to-play/scenes/BidScene';
import CardRankScene from '../components/how-to-play/scenes/CardRankScene';
import TrickScene from '../components/how-to-play/scenes/TrickScene';
import ScoreScene from '../components/how-to-play/scenes/ScoreScene';
import QuickRefScene from '../components/how-to-play/scenes/QuickRefScene';
import { HAS_SEEN_HOW_TO_PLAY_KEY, VARIATIONS } from '../utils/variations';

const SLIDES = [
  {
    title: "WHAT'S THE GOAL?",
    heading: "Predict exactly how many rounds you'll win.",
    body: "Before each game, every player makes a prediction. Hit it exactly — you score. One too many or one too few — you lose points. The player with the most points at the end of the session wins.",
    scene: <IntroScene />,
  },
  {
    title: 'HOW DO YOU WIN A ROUND?',
    heading: 'Play a card. Highest card wins.',
    body: "One player leads with any card. Everyone else plays one card each. The highest card takes all the cards played. That's one round — you'll play as many rounds as you have cards in your hand.",
    scene: <TrickScene />,
  },
  {
    title: 'WHICH CARD IS HIGHEST?',
    heading: 'Ace is highest. 2 is lowest.',
    body: "A > K > Q > J > 10 > 9 > 8 > 7 > 6 > 5 > 4 > 3 > 2. Suit doesn't change rank — unless trump is in play.",
    scene: <CardRankScene />,
  },
  {
    title: 'WHAT IS TRUMP?',
    heading: 'One suit that beats everything else.',
    body: "Every game has a trump suit. Any trump card beats any non-trump card — a 2 of trump beats an Ace of any other suit. No trump played? Highest card of the suit that was led wins.",
    scene: undefined,
  },
  {
    title: 'HOW DO I PREDICT?',
    heading: "Look at your cards. Then call your number.",
    body: "After cards are dealt, every player says how many rounds they think they'll win. Strong cards and good trump mean a higher prediction. The skill is reading your hand and landing exactly on your number — not one more, not one less.",
    scene: <BidScene />,
  },
  {
    title: 'ONE SPECIAL RULE',
    heading: "The dealer can't let everyone break even.",
    body: "The dealer predicts last. They're blocked from any number that would make all predictions add up to exactly the number of rounds in the game. At least one player is always wrong.",
    scene: undefined,
  },
  {
    title: 'HOW DO POINTS WORK?',
    heading: 'Exact prediction = points. Wrong prediction = penalty.',
    body: 'Nail your prediction → earn points. Miss → lose points. Predict zero and win zero rounds → big bonus. Predict zero and win even one → big penalty.',
    scene: <ScoreScene />,
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
    body: 'The host picks a mode before the game starts. Tap any mode to learn what makes it different.',
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

  const slide = SLIDES[current];
  const isLast = current === SLIDES.length - 1;

  const modeCards = isLast
    ? VARIATIONS.map((v) => (
        <ModeCard
          key={v.key}
          modeKey={v.key}
          name={v.name}
          desc={v.desc}
          isDefault={v.key === 'v1'}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push(`/game-modes/${v.key}` as any)}
        />
      ))
    : null;

  return (
    <SlideShell
      title={slide.title}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={SLIDES.length}
      currentSlide={current}
      onNext={advance}
      onBack={back}
      onSkip={exit}
      onDone={exit}
      doneLabel="Let's Play →"
      doneUnlocked={maxSeen >= SLIDES.length - 1}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={lockDone}
    >
      {modeCards}
    </SlideShell>
  );
}
