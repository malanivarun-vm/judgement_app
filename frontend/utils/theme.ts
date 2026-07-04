import { CORE_COLORS } from './colorTokens';

export const COLORS = CORE_COLORS;

// ︎ = VARIATION SELECTOR-15: forces text presentation so OEM emoji
// fonts don't substitute colored emoji glyphs for the suit characters.
export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥︎',
  diamonds: '♦︎',
  spades: '♠︎',
  clubs: '♣︎',
};

export const SUIT_COLORS: Record<string, string> = {
  hearts:   COLORS.suitRed,
  diamonds: COLORS.suitRed,
  spades:   COLORS.suitBlack,
  clubs:    COLORS.suitBlack,
};

export const SUIT_DISPLAY_COLORS: Record<string, string> = {
  hearts:   COLORS.suitRed,
  diamonds: COLORS.suitRed,
  spades:   '#FFFFFF',
  clubs:    '#FFFFFF',
};

export const CARD_SIZES = {
  hand:  { width: 52, height: 74  },
  trick: { width: 44, height: 62  },
  small: { width: 32, height: 46  },
  bid:   { width: 44, height: 62  },
} as const;

export type CardSizeKey = keyof typeof CARD_SIZES;

/** minimal — rank + large center pip
 *  pips    — real pip positions per rank
 *  foil    — warm cream tint + gold border frame */
export type CardStyle = 'minimal' | 'pips' | 'foil';

// Load via expo-font or @expo-google-fonts in _layout.tsx
export const FONTS = {
  heading:     'Outfit_900Black',
  headingBold: 'Outfit_800ExtraBold',
  body:        'DMSans_400Regular',
  bodyMedium:  'DMSans_600SemiBold',
  mono:        'JetBrainsMono_700Bold',
} as const;

// Cinematic display serif for the casino-luxe look (wordmarks, overlay
// titles). System serif stacks — zero extra font payload on any platform.
import { Platform } from 'react-native';

export const SERIF = Platform.select({
  web: 'Georgia, "Palatino Linotype", "Book Antiqua", "Times New Roman", serif',
  ios: 'Georgia',
  default: 'serif',
}) as string;

export const SERIF_ITALIC_STYLE = { fontFamily: SERIF, fontStyle: 'italic' as const };

