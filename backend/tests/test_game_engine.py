"""Test game engine logic functions"""
import pytest
import sys
import os

# Add backend directory to path
sys.path.insert(0, '/app/backend')

from game_engine import (
    create_play_deck,
    shuffle_and_deal,
    get_trump_suit,
    get_max_cards,
    is_valid_play,
    determine_trick_winner,
    calculate_round_score,
    get_restricted_bids,
    SUITS,
    RANKS,
)


class TestShuffleAndDeal:
    """Test card dealing functionality"""

    def test_deal_correct_number_of_hands(self):
        """Test that correct number of hands are dealt"""
        hands = shuffle_and_deal(4, 5)
        assert len(hands) == 4
        print("✓ Correct number of hands dealt")

    def test_deal_correct_cards_per_hand(self):
        """Test that each hand has correct number of cards"""
        hands = shuffle_and_deal(3, 7)
        for hand in hands:
            assert len(hand) == 7
        print("✓ Each hand has correct number of cards")

    def test_deal_no_duplicate_cards(self):
        """Test that no duplicate cards are dealt"""
        hands = shuffle_and_deal(4, 10)
        all_cards = []
        for hand in hands:
            for card in hand:
                card_str = f"{card['rank']}-{card['suit']}"
                assert card_str not in all_cards
                all_cards.append(card_str)
        print("✓ No duplicate cards in dealt hands")

    def test_deal_cards_are_sorted(self):
        """Test that cards in each hand are sorted"""
        hands = shuffle_and_deal(3, 5)
        for hand in hands:
            for i in range(len(hand) - 1):
                curr_suit_idx = SUITS.index(hand[i]['suit'])
                next_suit_idx = SUITS.index(hand[i + 1]['suit'])
                # Either different suit (and current comes first) or same suit
                assert curr_suit_idx <= next_suit_idx
        print("✓ Cards are sorted by suit")

    @pytest.mark.parametrize('num_players', [3, 4, 5, 6, 7])
    def test_play_deck_removes_only_required_twos(self, num_players):
        deck = create_play_deck(num_players)
        removed = 52 % num_players
        assert len(deck) == 52 - removed
        assert sum(card['rank'] == '2' for card in deck) == 4 - removed
        assert len(deck) % num_players == 0


class TestTrumpSuit:
    """Test trump suit rotation"""

    def test_trump_rotation_order(self):
        """Test that trump suit rotates in correct order: hearts, spades, diamonds, clubs"""
        expected = ['hearts', 'spades', 'diamonds', 'clubs']
        for round_num in range(1, 9):
            trump = get_trump_suit(round_num)
            assert trump == expected[(round_num - 1) % 4]
        print("✓ Trump rotation follows correct order")

    def test_trump_round_1(self):
        assert get_trump_suit(1) == 'hearts'
        print("✓ Round 1 trump is hearts")

    def test_trump_round_2(self):
        assert get_trump_suit(2) == 'spades'
        print("✓ Round 2 trump is spades")

    def test_trump_round_3(self):
        assert get_trump_suit(3) == 'diamonds'
        print("✓ Round 3 trump is diamonds")

    def test_trump_round_4(self):
        assert get_trump_suit(4) == 'clubs'
        print("✓ Round 4 trump is clubs")


class TestMaxCards:
    """Test maximum cards calculation"""

    def test_max_cards_3_players(self):
        assert get_max_cards(3) == 17
        print("✓ 3 players: 17 cards max")

    def test_max_cards_4_players(self):
        assert get_max_cards(4) == 13
        print("✓ 4 players: 13 cards max")

    def test_max_cards_5_players(self):
        assert get_max_cards(5) == 10
        print("✓ 5 players: 10 cards max")

    def test_max_cards_6_players(self):
        assert get_max_cards(6) == 8
        print("✓ 6 players: 8 cards max")

    def test_max_cards_7_players(self):
        assert get_max_cards(7) == 7
        print("✓ 7 players: 7 cards max")


class TestValidPlay:
    """Test card play validation (must follow suit)"""

    def test_first_card_always_valid(self):
        """Test that any card is valid when leading"""
        hand = [{'suit': 'hearts', 'rank': '5'}, {'suit': 'spades', 'rank': 'K'}]
        assert is_valid_play({'suit': 'hearts', 'rank': '5'}, hand, None)
        assert is_valid_play({'suit': 'spades', 'rank': 'K'}, hand, None)
        print("✓ Any card valid when leading")

    def test_must_follow_suit_when_possible(self):
        """Test that player must follow suit if they have it"""
        hand = [
            {'suit': 'hearts', 'rank': '5'},
            {'suit': 'hearts', 'rank': '9'},
            {'suit': 'spades', 'rank': 'K'}
        ]
        # Must play hearts if lead is hearts
        assert is_valid_play({'suit': 'hearts', 'rank': '5'}, hand, 'hearts')
        assert not is_valid_play({'suit': 'spades', 'rank': 'K'}, hand, 'hearts')
        print("✓ Must follow suit when possible")

    def test_can_play_any_card_if_no_lead_suit(self):
        """Test that player can play any card if they don't have lead suit"""
        hand = [
            {'suit': 'diamonds', 'rank': '3'},
            {'suit': 'clubs', 'rank': 'A'}
        ]
        # Can play any card if no hearts in hand
        assert is_valid_play({'suit': 'diamonds', 'rank': '3'}, hand, 'hearts')
        assert is_valid_play({'suit': 'clubs', 'rank': 'A'}, hand, 'hearts')
        print("✓ Can play any card if no lead suit")


