export const VARIATIONS = [
  { key: 'v1',   name: 'Classic',          desc: 'Decreasing cards each session' },
  { key: 'v1.1', name: 'Fixed Sessions',   desc: 'Same cards every session' },
  { key: 'v2',   name: 'Trump Call',       desc: 'Call trump after half the deal' },
  { key: 'v3',   name: 'Prediction First', desc: 'Highest prediction picks trump' },
] as const;

export type VariationKey = typeof VARIATIONS[number]['key'];

export const SCORE_ROWS = [
  { label: 'Exact prediction',           value: '+prediction × 10 pts', positive: true  },
  { label: 'Miss prediction',            value: '−prediction × 10 pts', positive: false },
  { label: 'Zero prediction, 0 rounds',  value: '+25 pts',              positive: true  },
  { label: 'Zero prediction, any rounds',value: '−25 pts',              positive: false },
];

export const HAS_SEEN_HOW_TO_PLAY_KEY = 'hasSeenHowToPlay';
