export const VARIATIONS = [
  { key: 'v1',  name: 'Classic',      desc: 'Decreasing cards each round' },
  { key: 'v1.1', name: 'Fixed Rounds', desc: 'Same cards every round' },
  { key: 'v2',  name: 'Trump Call',   desc: 'Call trump after half the deal' },
  { key: 'v3',  name: 'Bid First',    desc: 'Highest bidder picks trump' },
] as const;

export type VariationKey = typeof VARIATIONS[number]['key'];

export const SCORE_ROWS = [
  { label: 'Exact bid',            value: '+bid × 10 pts', positive: true },
  { label: 'Miss bid',             value: '−bid × 10 pts', positive: false },
  { label: 'Zero bid, 0 tricks',   value: '+25 pts',       positive: true },
  { label: 'Zero bid, any tricks', value: '−25 pts',       positive: false },
];

export const HAS_SEEN_HOW_TO_PLAY_KEY = 'hasSeenHowToPlay';
