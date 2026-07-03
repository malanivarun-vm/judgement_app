from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import logging
import json
import math
import uuid
import random
import string
import time
from pathlib import Path
from typing import Dict, List, Optional
from game_engine import (
    shuffle_and_deal, shuffle_and_deal_partial, sort_hand,
    get_trump_suit, get_max_cards,
    is_valid_play, determine_trick_winner, calculate_round_score,
    get_restricted_bids
)

VARIATIONS = ('v1', 'v1.1', 'v2', 'v3')
VALID_SUITS = ('hearts', 'spades', 'diamonds', 'clubs')
FORCE_GRACE_SECONDS = 15
REACTION_COOLDOWN_SECONDS = 1.0

REACTIONS: Dict[str, Dict[str, str]] = {
    'laugh': {'display': '😂', 'kind': 'emoji'},
    'cry': {'display': '😭', 'kind': 'emoji'},
    'fire': {'display': '🔥', 'kind': 'emoji'},
    'clap': {'display': '👏', 'kind': 'emoji'},
    'scream': {'display': '😱', 'kind': 'emoji'},
    'devil': {'display': '😈', 'kind': 'emoji'},
    'mind_blown': {'display': '🤯', 'kind': 'emoji'},
    'strong': {'display': '💪', 'kind': 'emoji'},
    'nice_bid': {'display': 'Nice bid!', 'kind': 'phrase'},
    'ouch': {'display': 'Ouch 💀', 'kind': 'phrase'},
    'hurry': {'display': 'Hurry up! ⏳', 'kind': 'phrase'},
    'gg': {'display': 'GG 🃏', 'kind': 'phrase'},
}

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
        self.variation = 'v1'
        self.variation_config: Dict = {}
        self.remaining_deck: List[Dict] = []
        self.trump_caller_index = -1
        self.last_reaction_at: Dict[str, float] = {}

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
                'offline_for': (time.time() - p['offline_since'])
                    if (not p.get('is_connected', True) and p.get('offline_since'))
                    else None,
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
            'variation': self.variation,
            'variation_config': self.variation_config,
            'trump_caller_index': self.trump_caller_index,
            'force_grace_seconds': FORCE_GRACE_SECONDS,
        }

    async def broadcast_state(self):
        for pid, ws in list(self.connections.items()):
            try:
                state = self.get_state_for_player(pid)
                await ws.send_json(state)
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")

    def handle_reaction(
        self,
        player_id: str,
        reaction_id: Optional[str],
        now: Optional[float] = None,
    ) -> Optional[Dict]:
        now = now if now is not None else time.time()
        my_index = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if my_index == -1:
            return None
        entry = REACTIONS.get(reaction_id) if reaction_id else None
        if not entry:
            return None
        last = self.last_reaction_at.get(player_id)
        if last is not None and now - last < REACTION_COOLDOWN_SECONDS:
            return None
        self.last_reaction_at[player_id] = now
        return {
            'type': 'reaction',
            'player_index': my_index,
            'player_name': self.players[my_index]['name'],
            'reaction_id': reaction_id,
            'display': entry['display'],
            'kind': entry['kind'],
        }

    async def broadcast_payload(self, payload: Dict):
        for pid, ws in list(self.connections.items()):
            try:
                await ws.send_json(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to {pid}: {e}")

    def set_variation(self, player_id: str, variation: str, config: Dict) -> Optional[str]:
        player = next((p for p in self.players if p['id'] == player_id), None)
        if not player or not player['is_host']:
            return "Only the host can set the variation"
        if self.phase != 'waiting':
            return "Game already started"
        if variation not in VARIATIONS:
            return "Unknown variation"
        self.variation = variation
        self.variation_config = self._sanitize_config(variation, config or {})
        return None

    def _sanitize_config(self, variation: str, config: Dict) -> Dict:
        if variation not in ('v1.1', 'v3'):
            return {}
        n = max(3, len(self.players))
        max_cards = get_max_cards(n)
        max_rounds = 17 if variation == 'v3' else max_cards
        try:
            cards = int(config.get('cards_per_round', 5))
        except (TypeError, ValueError):
            cards = 5
        try:
            rounds = int(config.get('total_rounds', 5))
        except (TypeError, ValueError):
            rounds = 5
        return {
            'cards_per_round': max(1, min(cards, max_cards)),
            'total_rounds': max(1, min(rounds, max_rounds)),
        }

    def start_game(self):
        num_players = len(self.players)
        self.max_cards = get_max_cards(num_players)
        if self.variation in ('v1.1', 'v3'):
            # Re-clamp against the final player count
            self.variation_config = self._sanitize_config(self.variation, self.variation_config)
            self.total_rounds = self.variation_config['total_rounds']
        else:
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
        if self.variation in ('v1.1', 'v3'):
            self.cards_this_round = self.variation_config['cards_per_round']
        else:
            self.cards_this_round = self.max_cards - (self.current_round - 1)

        for p in self.players:
            p['bid'] = None
            p['has_bid'] = False
            p['tricks_won'] = 0

        self.bidding_order = [(self.dealer_index + 1 + i) % n for i in range(n)]
        self.bidding_position = 0
        self.current_trick = []
        self.lead_suit = None
        self.tricks_played = 0
        self.last_completed_trick = None
        self.remaining_deck = []
        self.trump_caller_index = -1

        if self.variation == 'v2':
            # Partial deal; trump is called before the second batch
            batch = math.ceil(self.cards_this_round / 2)
            hands, remaining = shuffle_and_deal_partial(n, self.cards_this_round, batch)
            for i, p in enumerate(self.players):
                p['hand'] = hands[i]
            self.remaining_deck = remaining
            self.trump_suit = None
            self.trump_caller_index = (self.dealer_index + 1) % n
            self.current_player_index = self.trump_caller_index
            self.phase = 'trump_selection'
        else:
            hands = shuffle_and_deal(n, self.cards_this_round)
            for i, p in enumerate(self.players):
                p['hand'] = hands[i]
            # V3: trump is chosen by the highest bidder after bidding
            self.trump_suit = None if self.variation == 'v3' else get_trump_suit(self.current_round)
            self.current_player_index = self.bidding_order[0]
            self.phase = 'bidding'

    def call_trump(self, player_id: str, suit: Optional[str]) -> Optional[str]:
        idx = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if idx == -1:
            return "Player not found"
        if self.phase not in ('trump_selection', 'trump_selection_v3'):
            return "Not in trump selection phase"
        if idx != self.trump_caller_index:
            return "Not your turn to call trump"

        if self.phase == 'trump_selection':
            if suit is None:
                # Blind draw: random suit from the un-dealt cards
                source = self.remaining_deck or [{'suit': s} for s in VALID_SUITS]
                self.trump_suit = random.choice(source)['suit']
            elif suit in VALID_SUITS:
                self.trump_suit = suit
            else:
                return "Invalid suit"

            # Deal the second batch and move to bidding
            n = len(self.players)
            per = self.cards_this_round - len(self.players[0]['hand'])
            for i, p in enumerate(self.players):
                p['hand'].extend(self.remaining_deck[i * per:(i + 1) * per])
                sort_hand(p['hand'])
            self.remaining_deck = self.remaining_deck[n * per:]
            self.current_player_index = self.bidding_order[0]
            self.phase = 'bidding'
        else:  # trump_selection_v3
            if suit not in VALID_SUITS:
                return "Invalid suit"
            self.trump_suit = suit
            self.current_player_index = (self.dealer_index + 1) % len(self.players)
            self.phase = 'playing'

        return None

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
            if self.variation == 'v3':
                # Highest bidder calls trump (ties -> earliest in bidding order)
                best_idx = self.bidding_order[0]
                best_bid = -1
                for i in self.bidding_order:
                    if self.players[i]['bid'] > best_bid:
                        best_bid = self.players[i]['bid']
                        best_idx = i
                self.trump_caller_index = best_idx
                self.current_player_index = best_idx
                self.phase = 'trump_selection_v3'
            else:
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

    def force_action(self, host_id: str) -> Optional[str]:
        host = next((p for p in self.players if p['id'] == host_id), None)
        if not host or not host['is_host']:
            return "Only the host can act for an offline player"
        if self.phase not in ('bidding', 'playing', 'trump_selection', 'trump_selection_v3'):
            return "Nothing to act on right now"
        target = self.players[self.current_player_index]
        if target.get('is_connected', True) or not target.get('offline_since'):
            return "Current player is not offline"
        elapsed = time.time() - target['offline_since']
        if elapsed < FORCE_GRACE_SECONDS:
            return f"Please wait {int(FORCE_GRACE_SECONDS - elapsed) + 1}s before acting for {target['name']}"

        if self.phase == 'bidding':
            restricted = []
            idx = self.current_player_index
            if idx == self.bidding_order[-1]:
                bids_so_far = [self.players[i]['bid'] for i in self.bidding_order[:-1]]
                restricted = get_restricted_bids(bids_so_far, self.cards_this_round)
            bid = next(b for b in range(self.cards_this_round + 1) if b not in restricted)
            return self.place_bid(target['id'], bid)

        if self.phase == 'playing':
            hand = target['hand']
            lead = self.current_trick[0]['card']['suit'] if self.current_trick else None
            card = next(c for c in hand if is_valid_play(c, hand, lead))
            return self.play_card(target['id'], card)

        if self.phase == 'trump_selection':
            return self.call_trump(target['id'], None)  # blind draw

        # trump_selection_v3 requires an explicit suit
        return self.call_trump(target['id'], random.choice(VALID_SUITS))

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
        existing['offline_since'] = None
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
            'offline_since': None,
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

            elif action == 'set_variation':
                error = room.set_variation(player_id, data.get('variation'), data.get('config') or {})
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'call_trump':
                error = room.call_trump(player_id, data.get('suit'))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

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

            elif action == 'force_action':
                error = room.force_action(player_id)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'reaction':
                payload = room.handle_reaction(player_id, data.get('reaction_id'))
                if payload:
                    await room.broadcast_payload(payload)
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
                existing['offline_since'] = time.time()

        if room_id in rooms:
            await room.broadcast_state()

    except Exception as e:
        logger.error(f"WebSocket error for {player_id}: {e}")
        if player_id in room.connections:
            del room.connections[player_id]
        existing = next((p for p in room.players if p['id'] == player_id), None)
        if existing:
            existing['is_connected'] = False
            existing['offline_since'] = time.time()


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
