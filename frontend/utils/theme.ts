export const COLORS = {
  // backgrounds
  background:      '#0A1C13',
  backgroundLight: '#1A4B33',
  backgroundDeep:  '#060e09',
  surface:         'rgba(0, 0, 0, 0.4)',
  surfaceGlass:    'rgba(255, 255, 255, 0.05)',
  surfaceSolid:    '#0F2B1D',
  // text
  text:            '#FFFFFF',
  textSecondary:   '#A1A1AA',
  // gold
  gold:            '#D4AF37',
  goldLight:       '#F3E5AB',
  // semantic
  danger:          '#EF4444',
  success:         '#10B981',
  // suits
  suitRed:         '#E63946',
  suitBlack:       '#1A1A1A',
  // borders
  borderGlass:     'rgba(255, 255, 255, 0.1)',
  borderAccent:    'rgba(243, 229, 171, 0.3)',
  // legacy
  cardBg:          '#FAFAFA',
} as const;

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

