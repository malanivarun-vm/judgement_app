from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import os
import logging
import json
import uuid
import random
import string
from pathlib import Path
from pydantic import BaseModel
from typing import Dict, List, Optional
from game_engine import (
    shuffle_and_deal, get_trump_suit, get_max_cards,
    is_valid_play, determine_trick_winner, calculate_round_score,
    get_restricted_bids, SUITS
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# In-memory game rooms
rooms: Dict[str, 'GameRoom'] = {}


class GameRoom:
    def __init__(self, room_id: str):
        self.room_id = room_id
        self.players: List[Dict] = []
        self.connections: Dict[str, WebSocket] = {}
        self.phase = 'waiting'
        self.current_round = 0
        self.total_rounds = 0
        self.cards_this_round = 0
        self.trump_suit: Optional[str] = None
        self.dealer_index = -1
        self.current_player_index = -1
        self.current_trick: List[Dict] = []
        self.lead_suit: Optional[str] = None
        self.tricks_played = 0
        self.max_cards = 0
        self.round_history: List[Dict] = []
        self.bidding_order: List[int] = []
        self.bidding_position = 0
        self.last_completed_trick: Optional[Dict] = None

    def get_state_for_player(self, player_id: str) -> Dict:
        player = next((p for p in self.players if p['id'] == player_id), None)
        my_index = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)

        players_info = []
        for p in self.players:
            players_info.append({
                'id': p['id'],
                'name': p['name'],
                'is_host': p['is_host'],
                'bid': p.get('bid'),
                'tricks_won': p.get('tricks_won', 0),
                'total_score': p.get('total_score', 0),
                'card_count': len(p.get('hand', [])),
                'is_connected': p.get('is_connected', True),
                'has_bid': p.get('has_bid', False),
            })

        restricted_bids = []
        if self.phase == 'bidding' and my_index == self.bidding_order[-1] if self.bidding_order else False:
            bids_so_far = [
                self.players[i]['bid'] for i in self.bidding_order[:-1]
                if self.players[i].get('has_bid')
            ]
            restricted_bids = get_restricted_bids(bids_so_far, self.cards_this_round)

        return {
            'type': 'state',
            'room_id': self.room_id,
            'phase': self.phase,
            'players': players_info,
            'your_id': player_id,
            'your_index': my_index,
            'your_hand': player.get('hand', []) if player else [],
            'current_round': self.current_round,
            'total_rounds': self.total_rounds,
            'cards_this_round': self.cards_this_round,
            'trump_suit': self.trump_suit,
            'dealer_index': self.dealer_index,
            'current_player_index': self.current_player_index,
            'current_trick': [
                {'player_index': tc['player_index'], 'card': tc['card']}
                for tc in self.current_trick
            ],
            'lead_suit': self.lead_suit,
            'tricks_played': self.tricks_played,
            'round_history': self.round_history,
            'restricted_bids': restricted_bids,
            'last_completed_trick': self.last_completed_trick,
        }

    async def broadcast_state(self):
        for pid, ws in list(self.connections.items()):
            try:
                state = self.get_state_for_player(pid)
                await ws.send_json(state)
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")

    def start_game(self):
        num_players = len(self.players)
        self.max_cards = get_max_cards(num_players)
        self.total_rounds = self.max_cards
        self.dealer_index = random.randint(0, num_players - 1)
        for p in self.players:
            p['total_score'] = 0
        self.round_history = []
        self.current_round = 0
        self._start_round()

    def _start_round(self):
        self.current_round += 1
        n = len(self.players)
        self.cards_this_round = self.max_cards - (self.current_round - 1)
        self.trump_suit = get_trump_suit(self.current_round)

        hands = shuffle_and_deal(n, self.cards_this_round)
        for i, p in enumerate(self.players):
            p['hand'] = hands[i]
            p['bid'] = None
            p['has_bid'] = False
            p['tricks_won'] = 0

        self.bidding_order = [(self.dealer_index + 1 + i) % n for i in range(n)]
        self.bidding_position = 0
        self.current_player_index = self.bidding_order[0]
        self.current_trick = []
        self.lead_suit = None
        self.tricks_played = 0
        self.last_completed_trick = None
        self.phase = 'bidding'

    def place_bid(self, player_id: str, bid: int) -> Optional[str]:
        idx = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if idx == -1:
            return "Player not found"
        if self.phase != 'bidding':
            return "Not in bidding phase"
        if idx != self.current_player_index:
            return "Not your turn to bid"
        if self.players[idx].get('has_bid'):
            return "Already placed bid"
        if bid < 0 or bid > self.cards_this_round:
            return "Invalid bid value"

        # Dealer restriction (last bidder)
        if idx == self.bidding_order[-1]:
            bids_so_far = [self.players[i]['bid'] for i in self.bidding_order[:-1]]
            restricted = get_restricted_bids(bids_so_far, self.cards_this_round)
            if bid in restricted:
                return f"Cannot bid {bid} (total would equal cards dealt)"

        self.players[idx]['bid'] = bid
        self.players[idx]['has_bid'] = True

        self.bidding_position += 1
        if self.bidding_position >= len(self.players):
            self.phase = 'playing'
            self.current_player_index = (self.dealer_index + 1) % len(self.players)
        else:
            self.current_player_index = self.bidding_order[self.bidding_position]

        return None

    def play_card(self, player_id: str, card: Dict) -> Optional[str]:
        idx = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if idx == -1:
            return "Player not found"
        if self.phase != 'playing':
            return "Not in playing phase"
        if idx != self.current_player_index:
            return "Not your turn"

        player = self.players[idx]
        hand = player['hand']

        card_in_hand = next(
            (c for c in hand if c['suit'] == card['suit'] and c['rank'] == card['rank']),
            None
        )
        if not card_in_hand:
            return "Card not in your hand"

        lead = self.current_trick[0]['card']['suit'] if self.current_trick else None
        if not is_valid_play(card, hand, lead):
            return "Must follow suit"

        hand.remove(card_in_hand)

        if not self.current_trick:
            self.lead_suit = card['suit']
            self.last_completed_trick = None

        self.current_trick.append({'player_index': idx, 'card': card})

        if len(self.current_trick) == len(self.players):
            winner_idx = determine_trick_winner(self.current_trick, self.trump_suit)
            self.players[winner_idx]['tricks_won'] += 1
            self.tricks_played += 1

            self.last_completed_trick = {
                'cards': [
                    {'player_index': tc['player_index'], 'card': tc['card']}
                    for tc in self.current_trick
                ],
                'winner_index': winner_idx,
                'winner_name': self.players[winner_idx]['name'],
            }

            if self.tricks_played >= self.cards_this_round:
                self._end_round()
            else:
                self.current_trick = []
                self.lead_suit = None
                self.current_player_index = winner_idx
        else:
            self.current_player_index = (idx + 1) % len(self.players)

        return None

    def _end_round(self):
        round_scores = {}
        for p in self.players:
            score = calculate_round_score(p['bid'], p['tricks_won'])
            p['total_score'] += score
            round_scores[p['id']] = {
                'name': p['name'],
                'bid': p['bid'],
                'tricks_won': p['tricks_won'],
                'round_score': score,
                'total_score': p['total_score'],
            }

        self.round_history.append({
            'round': self.current_round,
            'trump': self.trump_suit,
            'cards': self.cards_this_round,
            'scores': round_scores,
        })

        self.current_trick = []

        if self.current_round >= self.total_rounds:
            self.phase = 'game_over'
        else:
            self.phase = 'round_end'
            self.dealer_index = (self.dealer_index + 1) % len(self.players)

    def next_round(self):
        if self.phase == 'round_end':
            self._start_round()


