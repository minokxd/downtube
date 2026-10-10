import { ChevronDown, ListMinus, ListMusic } from 'lucide-react';
import { useT } from '../../i18n';

export function SelectionBar({
  count,
  onAddTo,
  onRemoveFromPlaylist,
  onClear,
}: {
  count: number;
  /** Opens the playlist picker under the button. */
  onAddTo: (x: number, y: number) => void;
  /** Only on the user's playlist page. */
  onRemoveFromPlaylist?: () => void;
  onClear: () => void;
}) {
  const t = useT();
  return (
    <div className="selection-bar" role="toolbar" aria-label={t('selection.count', { count })}>
      <span className="selection-count" aria-live="polite">
        {t('selection.count', { count })}
      </span>
      <button
        type="button"
        className="btn btn-sm"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onAddTo(rect.left, rect.bottom + 4);
        }}
      >
        <ListMusic size={14} aria-hidden="true" />
        {t('playlist.addTo')}
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {onRemoveFromPlaylist && (
        <button type="button" className="btn btn-sm" onClick={onRemoveFromPlaylist}>
          <ListMinus size={14} aria-hidden="true" />
          {t('playlist.removeFrom')}
        </button>
      )}
      <button type="button" className="btn btn-sm btn-ghost" onClick={onClear}>
        {t('selection.clear')}
      </button>
    </div>
  );
}
