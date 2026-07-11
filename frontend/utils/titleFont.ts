// Names the game is known by, in home-screen cycle order.
export const TITLE_NAMES = ['Judgement', 'Kachuful', 'Oh Hell!'];

const LONGEST_NAME_LENGTH = 9; // "Judgement"
const LETTER_SPACING = 2; // must match styles.title in app/index.tsx
const CHAR_WIDTH_RATIO = 0.7; // approx glyph width per fontSize unit for the bold serif face
const MAX_FONT_SIZE = 52;
const MIN_FONT_SIZE = 28;
const HORIZONTAL_CHROME = 104; // container paddingHorizontal (28*2=56) + heroPanel paddingHorizontal (20*2=40) + 8 safety margin

// Android's adjustsFontSizeToFit ignores letterSpacing, so the title must be
// pre-sized to fit the longest name instead of relying on auto-shrink.
export function titleFontSize(windowWidth: number): number {
  const available = windowWidth - HORIZONTAL_CHROME;
  const fit = (available / LONGEST_NAME_LENGTH - LETTER_SPACING) / CHAR_WIDTH_RATIO;
  return Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, Math.floor(fit)));
}
