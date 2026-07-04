// Fire-and-forget card-flick sound. Browsers block audio until the user
// has interacted with the page; every card play IS a tap for the local
// player, and for remote plays the join/bid taps have already unlocked
// audio, so failures are safely swallowed.

import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const source = require('../assets/sounds/card-flick.wav');

export type SoundPack = 'luxury' | 'indian' | 'minimal' | 'chaotic';

const PACKS: Record<SoundPack, { rate: number; volume: number }> = {
  luxury: { rate: 0.92, volume: 0.72 },
  indian: { rate: 1.08, volume: 0.82 },
  minimal: { rate: 1.0, volume: 0.42 },
  chaotic: { rate: 1.32, volume: 0.88 },
};

export function useTableSound(pack: SoundPack = 'luxury') {
  const cardPlayer = useAudioPlayer(source);
  const accentPlayer = useAudioPlayer(source);
  const layerPlayer = useAudioPlayer(source);
  const settings = PACKS[pack];

  const hit = useCallback((
    player: typeof cardPlayer,
    rate: number,
    volume: number,
  ) => {
    try {
      player.seekTo(0);
      player.playbackRate = Math.max(0.5, Math.min(2, rate));
      player.volume = Math.max(0, Math.min(1, volume));
      player.play();
    } catch {
      // Audio may still be locked by the browser.
    }
  }, []);

  const card = useCallback(() => {
    hit(cardPlayer, settings.rate, settings.volume);
  }, [cardPlayer, hit, settings.rate, settings.volume]);

  const deal = useCallback(() => {
    hit(cardPlayer, settings.rate + 0.14, settings.volume * 0.72);
    setTimeout(() => hit(accentPlayer, settings.rate + 0.28, settings.volume * 0.62), 75);
    setTimeout(() => hit(layerPlayer, settings.rate + 0.4, settings.volume * 0.52), 150);
  }, [accentPlayer, cardPlayer, hit, layerPlayer, settings.rate, settings.volume]);

  const trick = useCallback(() => {
    hit(accentPlayer, settings.rate * 0.72, settings.volume);
    setTimeout(() => hit(layerPlayer, settings.rate * 1.18, settings.volume * 0.7), 85);
  }, [accentPlayer, hit, layerPlayer, settings.rate, settings.volume]);

  const trump = useCallback(() => {
    hit(accentPlayer, settings.rate * 0.58, settings.volume);
    setTimeout(() => hit(layerPlayer, settings.rate * 1.45, settings.volume * 0.82), 95);
  }, [accentPlayer, hit, layerPlayer, settings.rate, settings.volume]);

  return { card, deal, trick, trump };
}

export function useCardSound(): () => void {
  return useTableSound('luxury').card;
}
