from fastapi import FastAPI, APIRouter, WebSocket, WebSocketDisconnect
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
import logging
import json
import hmac
import math
import secrets
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
    get_restricted_bids, RANK_VALUES
)

VARIATIONS = ('v1', 'v1.1', 'v2', 'v3')
VALID_SUITS = ('hearts', 'spades', 'diamonds', 'clubs')
VALID_RANKS = ('2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A')
FORCE_GRACE_SECONDS = 15
REACTION_COOLDOWN_SECONDS = 1.0
# How long a lobby player may stay disconnected (e.g. switched apps to share
# the room code) before being removed from the room. Mobile browsers/OS
# suspend WebSockets the moment the app is backgrounded, so this must be
# generous — previously players were kicked (and empty rooms deleted)
# instantly, which made the room look "inactive" after an app switch.
LOBBY_GRACE_SECONDS = 300
# How long a finished/abandoned room lingers before cleanup.
ROOM_TTL_SECONDS = 60 * 60
# Authoritative per-move countdown. When it expires the server acts for the
# current player (safe lowest bid / first legal card / random trump).
TURN_TIMER_SECONDS = 15
# Host-selectable table pace → seconds per move.
PACES = {'chill': 30, 'standard': 15, 'blitz': 7}
# Extra seconds granted after a trick completes so players can watch the
# result banner before the next lead is on the clock.
TRICK_RESULT_BUFFER_SECONDS = 3
# round_end auto-advances to the next round after this long.
ROUND_END_AUTO_SECONDS = 25
CHAT_COOLDOWN_SECONDS = 1.5
CHAT_MAX_LEN = 200
BOT_PERSONALITIES = ('safe_uncle', 'chaos_goblin', 'probability_nerd')
BOT_NAMES = {
    'safe_uncle': 'Safe Uncle',
    'chaos_goblin': 'Chaos Goblin',
    'probability_nerd': 'Probability Nerd',
}

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

# In-memory game rooms (keyed by 4-letter room code)
rooms: Dict[str, 'GameRoom'] = {}


