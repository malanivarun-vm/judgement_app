// Semantics of a bid mid-round. In Judgement you score only on an exact
// hit, so 'secured' means "on target so far — now avoid extra tricks",
// and any trick beyond the bid is an immediate bust.

import { COLORS } from './theme';

export type BidStatus = 'pending' | 'chasing' | 'secured' | 'busted';

export function bidStatus(bid: number | null, tricksWon: number): BidStatus {
  if (bid === null || bid === undefined) return 'pending';
  if (tricksWon > bid) return 'busted';
  if (tricksWon === bid) return 'secured';
  return 'chasing';
}

export const BID_STATUS_COLORS: Record<BidStatus, string> = {
  pending: COLORS.textSecondary,
  chasing: '#F5B93E',
  secured: COLORS.success,
  busted: COLORS.danger,
};

export const BID_STATUS_LABELS: Record<BidStatus, string> = {
  pending: '',
  chasing: '',
  secured: 'on target',
  busted: 'busted',
};

export function scoreColor(score: number): string {
  return score < 0 ? COLORS.danger : COLORS.goldLight;
}
