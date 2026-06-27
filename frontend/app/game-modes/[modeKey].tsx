import React, { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { VARIATIONS } from '../../utils/variations';
import { slides as classicSlides } from '../../components/mode-carousels/ClassicSlides';
import { slides as fixedRoundsSlides } from '../../components/mode-carousels/FixedRoundsSlides';
import { slides as trumpCallSlides } from '../../components/mode-carousels/TrumpCallSlides';
import { slides as bidFirstSlides } from '../../components/mode-carousels/BidFirstSlides';
import SlideShell from '../../components/how-to-play/SlideShell';
import { ModeSlide } from '../../components/mode-carousels/types';

const SLIDE_MAP: Record<string, ModeSlide[]> = {
  'v1':   classicSlides,
  'v1.1': fixedRoundsSlides,
  'v2':   trumpCallSlides,
  'v3':   bidFirstSlides,
};

export default function ModeCarouselScreen() {
  const { modeKey } = useLocalSearchParams<{ modeKey: string }>();
  const router = useRouter();
  const [current, setCurrent] = useState(0);

  const slides = SLIDE_MAP[modeKey] ?? classicSlides;
  const variation = VARIATIONS.find((v) => v.key === modeKey);
  const slide = slides[current];
  const isLast = current === slides.length - 1;

  return (
    <SlideShell
      headerLabel="GAME MODES"
      title={variation?.name ?? ''}
      heading={slide.heading}
      body={slide.body}
      scene={slide.scene}
      totalSlides={slides.length}
      currentSlide={current}
      onNext={() => setCurrent((c) => c + 1)}
      onBack={() => setCurrent((c) => Math.max(0, c - 1))}
      onSkip={() => router.back()}
      onDone={() => router.push('/')}
      doneLabel="Let's Play →"
      doneUnlocked={true}
      isLast={isLast}
      isFirst={current === 0}
      lockDone={false}
    />
  );
}
