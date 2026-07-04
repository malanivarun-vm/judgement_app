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

test('buildWebSocketUrl keeps the private resume token out unless supplied', () => {
  const url = buildWebSocketUrl(
    'https://api.example.com',
    'ABCD',
    'Returning Player',
    'p3',
    undefined,
    'resume secret',
  );
  assert.equal(
    url,
    'wss://api.example.com/api/ws/ABCD?player_name=Returning%20Player&player_id=p3&resume_token=resume%20secret',
  );
});