class GameRoom:
    def __init__(self, room_id: str, host_token: Optional[str] = None):
        self.room_id = room_id
        self.host_token = host_token or secrets.token_urlsafe(32)
        self.host_claimed = False
        self.creator_player_id: Optional[str] = None
        self.creator_relinquished = False
        self.players: List[Dict] = []
        self.waiting_players: List[Dict] = []
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
        self.last_chat_at: Dict[str, float] = {}
        self.turn_deadline: Optional[float] = None
        self.pace = 'standard'
        self.turn_seconds = PACES['standard']
        self.last_activity = time.time()
        self.event_log: List[Dict] = []
        self.event_seq = 0
        self.bot_action_at: Optional[float] = None

    def _record_event(self, kind: str, **data):
        """Append an immutable, replay-friendly game event."""
        self.event_seq += 1
        self.event_log.append({
            'seq': self.event_seq,
            'ts': time.time(),
            'round': self.current_round,
            'kind': kind,
            'data': data,
        })
        if len(self.event_log) > 1000:
            self.event_log = self.event_log[-1000:]

    def add_bot(self, requester_id: str, personality: str) -> Optional[str]:
        requester = next((p for p in self.players if p['id'] == requester_id), None)
        if not requester or not requester.get('is_host'):
            return "Only the host can add a Ghost Dealer"
        if self.phase != 'waiting':
            return "Bots can only be added in the lobby"
        if personality not in BOT_PERSONALITIES:
            return "Unknown bot personality"
        if len(self.players) >= 7:
            return "Room is full"
        suffix = sum(p.get('bot_personality') == personality for p in self.players) + 1
        self.players.append({
            'id': f"bot_{uuid.uuid4().hex[:10]}",
            'name': f"{BOT_NAMES[personality]} {suffix}" if suffix > 1 else BOT_NAMES[personality],
            'is_host': False,
            'is_bot': True,
            'bot_personality': personality,
            'hand': [],
            'bid': None,
            'has_bid': False,
            'tricks_won': 0,
            'total_score': 0,
            'is_connected': True,
            'offline_since': None,
        })
        self._record_event('bot_added', personality=personality)
        return None

    def remove_bot(self, requester_id: str, bot_id: str) -> Optional[str]:
        requester = next((p for p in self.players if p['id'] == requester_id), None)
        if not requester or not requester.get('is_host'):
            return "Only the host can remove a Ghost Dealer"
        if self.phase != 'waiting':
            return "Bots can only be removed in the lobby"
        bot = next(
            (p for p in self.players if p['id'] == bot_id and p.get('is_bot')),
            None,
        )
        if not bot:
            return "Bot not found"
        self.players.remove(bot)
        self._record_event('bot_removed', bot_id=bot_id)
        return None

    def _ensure_host(self):
        """Keep one connected player in control whenever possible."""
        current_host = next((p for p in self.players if p.get('is_host')), None)
        if (
            current_host
            and current_host.get('is_connected', True)
            and not current_host.get('waiting_for_lobby')
            and not current_host.get('left_game')
        ):
            return
        if current_host:
            current_host['is_host'] = False
        replacement = next(
            (
                p for p in self.players
                if p.get('is_connected', True)
                and not p.get('waiting_for_lobby')
                and not p.get('left_game')
                and not p.get('is_bot')
            ),
            next((p for p in self.players if not p.get('is_bot')), None),
        )
        if replacement:
            replacement['is_host'] = True

    def _all_participants(self) -> List[Dict]:
        return [*self.players, *self.waiting_players]

    def return_all_to_lobby(self):
        """End the active game without disconnecting the room."""
        retained = [p for p in self.players if not p.get('left_game')]
        known_ids = {p['id'] for p in retained}
        retained.extend(p for p in self.waiting_players if p['id'] not in known_ids)
        self.players = retained
        self.waiting_players = []

        for player in self.players:
            player['hand'] = []
            player['bid'] = None
            player['has_bid'] = False
            player['tricks_won'] = 0
            player['waiting_for_lobby'] = False
            player['left_game'] = False
            player['is_connected'] = player['id'] in self.connections or player.get('is_bot', False)

        self.phase = 'waiting'
        self.current_round = 0
        self.total_rounds = 0
        self.cards_this_round = 0
        self.current_player_index = -1
        self.current_trick = []
        self.last_completed_trick = None
        self.lead_suit = None
        self.turn_deadline = None
        self.bot_action_at = None
        self._ensure_host()
        self._record_event('returned_to_lobby', player_ids=[p['id'] for p in self.players])

    def end_game_for_all(self, requester_id: str) -> Optional[str]:
        requester = next((p for p in self.players if p['id'] == requester_id), None)
        if not requester or not requester.get('is_host'):
            return "Only the host can end the game for everyone"
        if self.phase == 'waiting':
            return "Everyone is already in the lobby"
        self.return_all_to_lobby()
        return None

    def return_player_to_lobby(self, player_id: str) -> Optional[str]:
        player = next((p for p in self.players if p['id'] == player_id), None)
        if not player:
            if any(p['id'] == player_id for p in self.waiting_players):
                return None
            return "Player not found"
        if self.phase in ('waiting', 'game_over'):
            return None

        player['waiting_for_lobby'] = True
        if player.get('is_host'):
            player['is_host'] = False
            if player_id == self.creator_player_id:
                self.creator_relinquished = True
            self._ensure_host()
        self._record_event('player_returned_to_lobby', player_id=player_id)

        active_humans = [p for p in self.players if not p.get('is_bot') and not p.get('left_game')]
        if active_humans and all(p.get('waiting_for_lobby') for p in active_humans):
            self.return_all_to_lobby()
        else:
            self._arm_timer()
        return None

    def leave_player(self, player_id: str) -> Optional[str]:
        waiting_player = next((p for p in self.waiting_players if p['id'] == player_id), None)
        if waiting_player:
            self.waiting_players.remove(waiting_player)
            self.touch()
            return None

        player = next((p for p in self.players if p['id'] == player_id), None)
        if not player:
            return "Player not found"
        if player_id == self.creator_player_id:
            self.creator_relinquished = True

        if self.phase in ('waiting', 'game_over'):
            self.players = [p for p in self.players if p['id'] != player_id]
        else:
            # Active-game seats cannot be removed without corrupting turn and
            # trick indices. Mark the seat offline so the timer can auto-play.
            player['is_connected'] = False
            player['offline_since'] = time.time()
            player['is_host'] = False
            player['left_game'] = True
            player['waiting_for_lobby'] = False
        self._ensure_host()
        self.touch()
        self._record_event('player_left', player_id=player_id, name=player['name'])
        return None

    def set_pace(self, player_id: str, pace: str) -> Optional[str]:
        player = next((p for p in self.players if p['id'] == player_id), None)
        if not player or not player['is_host']:
            return "Only the host can set the table pace"
        if self.phase != 'waiting':
            return "Game already started"
        if pace not in PACES:
            return "Unknown pace"
        self.pace = pace
        self.turn_seconds = PACES[pace]
        return None

    def _arm_timer(self):
        """(Re)start the authoritative move countdown for the current phase."""
        now = time.time()
        if self.phase in ('bidding', 'trump_selection', 'trump_selection_v3'):
            self.turn_deadline = now + self.turn_seconds
        elif self.phase == 'playing':
            buffer = (
                TRICK_RESULT_BUFFER_SECONDS
                if (self.last_completed_trick and not self.current_trick)
                else 0
            )
            self.turn_deadline = now + self.turn_seconds + buffer
        elif self.phase == 'round_end':
            self.turn_deadline = now + ROUND_END_AUTO_SECONDS
        else:
            self.turn_deadline = None
        self.bot_action_at = None
        if (
            self.phase in ('bidding', 'playing', 'trump_selection', 'trump_selection_v3')
            and 0 <= self.current_player_index < len(self.players)
            and (
                self.players[self.current_player_index].get('is_bot')
                or self.players[self.current_player_index].get('waiting_for_lobby')
                or self.players[self.current_player_index].get('left_game')
            )
        ):
            result_buffer = (
                TRICK_RESULT_BUFFER_SECONDS
                if self.phase == 'playing' and self.last_completed_trick and not self.current_trick
                else 0
            )
            self.bot_action_at = now + result_buffer + 0.9

    def _bot_bid(self, player: Dict, restricted: List[int]) -> int:
        personality = player.get('bot_personality')
        allowed = [b for b in range(self.cards_this_round + 1) if b not in restricted]
        if personality == 'chaos_goblin':
            return random.choice(allowed)

        strength = 0.0
        for card in player['hand']:
            if card['rank'] == 'A':
                strength += 0.85
            elif card['rank'] == 'K':
                strength += 0.55
            elif card['rank'] == 'Q':
                strength += 0.25
            if self.trump_suit and card['suit'] == self.trump_suit:
                strength += 0.22
        if personality == 'safe_uncle':
            estimate = math.floor(strength)
        else:
            estimate = round(strength)
        return min(allowed, key=lambda bid: (abs(bid - estimate), bid))

    def _bot_card(self, player: Dict) -> Dict:
        lead = self.current_trick[0]['card']['suit'] if self.current_trick else None
        legal = [card for card in player['hand'] if is_valid_play(card, player['hand'], lead)]
        personality = player.get('bot_personality')
        if personality == 'chaos_goblin':
            return random.choice(legal)

        def card_value(card: Dict) -> int:
            trump_bonus = 20 if self.trump_suit and card['suit'] == self.trump_suit else 0
            return trump_bonus + RANK_VALUES[card['rank']]

        needs_trick = player['tricks_won'] < (player.get('bid') or 0)
        if personality == 'safe_uncle':
            return max(legal, key=card_value) if needs_trick else min(legal, key=card_value)

        winning_cards = []
        bot_index = self.players.index(player)
        for card in legal:
            trial = [*self.current_trick, {'player_index': bot_index, 'card': card}]
            if determine_trick_winner(trial, self.trump_suit) == bot_index:
                winning_cards.append(card)
        if needs_trick and winning_cards:
            return min(winning_cards, key=card_value)
        return min(legal, key=card_value)

    def _bot_trump(self, player: Dict) -> str:
        if player.get('bot_personality') == 'chaos_goblin':
            return random.choice(VALID_SUITS)
        suit_strength = {
            suit: sum(
                1 + RANK_VALUES[card['rank']] / 12
                for card in player['hand']
                if card['suit'] == suit
            )
            for suit in VALID_SUITS
        }
        return max(VALID_SUITS, key=lambda suit: suit_strength[suit])

    def auto_act_current(self) -> Optional[str]:
        """Perform a safe default action for the current player (used when
        their move timer expires, and by the host force flow)."""
        if self.phase == 'bidding':
            restricted = []
            idx = self.current_player_index
            if idx == self.bidding_order[-1]:
                bids_so_far = [self.players[i]['bid'] for i in self.bidding_order[:-1]]
                if sum(bids_so_far) == self.cards_this_round:
                    restricted = [
                        bid for bid in range(self.cards_this_round + 1)
                        if bid != 1
                    ]
                else:
                    restricted = get_restricted_bids(bids_so_far, self.cards_this_round)
            target = self.players[idx]
            bid = (
                self._bot_bid(target, restricted)
                if target.get('is_bot')
                else next(b for b in range(self.cards_this_round + 1) if b not in restricted)
            )
            return self.place_bid(target['id'], bid)

        if self.phase == 'playing':
            target = self.players[self.current_player_index]
            hand = target['hand']
            lead = self.current_trick[0]['card']['suit'] if self.current_trick else None
            card = (
                self._bot_card(target)
                if target.get('is_bot')
                else next(c for c in hand if is_valid_play(c, hand, lead))
            )
            return self.play_card(target['id'], card)

        if self.phase == 'trump_selection':
            target = self.players[self.trump_caller_index]
            per = self.cards_this_round - len(self.players[0].get('hand', []))
            cards_needed = len(self.players) * per
            suit = (
                self._bot_trump(target)
                if target.get('is_bot')
                else None if len(self.remaining_deck) > cards_needed else random.choice(VALID_SUITS)
            )
            return self.call_trump(target['id'], suit)

        if self.phase == 'trump_selection_v3':
            target = self.players[self.trump_caller_index]
            suit = self._bot_trump(target) if target.get('is_bot') else random.choice(VALID_SUITS)
            return self.call_trump(target['id'], suit)

        return "Nothing to act on right now"

    def handle_chat(
        self,
        player_id: str,
        text,
        now: Optional[float] = None,
    ) -> tuple[Optional[Dict], Optional[str]]:
        now = now if now is not None else time.time()
        participants = self._all_participants()
        my_index = next((i for i, p in enumerate(participants) if p['id'] == player_id), -1)
        if my_index == -1:
            return None, "Player not found"
        if not isinstance(text, str):
            return None, "Message must be text"
        text = text.strip()[:CHAT_MAX_LEN]
        if not text:
            return None, "Message cannot be empty"
        last = self.last_chat_at.get(player_id)
        if last is not None and now - last < CHAT_COOLDOWN_SECONDS:
            retry_after = CHAT_COOLDOWN_SECONDS - (now - last)
            return None, f"Please wait {retry_after:.1f}s before sending again"
        self.last_chat_at[player_id] = now
        return {
            'type': 'chat',
            'player_index': my_index,
            'player_name': participants[my_index]['name'],
            'text': text,
            'ts': now,
        }, None

    def touch(self):
        self.last_activity = time.time()

    def prune_lobby_players(self) -> bool:
        """Remove lobby players who have been offline past the grace period.
        Returns True if anything changed. Never touches in-game players."""
        if self.phase != 'waiting':
            return False
        now = time.time()
        before = len(self.players)
        self.players = [
            p for p in self.players
            if p.get('is_connected', True)
            or not p.get('offline_since')
            or (now - p['offline_since']) < LOBBY_GRACE_SECONDS
        ]
        changed = len(self.players) != before
        if changed:
            self._ensure_host()
        return changed

    def is_expired(self) -> bool:
        """A room can be deleted when nobody is connected and either every
        player has been gone past the lobby grace period or the room has
        been idle past its TTL."""
        if self.connections:
            return False
        now = time.time()
        if now - self.last_activity > ROOM_TTL_SECONDS:
            return True
        if self.phase != 'waiting':
            return False
        return all(
            not p.get('is_connected', True)
            and p.get('offline_since')
            and (now - p['offline_since']) > LOBBY_GRACE_SECONDS
            for p in self.players
        ) if self.players else (now - self.last_activity > LOBBY_GRACE_SECONDS)

    def get_state_for_player(self, player_id: str) -> Dict:
        active_player = next((p for p in self.players if p['id'] == player_id), None)
        waiting_player = next((p for p in self.waiting_players if p['id'] == player_id), None)
        player = active_player or waiting_player
        waiting_client = bool(waiting_player or (active_player and active_player.get('waiting_for_lobby')))
        state_players = self._all_participants() if waiting_client else self.players
        my_index = next((i for i, p in enumerate(state_players) if p['id'] == player_id), -1)

        players_info = []
        for p in state_players:
            players_info.append({
                'id': p['id'],
                'name': p['name'],
                'avatar': p.get('avatar', ''),
                'is_host': p['is_host'],
                'bid': p.get('bid'),
                'tricks_won': p.get('tricks_won', 0),
                'total_score': p.get('total_score', 0),
                'card_count': len(p.get('hand', [])),
                'is_connected': p.get('is_connected', True),
                'has_bid': p.get('has_bid', False),
                'streak': p.get('streak', 0),
                'is_bot': p.get('is_bot', False),
                'bot_personality': p.get('bot_personality'),
                'waiting_for_lobby': p.get('waiting_for_lobby', False),
                'offline_for': (time.time() - p['offline_since'])
                    if (not p.get('is_connected', True) and p.get('offline_since'))
                    else None,
            })

        restricted_bids = []
        if self.bidding_order and self.phase == 'bidding' and my_index == self.bidding_order[-1]:
            bids_so_far = [
                self.players[i]['bid'] for i in self.bidding_order[:-1]
                if self.players[i].get('has_bid')
            ]
            if sum(bids_so_far) == self.cards_this_round:
                restricted_bids = [
                    bid for bid in range(self.cards_this_round + 1)
                    if bid != 1
                ]
            else:
                restricted_bids = get_restricted_bids(bids_so_far, self.cards_this_round)

        blind_draw_available = False
        if self.phase == 'trump_selection' and self.players:
            second_batch_size = self.cards_this_round - len(self.players[0].get('hand', []))
            cards_needed = len(self.players) * second_batch_size
            blind_draw_available = len(self.remaining_deck) > cards_needed

        return {
            'type': 'state',
            'room_id': self.room_id,
            'phase': 'waiting_for_lobby' if waiting_client else self.phase,
            'active_phase': self.phase,
            'players': players_info,
            'your_id': player_id,
            'your_index': my_index,
            'your_hand': player.get('hand', []) if player and not waiting_client else [],
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
            'turn_expires_in': (
                max(0.0, self.turn_deadline - time.time())
                if self.turn_deadline is not None else None
            ),
            'turn_timer_seconds': self.turn_seconds,
            'round_end_auto_seconds': ROUND_END_AUTO_SECONDS,
            'pace': self.pace,
            'blind_draw_available': blind_draw_available,
            # This secret is only included in the state sent to its owner.
            'resume_token': player.get('resume_token') if player else None,
            'event_seq': self.event_seq,
            'recent_events': self.event_log[-30:],
            'waiting_count': len(self.waiting_players) + sum(
                bool(p.get('waiting_for_lobby')) for p in self.players
            ),
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
        participants = self._all_participants()
        my_index = next((i for i, p in enumerate(participants) if p['id'] == player_id), -1)
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
            'player_name': participants[my_index]['name'],
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
            p['streak'] = 0
        self.round_history = []
        self.event_log = []
        self.event_seq = 0
        self.current_round = 0
        self._record_event(
            'game_started',
            variation=self.variation,
            player_ids=[p['id'] for p in self.players],
        )
        self._start_round()

    def _start_round(self):
        self.current_round += 1
        n = len(self.players)
        if self.variation in ('v1.1', 'v3'):
            self.cards_this_round = self.variation_config['cards_per_round']
        elif self.variation == 'v2':
            self.cards_this_round = self.max_cards
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
        self._record_event(
            'round_started',
            cards=self.cards_this_round,
            dealer_index=self.dealer_index,
            trump=self.trump_suit,
        )
        self._arm_timer()

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
                # The blind card is set aside and must never be dealt.
                n = len(self.players)
                per = self.cards_this_round - len(self.players[0]['hand'])
                cards_needed = n * per
                if len(self.remaining_deck) <= cards_needed:
                    return "Blind draw is unavailable when the full deck is needed"
                blind_index = random.randrange(len(self.remaining_deck))
                blind_card = self.remaining_deck.pop(blind_index)
                self.trump_suit = blind_card['suit']
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
            # Prediction First rewards the highest bidder with both trump
            # control and the opening lead.
            self.current_player_index = self.trump_caller_index
            self.phase = 'playing'

        self._arm_timer()
        self._record_event('trump_called', player_id=player_id, suit=self.trump_suit)
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
            if sum(bids_so_far) == self.cards_this_round and bid != 1:
                return "Dealer must bid 1 when the other bids equal the cards dealt"
            restricted = get_restricted_bids(bids_so_far, self.cards_this_round)
            if bid in restricted:
                return f"Cannot bid {bid} (total would equal cards dealt)"

        self.players[idx]['bid'] = bid
        self.players[idx]['has_bid'] = True
        self._record_event('bid_placed', player_id=player_id, bid=bid)

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

        self._arm_timer()
        return None

    def play_card(self, player_id: str, card: Dict) -> Optional[str]:
        idx = next((i for i, p in enumerate(self.players) if p['id'] == player_id), -1)
        if idx == -1:
            return "Player not found"
        if self.phase != 'playing':
            return "Not in playing phase"
        if idx != self.current_player_index:
            return "Not your turn"
        if (
            not isinstance(card, dict)
            or card.get('suit') not in VALID_SUITS
            or card.get('rank') not in VALID_RANKS
        ):
            return "Invalid card"

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
        self._record_event('card_played', player_id=player_id, card=dict(card))

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
            self._record_event(
                'trick_completed',
                winner_id=self.players[winner_idx]['id'],
                winner_index=winner_idx,
                cards=self.last_completed_trick['cards'],
            )

            if self.tricks_played >= self.cards_this_round:
                self._end_round()
            else:
                self.current_trick = []
                self.lead_suit = None
                self.current_player_index = winner_idx
        else:
            self.current_player_index = (idx + 1) % len(self.players)

        self._arm_timer()
        return None

    def force_action(self, requester_id: str) -> Optional[str]:
        requester = next((p for p in self.players if p['id'] == requester_id), None)
        if not requester:
            return "Player not found"
        host = next((p for p in self.players if p['is_host']), None)
        host_offline = host is None or not host.get('is_connected', True)
        # Normally only the host may act for an offline player, but if the
        # host is themselves offline, any connected player may step in so the
        # game can't soft-lock.
        if not requester['is_host'] and not host_offline:
            return "Only the host can act for an offline player"
        if self.phase not in ('bidding', 'playing', 'trump_selection', 'trump_selection_v3'):
            return "Nothing to act on right now"
        target = self.players[self.current_player_index]
        if target.get('is_connected', True) or not target.get('offline_since'):
            return "Current player is not offline"
        elapsed = time.time() - target['offline_since']
        if elapsed < FORCE_GRACE_SECONDS:
            return f"Please wait {int(FORCE_GRACE_SECONDS - elapsed) + 1}s before acting for {target['name']}"

        return self.auto_act_current()

    def _end_round(self):
        round_scores = {}
        for p in self.players:
            score = calculate_round_score(p['bid'], p['tricks_won'])
            p['total_score'] += score
            # 🔥 streak: consecutive rounds hitting the bid exactly
            p['streak'] = p.get('streak', 0) + 1 if p['bid'] == p['tricks_won'] else 0
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
        self._record_event('round_completed', scores=round_scores)

        self.current_trick = []

        if self.current_round >= self.total_rounds:
            self.phase = 'game_over'
        else:
            self.phase = 'round_end'
            self.dealer_index = (self.dealer_index + 1) % len(self.players)
        self._arm_timer()

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


def cleanup_rooms():
    """Prune long-gone lobby players and delete genuinely expired rooms.
    Rooms whose players merely backgrounded the app are kept alive."""
    for room in list(rooms.values()):
        room.prune_lobby_players()
    to_remove = [rid for rid, room in rooms.items() if room.is_expired()]
    for rid in to_remove:
        logger.info(f"Room expired: {rid}")
        del rooms[rid]


@api_router.post("/rooms")
async def create_room():
    cleanup_rooms()

    room_id = generate_room_id()
    room = GameRoom(room_id)
    rooms[room_id] = room
    logger.info(f"Room created: {room_id}")
    return {"room_id": room_id, "host_token": room.host_token}


@api_router.get("/rooms/{room_id}/exists")
async def check_room(room_id: str):
    cleanup_rooms()
    rid = room_id.upper()
    exists = rid in rooms
    if not exists:
        return {"exists": False, "joinable": False, "waiting_for_lobby": False, "players": 0, "capacity": 7}
    room = rooms[rid]
    waiting_for_lobby = room.phase != 'waiting'
    capacity = 7
    joinable = len(room._all_participants()) < capacity
    return {
        "exists": True,
        "joinable": joinable,
        "waiting_for_lobby": waiting_for_lobby,
        "players": len(room.players),
        "capacity": capacity,
    }


# --- WebSocket Endpoint ---

@api_router.websocket("/ws/{room_id}")
async def websocket_endpoint(websocket: WebSocket, room_id: str):
    await websocket.accept()
    room_id = room_id.upper()

    player_name = websocket.query_params.get('player_name', 'Player')
    player_name = player_name.strip()[:16] or 'Player'
    # Emoji avatars are multi-codepoint; 8 chars covers any single emoji.
    player_avatar = websocket.query_params.get('avatar', '').strip()[:8]
    player_id = websocket.query_params.get('player_id', str(uuid.uuid4()))
    supplied_host_token = websocket.query_params.get('host_token', '')
    supplied_resume_token = websocket.query_params.get('resume_token', '')

    room = rooms.get(room_id)
    if not room:
        await websocket.send_json({"type": "error", "message": "Room not found"})
        await websocket.close()
        return

    room.touch()

    # Check reconnection
    existing = next((p for p in room._all_participants() if p['id'] == player_id), None)
    if existing:
        expected_resume_token = existing.get('resume_token', '')
        if (
            not supplied_resume_token
            or not expected_resume_token
            or not hmac.compare_digest(supplied_resume_token, expected_resume_token)
        ):
            await websocket.send_json({
                "type": "error",
                "message": "This seat belongs to another session",
            })
            await websocket.close(code=4003)
            return
        existing['is_connected'] = True
        existing['offline_since'] = None
        existing['name'] = player_name
        if player_avatar:
            existing['avatar'] = player_avatar
        if (
            player_id == room.creator_player_id
            and not room.creator_relinquished
            and room.phase == 'waiting'
        ):
            for player in room.players:
                player['is_host'] = player['id'] == player_id
    else:
        capacity = 7
        if len(room._all_participants()) >= capacity:
            await websocket.send_json({"type": "error", "message": "Room is full"})
            await websocket.close()
            return
        claims_host = (
            not room.host_claimed
            and bool(supplied_host_token)
            and hmac.compare_digest(supplied_host_token, room.host_token)
        )
        if claims_host:
            room.host_claimed = True
            room.creator_player_id = player_id
        new_player = {
            'id': player_id,
            'name': player_name,
            'avatar': player_avatar,
            'is_host': claims_host,
            'hand': [],
            'bid': None,
            'has_bid': False,
            'tricks_won': 0,
            'total_score': 0,
            'is_connected': True,
            'offline_since': None,
            'resume_token': secrets.token_urlsafe(32),
            'waiting_for_lobby': room.phase != 'waiting',
            'left_game': False,
        }
        if room.phase == 'waiting':
            room.players.append(new_player)
        else:
            new_player['is_host'] = False
            room.waiting_players.append(new_player)
            room._record_event('late_joined', player_id=player_id, name=player_name)
    previous_socket = room.connections.get(player_id)
    room.connections[player_id] = websocket
    if previous_socket and previous_socket is not websocket:
        try:
            await previous_socket.close(code=4001, reason="Session resumed elsewhere")
        except Exception:
            pass
    logger.info(f"Player {player_name} ({player_id}) joined room {room_id}")
    await room.broadcast_state()

    try:
        while True:
            raw = await websocket.receive_text()
            # A superseded connection must not be able to keep acting after a
            # valid resume has installed a newer socket for the same player.
            if room.connections.get(player_id) is not websocket:
                await websocket.close(code=4001)
                return
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({"type": "error", "message": "Invalid JSON message"})
                continue
            if not isinstance(data, dict):
                await websocket.send_json({"type": "error", "message": "Message must be an object"})
                continue
            action = data.get('action')
            room.touch()

            if action == 'ping':
                # Client heartbeat — keeps proxies from dropping idle
                # sockets and marks the room as alive. No broadcast needed.
                await websocket.send_json({"type": "pong"})
                continue

            if action == 'start_game':
                player = next((p for p in room.players if p['id'] == player_id), None)
                if not player or not player['is_host']:
                    await websocket.send_json({"type": "error", "message": "Only the host can start"})
                    continue
                if len(room.players) < 3:
                    await websocket.send_json({"type": "error", "message": "Need at least 3 players"})
                    continue
                if len(room.players) > 7:
                    await websocket.send_json({"type": "error", "message": "Maximum 7 players"})
                    continue
                if any(not p.get('is_connected', True) for p in room.players):
                    await websocket.send_json({
                        "type": "error",
                        "message": "All players must be connected before starting",
                    })
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

            elif action == 'set_pace':
                error = room.set_pace(player_id, data.get('pace'))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'add_bot':
                error = room.add_bot(player_id, data.get('personality'))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'remove_bot':
                error = room.remove_bot(player_id, data.get('bot_id'))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'call_trump':
                error = room.call_trump(player_id, data.get('suit'))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'place_bid':
                try:
                    raw_bid = data.get('bid')
                    if isinstance(raw_bid, bool):
                        raise ValueError
                    bid = int(raw_bid)
                except (TypeError, ValueError):
                    await websocket.send_json({"type": "error", "message": "Bid must be a whole number"})
                    continue
                error = room.place_bid(player_id, bid)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'play_card':
                error = room.play_card(player_id, data.get('card', {}))
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'next_round':
                player = next((p for p in room.players if p['id'] == player_id), None)
                if not player or not player['is_host']:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Only the host can start the next round",
                    })
                    continue
                room.next_round()

            elif action == 'new_game':
                player = next((p for p in room.players if p['id'] == player_id), None)
                if not player or not player['is_host']:
                    await websocket.send_json({"type": "error", "message": "Only the host can start a new game"})
                    continue
                if room.phase != 'game_over':
                    await websocket.send_json({"type": "error", "message": "Finish the current game first"})
                    continue
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

            elif action == 'chat':
                message_id = data.get('message_id')
                payload, chat_error = room.handle_chat(player_id, data.get('text'))
                if chat_error:
                    await websocket.send_json({
                        "type": "chat_ack",
                        "message_id": message_id,
                        "accepted": False,
                        "message": chat_error,
                    })
                    continue
                if payload:
                    payload['message_id'] = message_id
                    await room.broadcast_payload(payload)
                    await websocket.send_json({
                        "type": "chat_ack",
                        "message_id": message_id,
                        "accepted": True,
                    })
                continue

            elif action == 'return_to_lobby':
                error = room.return_player_to_lobby(player_id)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'end_game_for_all':
                error = room.end_game_for_all(player_id)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue

            elif action == 'leave_room':
                error = room.leave_player(player_id)
                if error:
                    await websocket.send_json({"type": "error", "message": error})
                    continue
                if room.connections.get(player_id) is websocket:
                    del room.connections[player_id]
                await websocket.send_json({"type": "leave_ack"})
                await room.broadcast_state()
                await websocket.close(code=1000)
                if not room._all_participants():
                    rooms.pop(room_id, None)
                return

            else:
                await websocket.send_json({"type": "error", "message": "Unknown action"})
                continue

            await room.broadcast_state()

    except WebSocketDisconnect:
        logger.info(f"Player {player_name} ({player_id}) disconnected from {room_id}")
        existing = next((p for p in room._all_participants() if p['id'] == player_id), None)
        if room.connections.get(player_id) is websocket:
            del room.connections[player_id]

        # NEVER remove players immediately — mobile browsers/OS suspend the
        # WebSocket the moment the app is backgrounded (e.g. switching apps
        # to share the room code). Mark offline and let the grace-period
        # pruner clean up players who are truly gone.
        if existing and room.connections.get(player_id) is None:
            existing['is_connected'] = False
            existing['offline_since'] = time.time()
            # Lobby disconnects are often brief app-background/reconnect
            # cycles. Keep the creator as host until they explicitly leave or
            # the lobby grace-period pruner actually removes their seat.
            if room.phase != 'waiting':
                room._ensure_host()
        room.touch()

        if room_id in rooms:
            await room.broadcast_state()

    except Exception as e:
        logger.error(f"WebSocket error for {player_id}: {e}")
        if room.connections.get(player_id) is websocket:
            del room.connections[player_id]
        existing = next((p for p in room._all_participants() if p['id'] == player_id), None)
        if existing and room.connections.get(player_id) is None:
            existing['is_connected'] = False
            existing['offline_since'] = time.time()
            if room.phase != 'waiting':
                room._ensure_host()


