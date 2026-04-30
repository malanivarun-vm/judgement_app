import random
from typing import List, Dict, Optional, Tuple

SUITS = ['hearts', 'spades', 'diamonds', 'clubs']
RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
RANK_VALUES = {rank: i for i, rank in enumerate(RANKS)}
TRUMP_ORDER = ['hearts', 'spades', 'diamonds', 'clubs']
SUIT_SYMBOLS = {'hearts': '♥', 'spades': '♠', 'diamonds': '♦', 'clubs': '♣'}


def create_deck() -> List[Dict]:
    return [{'suit': s, 'rank': r} for s in SUITS for r in RANKS]


def shuffle_and_deal(num_players: int, cards_per_player: int) -> List[List[Dict]]:
    deck = create_deck()
    random.shuffle(deck)
    hands = []
    for i in range(num_players):
        hand = deck[i * cards_per_player:(i + 1) * cards_per_player]
        hand.sort(key=lambda c: (SUITS.index(c['suit']), RANK_VALUES[c['rank']]))
        hands.append(hand)
    return hands


def get_trump_suit(round_number: int) -> str:
    return TRUMP_ORDER[(round_number - 1) % 4]


def get_max_cards(num_players: int) -> int:
    return 52 // num_players


def is_valid_play(card: Dict, hand: List[Dict], lead_suit: Optional[str]) -> bool:
    if lead_suit is None:
        return True
    has_lead_suit = any(c['suit'] == lead_suit for c in hand)
    if has_lead_suit:
        return card['suit'] == lead_suit
    return True


def determine_trick_winner(trick_cards: List[Dict], trump_suit: str) -> int:
    if not trick_cards:
        return -1
    lead_suit = trick_cards[0]['card']['suit']
    best_idx = 0
    best_card = trick_cards[0]['card']
    for i in range(1, len(trick_cards)):
        card = trick_cards[i]['card']
        if _beats(card, best_card, trump_suit, lead_suit):
            best_idx = i
            best_card = card
    return trick_cards[best_idx]['player_index']


def _beats(challenger: Dict, current_best: Dict, trump_suit: str, lead_suit: str) -> bool:
    if challenger['suit'] == trump_suit and current_best['suit'] != trump_suit:
        return True
    if challenger['suit'] != trump_suit and current_best['suit'] == trump_suit:
        return False
    if challenger['suit'] == current_best['suit']:
        return RANK_VALUES[challenger['rank']] > RANK_VALUES[current_best['rank']]
    return False


def calculate_round_score(bid: int, tricks_won: int) -> int:
    if bid == 0:
        return 25 if tricks_won == 0 else -25
    if tricks_won == bid:
        return bid * 10
    return -(bid * 10)


def get_restricted_bids(bids_so_far: List[int], cards_this_round: int) -> List[int]:
    current_total = sum(bids_so_far)
    restricted_bid = cards_this_round - current_total
    if 0 <= restricted_bid <= cards_this_round:
        return [restricted_bid]
    return []