class TestTrickWinner:
    """Test trick winner determination"""

    def test_highest_trump_wins(self):
        """Test that highest trump card wins the trick"""
        trick = [
            {'player_index': 0, 'card': {'suit': 'hearts', 'rank': '5'}},
            {'player_index': 1, 'card': {'suit': 'spades', 'rank': 'K'}},  # trump
            {'player_index': 2, 'card': {'suit': 'spades', 'rank': 'A'}},  # highest trump
        ]
        winner = determine_trick_winner(trick, 'spades')
        assert winner == 2
        print("✓ Highest trump wins")

    def test_trump_beats_non_trump(self):
        """Test that any trump beats non-trump"""
        trick = [
            {'player_index': 0, 'card': {'suit': 'hearts', 'rank': 'A'}},  # lead, high card
            {'player_index': 1, 'card': {'suit': 'spades', 'rank': '2'}},  # low trump
        ]
        winner = determine_trick_winner(trick, 'spades')
        assert winner == 1
        print("✓ Trump beats non-trump")

    def test_highest_lead_suit_wins_if_no_trump(self):
        """Test that highest card of lead suit wins if no trump played"""
        trick = [
            {'player_index': 0, 'card': {'suit': 'hearts', 'rank': '5'}},
            {'player_index': 1, 'card': {'suit': 'hearts', 'rank': 'K'}},
            {'player_index': 2, 'card': {'suit': 'diamonds', 'rank': 'A'}},  # different suit
        ]
        winner = determine_trick_winner(trick, 'spades')
        assert winner == 1
        print("✓ Highest lead suit wins if no trump")

    def test_first_player_wins_if_others_cant_follow(self):
        """Test that lead player wins if others can't follow and no trump"""
        trick = [
            {'player_index': 0, 'card': {'suit': 'hearts', 'rank': '5'}},
            {'player_index': 1, 'card': {'suit': 'diamonds', 'rank': 'A'}},
            {'player_index': 2, 'card': {'suit': 'clubs', 'rank': 'K'}},
        ]
        winner = determine_trick_winner(trick, 'spades')
        assert winner == 0
        print("✓ Lead player wins if others can't follow")


class TestScoring:
    """Test round score calculation"""

    def test_exact_bid_positive_score(self):
        """Test that exact bid gives bid × 10 points"""
        assert calculate_round_score(3, 3) == 30
        assert calculate_round_score(5, 5) == 50
        assert calculate_round_score(1, 1) == 10
        print("✓ Exact bid gives bid × 10 points")

    def test_missed_bid_negative_score(self):
        """Test that missed bid gives -(bid × 10) points"""
        assert calculate_round_score(3, 2) == -30
        assert calculate_round_score(5, 7) == -50
        assert calculate_round_score(2, 0) == -20
        print("✓ Missed bid gives -(bid × 10) points")

    def test_zero_bid_success(self):
        """Test that successful zero bid gives +25 points"""
        assert calculate_round_score(0, 0) == 25
        print("✓ Zero bid success gives +25 points")

    def test_zero_bid_failure(self):
        """Test that failed zero bid gives -25 points"""
        assert calculate_round_score(0, 1) == -25
        assert calculate_round_score(0, 3) == -25
        print("✓ Zero bid failure gives -25 points")


class TestRestrictedBids:
    """Test dealer bid restriction (total can't equal cards dealt)"""

    def test_no_restriction_when_total_not_equal(self):
        """Test no restriction when bids don't sum to cards dealt"""
        # 3 players bid 2, 1, ? with 5 cards dealt
        # Total so far: 3, need to restrict bid 2 (3+2=5)
        restricted = get_restricted_bids([2, 1], 5)
        assert restricted == [2]
        print("✓ Restricts bid that would make total equal cards")

    def test_restriction_when_would_equal_cards(self):
        """Test restriction when bid would make total equal cards dealt"""
        # 2 players bid 3, 2 with 7 cards dealt
        # Total: 5, dealer can't bid 2 (5+2=7)
        restricted = get_restricted_bids([3, 2], 7)
        assert 2 in restricted
        print("✓ Dealer can't bid value that makes total equal cards")

    def test_no_restriction_if_impossible(self):
        """Test no restriction if the restricted bid is out of range"""
        # 2 players bid 5, 5 with 7 cards dealt
        # Total: 10, would need to bid -3 to equal 7 (impossible)
        restricted = get_restricted_bids([5, 5], 7)
        assert restricted == []
        print("✓ No restriction if calculated bid is out of range")

    def test_zero_bid_can_be_restricted(self):
        """Test that zero bid can be restricted"""
        # 2 players bid 0, 0 with 0 cards dealt (edge case)
        # Total: 0, dealer can't bid 0
        restricted = get_restricted_bids([0, 0], 0)
        assert 0 in restricted
        print("✓ Zero bid can be restricted")

    def test_restriction_3_players_example(self):
        """Test realistic 3-player scenario"""
        # 3 players, 5 cards dealt
        # Player 1 bids 2, Player 2 bids 1
        # Dealer (Player 3) can't bid 2 (2+1+2=5)
        restricted = get_restricted_bids([2, 1], 5)
        assert restricted == [2]
        print("✓ 3-player dealer restriction works correctly")