@app.on_event("startup")
async def start_room_sweeper():
    import asyncio

    async def tick():
        """1s heartbeat: fire expired move timers and auto-advance rounds."""
        while True:
            await asyncio.sleep(1)
            try:
                now = time.time()
                for room in list(rooms.values()):
                    if room.bot_action_at is not None and now >= room.bot_action_at:
                        bot_name = room.players[room.current_player_index]['name']
                        error = room.auto_act_current()
                        if error:
                            room.bot_action_at = now + 2
                            logger.error(f"Bot action failed in {room.room_id}: {error}")
                        else:
                            await room.broadcast_payload({
                                'type': 'bot_action',
                                'player_name': bot_name,
                            })
                            await room.broadcast_state()
                        continue
                    if room.turn_deadline is None or now < room.turn_deadline:
                        continue
                    if room.phase == 'round_end':
                        room.next_round()
                        await room.broadcast_state()
                    elif room.phase in ('bidding', 'playing', 'trump_selection', 'trump_selection_v3'):
                        timed_out = room.players[room.current_player_index]['name']
                        error = room.auto_act_current()
                        if error:
                            # Don't hot-loop on a stuck room — retry shortly
                            room.turn_deadline = now + 5
                            logger.error(f"Auto-act failed in {room.room_id}: {error}")
                        else:
                            await room.broadcast_payload({
                                'type': 'timeout',
                                'player_name': timed_out,
                            })
                        await room.broadcast_state()
                    else:
                        room.turn_deadline = None
            except Exception as e:
                logger.error(f"Turn ticker error: {e}")

    asyncio.create_task(tick())

    async def sweep():
        while True:
            await asyncio.sleep(30)
            try:
                changed_rooms = [
                    room for room in list(rooms.values())
                    if room.prune_lobby_players()
                ]
                expired = [rid for rid, room in rooms.items() if room.is_expired()]
                for rid in expired:
                    logger.info(f"Room expired: {rid}")
                    del rooms[rid]
                for room in changed_rooms:
                    if room.room_id in rooms:
                        await room.broadcast_state()
            except Exception as e:
                logger.error(f"Room sweeper error: {e}")

    asyncio.create_task(sweep())


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

