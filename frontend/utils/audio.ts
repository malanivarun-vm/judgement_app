import { Audio } from 'expo-av';

type SoundName = 'play_card' | 'deal' | 'win_trick' | 'bid_lock';

// Note: To use local assets, replace the nulls with: require('../assets/sounds/play_card.mp3')
const SOUND_FILES: Record<SoundName, any> = {
  play_card: null, 
  deal: null,
  win_trick: null,
  bid_lock: null,
};

class AudioService {
  private sounds: Partial<Record<SoundName, Audio.Sound>> = {};
  private isMuted = false;

  async init() {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });

      // Preload sounds
      for (const [name, file] of Object.entries(SOUND_FILES)) {
        if (file) {
          const { sound } = await Audio.Sound.createAsync(file);
          this.sounds[name as SoundName] = sound;
        }
      }
    } catch (e) {
      console.log('Audio init error:', e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  async play(name: SoundName) {
    if (this.isMuted) return;
    const sound = this.sounds[name];
    if (sound) {
      try {
        await sound.replayAsync();
      } catch (e) {
        console.log(`Failed to play ${name}:`, e);
      }
    } else {
      // Fallback if not loaded
      // console.log(`[AudioService] Played sound: ${name}`);
    }
  }

  async unloadAll() {
    for (const sound of Object.values(this.sounds)) {
      if (sound) {
        await sound.unloadAsync();
      }
    }
    this.sounds = {};
  }
}

export const audioService = new AudioService();
