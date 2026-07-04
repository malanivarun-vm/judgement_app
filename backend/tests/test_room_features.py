import time
from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient

from server import (
    CHAT_COOLDOWN_SECONDS,
    LOBBY_GRACE_SECONDS,
    PACES,
    GameRoom,
    app,
    rooms,
)


def add_players(room: GameRoom, count: int = 3):
    for i in range(count):
        room.players.append({
            'id': f'p{i}',
            'name': f'Player{i}',
            'is_host': i == 0,
            'hand': [],
            'bid': None,
            'has_bid': False,
            'tricks_won': 0,
            'total_score': 0,
            'is_connected': True,
            'offline_since': None,
        })


@pytest.fixture(autouse=True)
def clear_rooms():
    rooms.clear()
    yield
    rooms.clear()


def test_valid_host_token_grants_host_once():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        room_id = created['room_id']
        token = created['host_token']

        host_query = urlencode({
            'player_name': 'Host',
            'player_id': 'host',
            'host_token': token,
        })
        with client.websocket_connect(f'/api/ws/{room_id}?{host_query}') as host_ws:
            host_state = host_ws.receive_json()
            assert host_state['players'][0]['is_host'] is True

            second_query = urlencode({
                'player_name': 'Attacker',
                'player_id': 'attacker',
                'host_token': token,
            })
            with client.websocket_connect(f'/api/ws/{room_id}?{second_query}') as second_ws:
                second_state = second_ws.receive_json()
                attacker = next(p for p in second_state['players'] if p['id'] == 'attacker')
                assert attacker['is_host'] is False


def test_forged_host_token_does_not_grant_host():
    with TestClient(app) as client:
        room_id = client.post('/api/rooms').json()['room_id']
        query = urlencode({
            'player_name': 'Attacker',
            'player_id': 'attacker',
            'host_token': 'forged-token',
        })
        with client.websocket_connect(f'/api/ws/{room_id}?{query}') as ws:
            state = ws.receive_json()
            assert state['players'][0]['is_host'] is False


def test_chat_protocol_acknowledges_delivery_and_rejection():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        query = urlencode({
            'player_name': 'Host',
            'player_id': 'host',
            'host_token': created['host_token'],
        })
        with client.websocket_connect(f"/api/ws/{created['room_id']}?{query}") as ws:
            ws.receive_json()
            ws.send_json({'action': 'chat', 'text': 'hello', 'message_id': 'm1'})
            delivered = ws.receive_json()
            accepted = ws.receive_json()
            assert delivered['type'] == 'chat'
            assert delivered['message_id'] == 'm1'
            assert accepted == {
                'type': 'chat_ack',
                'message_id': 'm1',
                'accepted': True,
            }

            ws.send_json({'action': 'chat', 'text': 'too soon', 'message_id': 'm2'})
            rejected = ws.receive_json()
            assert rejected['type'] == 'chat_ack'
            assert rejected['message_id'] == 'm2'
            assert rejected['accepted'] is False


def test_host_can_set_pace_and_non_host_cannot():
    room = GameRoom('TEST')
    add_players(room)

    assert room.set_pace('p1', 'blitz') == "Only the host can set the table pace"
    assert room.set_pace('p0', 'blitz') is None
    assert room.pace == 'blitz'
    assert room.turn_seconds == PACES['blitz']


def test_start_game_arms_timer_and_timeout_auto_bids():
    room = GameRoom('TEST')
    add_players(room)
    room.start_game()

    assert room.turn_deadline is not None
    assert room.turn_deadline == pytest.approx(time.time() + room.turn_seconds, abs=1)
    current = room.current_player_index
    assert room.players[current]['has_bid'] is False
    assert room.auto_act_current() is None
    assert room.players[current]['has_bid'] is True


def test_chat_returns_delivery_error_during_cooldown():
    room = GameRoom('TEST')
    add_players(room)

    payload, error = room.handle_chat('p0', 'hello', now=100)
    assert error is None
    assert payload['text'] == 'hello'

    payload, error = room.handle_chat('p0', 'too soon', now=100.1)
    assert payload is None
    assert 'wait' in error.lower()

    payload, error = room.handle_chat(
        'p0',
        'ready again',
        now=100 + CHAT_COOLDOWN_SECONDS,
    )
    assert error is None
    assert payload['text'] == 'ready again'


def test_lobby_cleanup_removes_only_expired_offline_players():
    room = GameRoom('TEST')
    add_players(room)
    now = time.time()
    room.players[1]['is_connected'] = False
    room.players[1]['offline_since'] = now - LOBBY_GRACE_SECONDS - 1
    room.players[2]['is_connected'] = False
    room.players[2]['offline_since'] = now - 10

    assert room.prune_lobby_players() is True
    assert [p['id'] for p in room.players] == ['p0', 'p2']
