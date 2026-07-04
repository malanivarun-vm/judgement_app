// Demo driver for the game-over celebration: spins up a room with two bots
// on a 1-round blitz game, prints a join link, and auto-plays everything.
// Take the third seat from a phone or browser tab and just watch — blitz
// pace force-plays your moves, so the podium arrives in ~30 seconds.
//
// Usage: node scripts/demo-celebration.mjs [backend-url]
//   backend-url defaults to EXPO_PUBLIC_BACKEND_URL from frontend/.env,
//   then http://localhost:8000.

import { readFileSync } from 'node:fs';

function envBackendUrl() {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    const m = env.match(/^EXPO_PUBLIC_BACKEND_URL=(.+)$/m);
    return m?.[1].trim();
  } catch {
    return undefined;
  }
}

const BASE = (process.argv[2] || envBackendUrl() || 'http://localhost:8000').replace(/\/+$/, '');
const WS_BASE = BASE.replace(/^http/, 'ws');

function connectBot(roomId, name, id, avatar, hostToken) {
  const q = new URLSearchParams({ player_name: name, player_id: id, avatar });
  if (hostToken) q.set('host_token', hostToken);
  const sock = new WebSocket(`${WS_BASE}/api/ws/${roomId}?${q}`);
  const send = (msg) => sock.send(JSON.stringify(msg));
  let started = false;

  let lastBidTried = null;

  sock.addEventListener('message', (ev) => {
    const d = JSON.parse(ev.data);
    if (d.type === 'error') {
      // Hook rule can forbid a bid of 0 for the last bidder — step up once.
      if (lastBidTried === 0 && /bid/i.test(d.message)) {
        lastBidTried = 1;
        send({ action: 'place_bid', bid: 1 });
      } else {
        console.log(`[${name}] server error: ${d.message}`);
      }
      return;
    }
    if (d.type !== 'state') return;

    if (hostToken && d.phase === 'waiting' && !started) {
      const connected = d.players.filter((p) => p.is_connected).length;
      if (connected >= 3) {
        started = true;
        console.log(`\n3 players seated — dealing a 1-round blitz game…`);
        send({ action: 'set_variation', variation: 'v1.1', config: { cards_per_round: 1, total_rounds: 1 } });
        send({ action: 'set_pace', pace: 'blitz' });
        send({ action: 'start_game' });
      }
    }

    const me = d.players[d.your_index];
    const myTurn = d.current_player_index === d.your_index;
    if (d.phase === 'bidding' && myTurn && me && !me.has_bid && lastBidTried === null) {
      lastBidTried = 0;
      send({ action: 'place_bid', bid: 0 });
    }
    if (d.phase === 'playing' && myTurn && d.your_hand?.length) {
      send({ action: 'play_card', card: d.your_hand[0] });
    }
    if (d.phase === 'game_over') {
      const top = [...d.players].sort((a, b) => b.total_score - a.total_score)[0];
      console.log(`[${name}] game over — winner: ${top.name} (${top.total_score} pts)`);
      setTimeout(() => sock.close(), 500);
    }
  });
  return sock;
}

const res = await fetch(`${BASE}/api/rooms`, { method: 'POST' });
const { room_id, host_token } = await res.json();

console.log(`\nRoom ${room_id} ready. Bots Nikhil 🦉 and Aashik 🐯 are seated.`);
console.log(`\nTake the third seat, then just watch:`);
console.log(`  Web:   http://localhost:8081/?code=${room_id}`);
console.log(`  Phone: http://192.168.0.118:8081/?code=${room_id}\n`);

connectBot(room_id, 'Nikhil', 'bot_host_1', '🦉', host_token);
connectBot(room_id, 'Aashik', 'bot_guest_1', '🐯');

// Keep the process alive until the game finishes or 3 minutes pass.
setTimeout(() => {
  console.log('Demo timed out after 3 minutes.');
  process.exit(0);
}, 180000);
