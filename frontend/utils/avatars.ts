// Table-persona avatars. Pure helpers, no React Native imports — keep this
// file testable under plain Node.

export const AVATARS = [
  '🦊', '🦉', '🐯', '🐙', '🐺', '🦁',
  '🐸', '🐼', '🦅', '🐍', '🦈', '🐴',
] as const;

export function pickRandomAvatar(): string {
  return AVATARS[Math.floor(Math.random() * AVATARS.length)];
}

/** Accept only avatars from the fixed set; anything else falls back to ''. */
export function sanitizeAvatar(raw: unknown): string {
  return typeof raw === 'string' && (AVATARS as readonly string[]).includes(raw) ? raw : '';
}
