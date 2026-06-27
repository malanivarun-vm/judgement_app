import React from 'react';
import IntroScene from '../how-to-play/scenes/IntroScene';
import { ModeSlide } from './types';

export const slides: ModeSlide[] = [
  {
    title: 'Classic',
    heading: 'This is the standard game.',
    body: 'Everything you learned in How to Play applies here. Cards decrease each session, trump rotates, predict exactly. No surprises.',
    scene: <IntroScene />,
  },
];
