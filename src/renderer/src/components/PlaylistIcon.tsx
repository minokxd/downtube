import { ListMusic } from 'lucide-react';

export function PlaylistIcon({ emoji, size = 16 }: { emoji?: string; size?: number }) {
  if (emoji) {
    return (
      <span className="playlist-emoji" aria-hidden="true">
        {emoji}
      </span>
    );
  }
  return <ListMusic size={size} className="playlist-emoji" aria-hidden="true" />;
}
