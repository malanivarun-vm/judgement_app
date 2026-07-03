// Fire-and-forget card-flick sound. Browsers block audio until the user
// has interacted with the page; every card play IS a tap for the local
// player, and for remote plays the join/bid taps have already unlocked
// audio, so failures are safely swallowed.

import { useCallback } from 'react';
import { useAudioPlayer } from 'expo-audio';

const source = require('../assets/sounds/card-flick.wav');

export function useCardSound(): () => void {
  const player = useAudioPlayer(source);
  // Memoized: this callback goes into the WebSocket connect effect's
  // dependency array — an unstable identity would reconnect every render.
  return useCallback(() => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // audio not unlocked yet or unsupported — silent no-op
    }
  }, [player]);
}