def generate_room_id() -> str:
    while True:
        rid = ''.join(random.choices(string.ascii_uppercase, k=4))
        if rid not in rooms:
            return rid


# --- REST Endpoints ---

@api_router.get("/")
async def root():
    return {"message": "Judgement Card Game API"}


@api_router.post("/rooms")
async def create_room():
    # Cleanup empty rooms
    to_remove = [
        rid for rid, room in rooms.items()
        if not room.connections and room.phase == 'waiting'
    ]
    for rid in to_remove:
        del rooms[rid]

    room_id = generate_room_id()
    rooms[room_id] = GameRoom(room_id)
    logger.info(f"Room created: {room_id}")
    return {"room_id": room_id}


@api_router.get("/rooms/{room_id}/exists")
async def check_room(room_id: str):
    rid = room_id.upper()
    exists = rid in rooms
    joinable = exists and rooms[rid].phase == 'waiting' and len(rooms[rid].players) < 7
    return {"exists": exists, "joinable": joinable}


# --- WebSocket Endpoint ---

@api_router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    room_id = room_id.upper()

    player_name = websocket.query_params.get('player_name', 'Player')
    player_id = websocket.query_params.get('player_id', str(uuid.uuid4()))
    is_host_param = websocket.query_params.get('is_host', 'false') == 'true'

    room = rooms.get(room_id)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    # Check reconnection
    existing = next((p for p in room.players if p['id'] == player_id), None)
    if existing:
        existing['is_connected'] = True
        existing['name'] = player_name
    else:
        if room.phase != 'waiting':
            await websocket.send_json({"type": "error", "message": "Game already in progress"})
            await websocket.close()
            return
        if len(room.players) >= 7:
            await websocket.send_json({"type": "error", "message": "Room is full (max 7)"})
            await websocket.close()
            return
        room.players.append({
            'id': player_id,
            'name': player_name,
            'is_host': is_host_param or len(room.players) == 0,
            'hand': [],
            'bid': None,
            'has_bid': False,
            'tricks_won': 0,
            'total_score': 0,
            'is_connected': True,
        })

    room.connections[player_id] = websocket
    logger.info(f"Player {player_name} ({player_id}) joined room {room_id}")
    await room.broadcast_state()

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            action = data.get('action')

            if action == 'start_game':
                player = next((p for p in room.players if p['id'] == player_id), None)
                if not player or not player['is_host']:
                    await websocket.send_json({"type": "error", "message": "Only the host can start"})
                    continue
                if len(room.players) < 3:
                    await websocket.send_json({"type": "error", "message": "Need at least 3 players"})
                    continue
                if room.phase != 'waiting':
                    await websocket.send_json({"type": "error", "message": "Game already started"})
                    continue
                room.start_game()

            elif action == 'place_bid':
                error = room.place_bid(player_id, int(data.get('bid', 0)))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'play_card':
                error = room.play_card(player_id, data.get('card', {}))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'next_round':
                room.next_round()

            elif action == 'new_game':
                player = next((p for p in room.players if p['id'] == player_id), None)
                if player and player['is_host']:
                    room.start_game()

            elif action == 'send_emote':
                emoji = data.get('emoji')
                if emoji:
                    payload = {
                        "type": "emote",
                        "player_id": player_id,
                        "emoji": emoji
                    }
                    for pid, ws_conn in list(room.connections.items()):
                        try:
                            await ws_conn.send_json(payload)
                        except:
                            pass
                continue

            await room.broadcast_state()

    except WebSocketDisconnect:
        logger.info(f"Player {player_name} ({player_id}) disconnected from {room_id}")
        existing = next((p for p in room.players if p['id'] == player_id), None)
        if player_id in room.connections:
            del room.connections[player_id]

        if room.phase == 'waiting':
            room.players = [p for p in room.players if p['id'] != player_id]
            if not room.players:
                if room_id in rooms:
                    del rooms[room_id]
                return
            if not any(p['is_host'] for p in room.players):
                room.players[0]['is_host'] = True
        else:
            if existing:
                existing['is_connected'] = False

        if room_id in rooms:
            await room.broadcast_state()

    except Exception as e:
        logger.error(f"WebSocket error for {player_id}: {e}")
        if player_id in room.connections:
            del room.connections[player_id]
        existing = next((p for p in room.players if p['id'] == player_id), None)
        if existing:
            existing['is_connected'] = False


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
