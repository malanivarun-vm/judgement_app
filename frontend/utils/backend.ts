const configuredUrl = process.env.EXPO_PUBLIC_BACKEND_URL?.trim();

export const BACKEND_URL = configuredUrl?.replace(/\/+$/, '') ?? '';

export const BACKEND_CONFIG_ERROR =
  'Backend is not configured. Set EXPO_PUBLIC_BACKEND_URL and restart the app.';

export function requireBackendUrl(): string {
  if (!BACKEND_URL) {
    throw new Error(BACKEND_CONFIG_ERROR);
  }
  return BACKEND_URL;
}

export function buildWebSocketUrl(
  backendUrl: string,
  roomId: string,
  playerName: string,
  playerId: string,
  hostToken?: string,
): string {
  const wsProtocol = backendUrl.startsWith('https://') ? 'wss' : 'ws';
  const wsHost = backendUrl.replace(/^https?:\/\//, '');
  const query = [
    ['player_name', playerName],
    ['player_id', playerId],
    ...(hostToken ? [['host_token', hostToken]] : []),
  ]
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `${wsProtocol}://${wsHost}/api/ws/${roomId}?${query}`;
}
