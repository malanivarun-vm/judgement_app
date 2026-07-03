// Pure helpers for room-code sharing. No React Native imports — keep this
// file testable under plain Node.

const CODE_PATTERN = /^[A-Z]{4}$/;

export function parseRoomCodeParam(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function buildShareMessage(roomCode: string, origin: string): string {
  const code = roomCode.trim().toUpperCase();
  const lines = [`Hey, join my Judgement game! 🃏`, `Room code: ${code}`];
  const base = origin.replace(/\/+$/, '');
  if (base) {
    lines.push(`Tap to join: ${base}/?code=${code}`);
  }
  return lines.join('\n');
}
