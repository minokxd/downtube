import type { LibraryItem } from '@shared/types';
import { thumbUrl } from '../lib/media-url';
import { Thumb } from './Thumb';

export function LibraryThumb({ item, className }: { item: LibraryItem; className?: string }) {
  return <Thumb src={item.thumbPath ? thumbUrl(item.id) : undefined} className={className} kind={item.kind} />;
}
