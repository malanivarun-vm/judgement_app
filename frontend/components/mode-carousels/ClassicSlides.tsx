import React from 'react';
import GameStructureScene from '../how-to-play/scenes/GameStructureScene';
import TrumpRotationScene from '../how-to-play/scenes/TrumpRotationScene';
import { ModeSlide } from './types';

export const slides: ModeSlide[] = [
  {
    title: 'THE CLASSIC GAME',
    heading: 'Cards reduce each game. Down to 1.',
    body: 'A session runs through multiple games. The first game deals everyone the maximum number of cards. Each game after, everyone gets one fewer card — until the final game with just 1 card each. Every other rule from How to Play applies exactly.',
    scene: <GameStructureScene />,
  },
  {
    title: 'TRUMP IN CLASSIC',
    heading: 'Trump follows a fixed rotation every game.',
    body: '♥ → ♠ → ♦ → ♣ — then repeats. The trump suit for each game is set before predictions begin. No surprises, no choices.',
    scene: <TrumpRotationScene />,
  },
];
