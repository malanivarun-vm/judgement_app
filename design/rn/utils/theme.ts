// rn/utils/theme.ts
// Drop-in replacement for frontend/utils/theme.ts
// Adds CardStyle + CardSizeKey types; all existing exports preserved.

// ─── Colors ──────────────────────────────────────────────────────────────────
export const COLORS = {
  // backgrounds
  background:      '#0A1C13',
  backgroundLight: '#1A4B33',
  backgroundDeep:  '#060e09',
  surface:         'rgba(8,22,15,0.80)',
  surfaceGlass:    'rgba(255,255,255,0.05)',
  surfaceSolid:    '#0C2218',
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
  suitBlack:       '#111827',
  // borders
  borderGlass:     'rgba(255,255,255,0.09)',
  borderAccent:    'rgba(243,229,171,0.25)',
  // legacy aliases (keep for backward-compat)
  cardBg:          '#FFFFFF',
} as const;

// ─── Suits ───────────────────────────────────────────────────────────────────
// ︎ = VARIATION SELECTOR-15: forces text presentation so OEM emoji
// fonts don't substitute colored emoji glyphs for the suit characters.
export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥︎', diamonds: '♦︎', spades: '♠︎', clubs: '♣︎',
};

export const SUIT_COLORS: Record<string, string> = {
  hearts: '#E63946', diamonds: '#E63946',
  spades: '#111827', clubs:    '#111827',
};

/** White for spades/clubs on dark backgrounds */
export const SUIT_DISPLAY_COLORS: Record<string, string> = {
  hearts: '#E63946', diamonds: '#E63946',
  spades: '#FFFFFF', clubs:    '#FFFFFF',
};

// ─── Card sizes ───────────────────────────────────────────────────────────────
export const CARD_SIZES = {
  hand:  { width: 60, height: 86  },
  trick: { width: 50, height: 70  },
  small: { width: 38, height: 54  },
  bid:   { width: 44, height: 62  },
} as const;

export type CardSizeKey = keyof typeof CARD_SIZES;

// ─── Card visual style ────────────────────────────────────────────────────────
/** minimal — rank + large center pip
 *  pips    — real pip positions per rank (A–10) + framed initials for J/Q/K
 *  foil    — warm cream tint + gold border frame + shimmer */
export type CardStyle = 'minimal' | 'pips' | 'foil';

// ─── Typography ───────────────────────────────────────────────────────────────
// NOTE: Load these fonts in your app root (e.g. with expo-font or @expo-google-fonts):
//   @expo-google-fonts/outfit
//   @expo-google-fonts/dm-sans
//   @expo-google-fonts/jetbrains-mono
export const FONTS = {
  heading: 'Outfit_900Black',
  headingBold: 'Outfit_800ExtraBold',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_600SemiBold',
  mono: 'JetBrainsMono_700Bold',
} as const;
