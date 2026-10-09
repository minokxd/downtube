import { Film, Music } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { MediaKind } from '@shared/types';

export function Thumb({ src, className = '', kind = 'video' }: { src?: string; className?: string; kind?: MediaKind }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) {
    const Icon = kind === 'audio' ? Music : Film;
    return (
      <div className={`${className} thumb-fallback`} aria-hidden="true">
        <Icon size={18} />
      </div>
    );
  }
  return <img src={src} className={className} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} />;
}
