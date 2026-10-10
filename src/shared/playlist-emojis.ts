// The emoji a playlist can carry. The picker shows exactly these and IPC validation accepts only these.
export const PLAYLIST_EMOJIS: readonly string[] = [
  '🐱', '🐶', '😂', '🎵', '🎬', '🍝', '🎮', '📚',
  '💪', '✈️', '🌙', '❤️', '⭐', '🔥', '🎸', '📌',
  '🎧', '🎤', '🎨', '⚽', '🏀', '🌊', '🌸', '🍿',
  '☕', '🚗', '🧘', '💤', '🎉', '🧠', '🛠️', '💼',
];

export const isPlaylistEmoji = (value: unknown): value is string =>
  typeof value === 'string' && PLAYLIST_EMOJIS.includes(value);
