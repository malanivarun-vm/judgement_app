export const COLORS = {
  background: '#0A1C13',
  backgroundLight: '#1A4B33',
  surface: 'rgba(0, 0, 0, 0.4)',
  surfaceGlass: 'rgba(255, 255, 255, 0.05)',
  surfaceSolid: '#0F2B1D',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  gold: '#D4AF37',
  goldLight: '#F3E5AB',
  danger: '#EF4444',
  success: '#10B981',
  borderGlass: 'rgba(255, 255, 255, 0.1)',
  borderAccent: 'rgba(243, 229, 171, 0.3)',
  cardBg: '#FAFAFA',
  suitRed: '#E63946',
  suitBlack: '#1A1A1A',
};

export const SUIT_SYMBOLS: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
};

export const SUIT_COLORS: Record<string, string> = {
  hearts: COLORS.suitRed,
  diamonds: COLORS.suitRed,
  spades: COLORS.suitBlack,
  clubs: COLORS.suitBlack,
};

export const SUIT_DISPLAY_COLORS: Record<string, string> = {
  hearts: COLORS.suitRed,
  diamonds: COLORS.suitRed,
  spades: '#FFFFFF',
  clubs: '#FFFFFF',
};

export const CARD_SIZES = {
  hand: { width: 52, height: 74 },
  trick: { width: 44, height: 62 },
  small: { width: 32, height: 46 },
};
