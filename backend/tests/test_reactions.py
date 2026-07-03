"""Tests for GameRoom.handle_reaction allowlist, rate limit, and payload shape."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from server import GameRoom, REACTIONS, REACTION_COOLDOWN_SECONDS


def make_room():
    room = GameRoom('TEST')
    for pid, name in [('p1', 'Alice'), ('p2', 'Bob')]:
        room.players.append({
            'id': pid,
            'name': name,
            'is_host': pid == 'p1',
            'hand': [],
            'bid': None,
            'has_bid': False,
            'tricks_won': 0,
            'total_score': 0,
            'is_connected': True,
            'offline_since': None,
        })
    return room


def test_allowlist_contains_all_twelve_reactions():
    assert len(REACTIONS) == 12
    assert REACTIONS['fire'] == {'display': '🔥', 'kind': 'emoji'}
    assert REACTIONS['nice_bid'] == {'display': 'Nice bid!', 'kind': 'phrase'}


def test_valid_reaction_returns_broadcast_payload():
    room = make_room()
    payload = room.handle_reaction('p2', 'fire', now=100.0)
    assert payload == {
        'type': 'reaction',
        'player_index': 1,
        'player_name': 'Bob',
        'reaction_id': 'fire',
        'display': '🔥',
        'kind': 'emoji',
    }


def test_unknown_reaction_id_is_dropped():
    room = make_room()
    assert room.handle_reaction('p1', 'not_a_reaction', now=100.0) is None
    assert room.handle_reaction('p1', None, now=100.0) is None


def test_unknown_player_is_dropped():
    room = make_room()
    assert room.handle_reaction('ghost', 'fire', now=100.0) is None


def test_rate_limit_drops_second_reaction_within_cooldown():
    room = make_room()
    assert room.handle_reaction('p1', 'fire', now=100.0) is not None
    assert room.handle_reaction('p1', 'clap', now=100.5) is None
    assert room.handle_reaction('p1', 'clap', now=100.0 + REACTION_COOLDOWN_SECONDS) is not None


def test_rate_limit_is_per_player():
    room = make_room()
    assert room.handle_reaction('p1', 'fire', now=100.0) is not None
    assert room.handle_reaction('p2', 'fire', now=100.1) is not None


def test_dropped_reaction_does_not_consume_cooldown():
    room = make_room()
    assert room.handle_reaction('p1', 'not_a_reaction', now=100.0) is None
    assert room.handle_reaction('p1', 'fire', now=100.1) is not None
