export type ReactionDef = {
  id: string;
  display: string;
  kind: 'emoji' | 'phrase';
};

export const EMOJI_REACTIONS: ReactionDef[] = [
  { id: 'laugh', display: '😂', kind: 'emoji' },
  { id: 'cry', display: '😭', kind: 'emoji' },
  { id: 'fire', display: '🔥', kind: 'emoji' },
  { id: 'clap', display: '👏', kind: 'emoji' },
  { id: 'scream', display: '😱', kind: 'emoji' },
  { id: 'devil', display: '😈', kind: 'emoji' },
  { id: 'mind_blown', display: '🤯', kind: 'emoji' },
  { id: 'strong', display: '💪', kind: 'emoji' },
];

export const PHRASE_REACTIONS: ReactionDef[] = [
  { id: 'nice_bid', display: 'Nice bid!', kind: 'phrase' },
  { id: 'ouch', display: 'Ouch 💀', kind: 'phrase' },
  { id: 'hurry', display: 'Hurry up! ⏳', kind: 'phrase' },
  { id: 'gg', display: 'GG 🃏', kind: 'phrase' },
];
