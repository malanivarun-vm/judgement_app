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


def test_existing_seat_requires_private_resume_token():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        query = urlencode({
            'player_name': 'Host',
            'player_id': 'host',
            'host_token': created['host_token'],
        })
        with client.websocket_connect(f"/api/ws/{created['room_id']}?{query}") as ws:
            state = ws.receive_json()
            assert state['resume_token']

            attacker_query = urlencode({
                'player_name': 'Impostor',
                'player_id': 'host',
            })
            with client.websocket_connect(
                f"/api/ws/{created['room_id']}?{attacker_query}"
            ) as attacker:
                error = attacker.receive_json()
                assert error['type'] == 'error'
                assert 'another session' in error['message'].lower()


def test_lobby_reconnect_preserves_creator_as_host():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        initial_query = urlencode({
            'player_name': 'Creator',
            'player_id': 'creator',
            'host_token': created['host_token'],
        })
        with client.websocket_connect(
            f"/api/ws/{created['room_id']}?{initial_query}"
        ) as first_connection:
            initial_state = first_connection.receive_json()
            resume_token = initial_state['resume_token']
            assert initial_state['players'][0]['is_host'] is True

        room = rooms[created['room_id']]
        assert room.players[0]['is_host'] is True
        assert room.players[0]['is_connected'] is False

        resume_query = urlencode({
            'player_name': 'Creator',
            'player_id': 'creator',
            'resume_token': resume_token,
        })
        with client.websocket_connect(
            f"/api/ws/{created['room_id']}?{resume_query}"
        ) as resumed:
            resumed_state = resumed.receive_json()
            creator = next(p for p in resumed_state['players'] if p['id'] == 'creator')
            assert creator['is_host'] is True
            assert creator['is_connected'] is True


def test_creator_reclaims_host_after_active_game_reconnect():
    room = GameRoom('TEST')
    add_players(room)
    room.creator_player_id = 'p0'
    room.phase = 'playing'
    room.players[0]['is_connected'] = False
    room.players[0]['is_host'] = False
    room.players[1]['is_host'] = True
    room.players[0]['resume_token'] = 'creator-secret'
    rooms[room.room_id] = room

    with TestClient(app) as client:
        query = urlencode({
            'player_name': 'Player0',
            'player_id': 'p0',
            'resume_token': 'creator-secret',
        })
        with client.websocket_connect(f'/api/ws/{room.room_id}?{query}') as ws:
            state = ws.receive_json()
            creator = next(p for p in state['players'] if p['id'] == 'p0')
            replacement = next(p for p in state['players'] if p['id'] == 'p1')
            assert creator['is_host'] is True
            assert replacement['is_host'] is False


def test_malformed_bid_does_not_disconnect_socket():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        query = urlencode({
            'player_name': 'Host',
            'player_id': 'host',
            'host_token': created['host_token'],
        })
        with client.websocket_connect(f"/api/ws/{created['room_id']}?{query}") as ws:
            ws.receive_json()
            ws.send_json({'action': 'place_bid', 'bid': 'not-a-number'})
            assert ws.receive_json()['type'] == 'error'
            ws.send_json({'action': 'ping'})
            assert ws.receive_json()['type'] == 'pong'


def test_non_host_cannot_advance_round():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        query = urlencode({
            'player_name': 'Guest',
            'player_id': 'guest',
        })
        with client.websocket_connect(f"/api/ws/{created['room_id']}?{query}") as ws:
            ws.receive_json()
            ws.send_json({'action': 'next_round'})
            error = ws.receive_json()
            assert error['type'] == 'error'
            assert 'only the host' in error['message'].lower()


def test_leave_room_removes_lobby_seat_and_transfers_host():
    with TestClient(app) as client:
        created = client.post('/api/rooms').json()
        host_query = urlencode({
            'player_name': 'Host',
            'player_id': 'host',
            'host_token': created['host_token'],
        })
        guest_query = urlencode({
            'player_name': 'Guest',
            'player_id': 'guest',
        })
        with client.websocket_connect(f"/api/ws/{created['room_id']}?{host_query}") as host:
            host.receive_json()
            with client.websocket_connect(f"/api/ws/{created['room_id']}?{guest_query}") as guest:
                host.receive_json()
                guest.receive_json()
                host.send_json({'action': 'leave_room'})
                assert host.receive_json()['type'] == 'leave_ack'
                state = guest.receive_json()
                assert [p['id'] for p in state['players']] == ['guest']
                assert state['players'][0]['is_host'] is True


def test_dealer_must_bid_one_when_other_bids_equal_cards():
    room = GameRoom('TEST')
    add_players(room)
    room.phase = 'bidding'
    room.cards_this_round = 5
    room.bidding_order = [1, 2, 0]
    room.bidding_position = 2
    room.current_player_index = 0
    room.players[1].update({'bid': 2, 'has_bid': True})
    room.players[2].update({'bid': 3, 'has_bid': True})

    assert 'must bid 1' in room.place_bid('p0', 2).lower()
    assert room.place_bid('p0', 1) is None


def test_v2_blind_draw_card_is_removed_before_second_batch():
    room = GameRoom('TEST')
    add_players(room)
    room.variation = 'v2'
    room.max_cards = 5
    room.dealer_index = 0
    room.current_round = 0
    room.total_rounds = 5
    room._start_round()

    before = len(room.remaining_deck)
    per_player = room.cards_this_round - len(room.players[0]['hand'])
    caller_id = room.players[room.trump_caller_index]['id']
    assert room.call_trump(caller_id, None) is None
    assert len(room.remaining_deck) == before - 1 - per_player * len(room.players)
    assert all(len(player['hand']) == room.cards_this_round for player in room.players)
