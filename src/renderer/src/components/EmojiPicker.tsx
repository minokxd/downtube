import { PLAYLIST_EMOJIS } from '@shared/playlist-emojis';
import { useT } from '../i18n';

export function EmojiPicker({ value, onPick }: { value?: string; onPick: (emoji: string | null) => void }) {
  const t = useT();
  return (
    <div className="emoji-grid">
      {PLAYLIST_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="menuitemradio"
          aria-checked={value === emoji}
          className={`emoji-cell${value === emoji ? ' is-on' : ''}`}
          onClick={() => onPick(emoji)}
        >
          {emoji}
        </button>
      ))}
      <button type="button" role="menuitemradio" aria-checked={value === undefined} className="emoji-none" onClick={() => onPick(null)}>
        {t('playlist.noEmoji')}
      </button>
    </div>
  );
}
