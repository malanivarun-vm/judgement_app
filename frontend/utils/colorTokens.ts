// Pure color tokens: kept free of React Native imports so game-logic helpers
// can be tested directly in Node.
export const CORE_COLORS = {
  background: '#0A1C13',
  backgroundLight: '#1A4B33',
  backgroundDeep: '#060e09',
  surface: 'rgba(0, 0, 0, 0.4)',
  surfaceGlass: 'rgba(255, 255, 255, 0.05)',
  surfaceSolid: '#0F2B1D',
  text: '#FFFFFF',
  textSecondary: '#A1A1AA',
  gold: '#D4AF37',
  goldLight: '#F3E5AB',
  danger: '#EF4444',
  success: '#10B981',
  info: '#38BDF8',
  suitRed: '#E63946',
  suitBlack: '#1A1A1A',
  borderGlass: 'rgba(255, 255, 255, 0.1)',
  borderAccent: 'rgba(243, 229, 171, 0.3)',
  cardBg: '#FAFAFA',
} as const;

