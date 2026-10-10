import { useCallback, useEffect, useMemo, useState } from 'react';
import { EMPTY_SELECTION, pruneSelection, rangeSelect, targetIds, toggleSelect, type Selection } from './selection-logic';

export interface Modifiers {
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}

export interface SelectionApi {
  ids: ReadonlySet<string>;
  /** Ctrl/Cmd+click toggles, Shift+click selects a range; returns false for a plain click. */
  click: (id: string, modifiers: Modifiers) => boolean;
  clear: () => void;
  /** The ids an action on `id` applies to, in display order. */
  targets: (id: string) => string[];
}

/** Multi-select over the items shown in `order`. A new `resetKey` (tab, search, open page) or Escape clears it. */
export function useSelection(order: readonly string[], resetKey: string): SelectionApi {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  const shown = useMemo(() => new Set(order), [order]);

  useEffect(() => setSelection(EMPTY_SELECTION), [resetKey]);
  useEffect(() => setSelection((current) => pruneSelection(current, shown)), [shown]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelection(EMPTY_SELECTION);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const click = useCallback(
    (id: string, modifiers: Modifiers): boolean => {
      if (modifiers.shiftKey) setSelection((current) => rangeSelect(current, order, id));
      else if (modifiers.ctrlKey || modifiers.metaKey) setSelection((current) => toggleSelect(current, id));
      else return false;
      return true;
    },
    [order],
  );
  const clear = useCallback(() => setSelection(EMPTY_SELECTION), []);
  const targets = useCallback((id: string) => targetIds(selection, order, id), [selection, order]);
  return useMemo(() => ({ ids: selection.ids, click, clear, targets }), [selection.ids, click, clear, targets]);
}
