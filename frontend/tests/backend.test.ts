import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWebSocketUrl } from '../utils/backend';

test('buildWebSocketUrl includes a host token only when supplied', () => {
  const hostUrl = buildWebSocketUrl(
    'https://api.example.com',
    'ABCD',
    'Host Player',
    'p1',
    'secret token',
  );
  assert.equal(
    hostUrl,
    'wss://api.example.com/api/ws/ABCD?player_name=Host%20Player&player_id=p1&host_token=secret%20token',
  );

  const guestUrl = buildWebSocketUrl(
    'http://localhost:8000',
    'ABCD',
    'Guest',
    'p2',
  );
  assert.equal(
    guestUrl,
    'ws://localhost:8000/api/ws/ABCD?player_name=Guest&player_id=p2',
  );
});
