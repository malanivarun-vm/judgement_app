import time
import pytest
from server import GameRoom, FORCE_GRACE_SECONDS


def make_room(n=3):
    room = GameRoom("TEST")
    for i in range(n):
        room.players.append({
            'id': f'p{i}', 'name': f'Player{i}', 'is_host': i == 0,
            'hand': [], 'bid': None, 'has_bid': False,
            'tricks_won': 0, 'total_score': 0,
            'is_connected': True, 'offline_since': None,
        })
    room.start_game()
    return room


def disconnect(room, idx, seconds_ago=FORCE_GRACE_SECONDS + 1):
    room.players[idx]['is_connected'] = False
    room.players[idx]['offline_since'] = time.time() - seconds_ago


def test_force_action_rejects_non_host():
    room = make_room()
    disconnect(room, room.current_player_index)
    assert room.force_action('p1') == "Only the host can act for an offline player"


def test_force_action_rejects_connected_target():
    room = make_room()
    err = room.force_action('p0')
    assert err == "Current player is not offline"


def test_force_action_rejects_within_grace():
    room = make_room()
    disconnect(room, room.current_player_index, seconds_ago=2)
    err = room.force_action('p0')
    assert "wait" in err.lower()


def test_force_action_places_bid_for_offline_player():
    room = make_room()
    idx = room.current_player_index
    disconnect(room, idx)
    assert room.phase == 'bidding'
    assert room.force_action('p0') is None
    assert room.players[idx]['has_bid'] is True
    assert room.players[idx]['bid'] is not None


def test_force_action_respects_dealer_restriction():
    room = make_room()
    # Non-dealer bids sum to exactly cards_this_round, so the dealer's
    # restricted bid is 0 — the forced bid must then be 1, not 0.
    non_dealers = room.bidding_order[:-1]
    for pos, i in enumerate(non_dealers):
        pid = room.players[i]['id']
        bid = room.cards_this_round if pos == 0 else 0
        assert room.place_bid(pid, bid) is None
    dealer_idx = room.bidding_order[-1]
    disconnect(room, dealer_idx)
    assert room.force_action('p0') is None
    # Dealer restriction: total bids must not equal cards dealt
    total = sum(p['bid'] for p in room.players)
    assert total != room.cards_this_round


def test_force_action_plays_valid_card():
    room = make_room()
    for i in room.bidding_order:
        assert room.place_bid(room.players[i]['id'], 0 if i != room.bidding_order[-1] else 1) is None
    assert room.phase == 'playing'
    idx = room.current_player_index
    hand_before = len(room.players[idx]['hand'])
    disconnect(room, idx)
    assert room.force_action('p0') is None
    assert len(room.players[idx]['hand']) == hand_before - 1
    assert len(room.current_trick) == 1


def test_force_action_calls_trump_v2():
    room = GameRoom("TEST")
    for i in range(3):
        room.players.append({
            'id': f'p{i}', 'name': f'Player{i}', 'is_host': i == 0,
            'hand': [], 'bid': None, 'has_bid': False,
            'tricks_won': 0, 'total_score': 0,
            'is_connected': True, 'offline_since': None,
        })
    room.variation = 'v2'
    room.start_game()
    assert room.phase == 'trump_selection'
    disconnect(room, room.trump_caller_index)
    assert room.force_action('p0') is None
    assert room.trump_suit in ('hearts', 'spades', 'diamonds', 'clubs')
    assert room.phase == 'bidding'


def test_force_action_calls_trump_v3():
    room = GameRoom("TEST")
    for i in range(3):
        room.players.append({
            'id': f'p{i}', 'name': f'Player{i}', 'is_host': i == 0,
            'hand': [], 'bid': None, 'has_bid': False,
            'tricks_won': 0, 'total_score': 0,
            'is_connected': True, 'offline_since': None,
        })
    room.variation = 'v3'
    room.start_game()
    assert room.phase == 'bidding'
    # Complete bidding: all players must bid
    for idx in room.bidding_order:
        pid = room.players[idx]['id']
        bid = 1 if idx == room.bidding_order[-1] else 0
        assert room.place_bid(pid, bid) is None
    # After bidding completes, phase should be 'trump_selection_v3'
    assert room.phase == 'trump_selection_v3'
    # Disconnect the trump caller (highest bidder)
    disconnect(room, room.trump_caller_index)
    assert room.force_action('p0') is None
    assert room.trump_suit in ('hearts', 'spades', 'diamonds', 'clubs')
    assert room.phase == 'playing'


def test_state_includes_offline_fields():
    room = make_room()
    disconnect(room, 1, seconds_ago=20)
    state = room.get_state_for_player('p0')
    assert state['force_grace_seconds'] == FORCE_GRACE_SECONDS
    assert state['players'][1]['offline_for'] == pytest.approx(20, abs=2)
    assert state['players'][0]['offline_for'] is None
