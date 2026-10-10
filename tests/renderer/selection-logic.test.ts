import { describe, expect, it } from 'vitest';
import {
  EMPTY_SELECTION,
  pruneSelection,
  rangeSelect,
  targetIds,
  toggleSelect,
} from '../../src/renderer/src/pages/library/selection-logic';

const order = ['a', 'b', 'c', 'd', 'e'];
const ids = (selection: { ids: ReadonlySet<string> }) => [...selection.ids].sort();

describe('toggleSelect', () => {
  it('adds and removes an id and moves the anchor to it', () => {
    const one = toggleSelect(EMPTY_SELECTION, 'b');
    expect(ids(one)).toEqual(['b']);
    expect(one.anchor).toBe('b');
    const none = toggleSelect(one, 'b');
    expect(ids(none)).toEqual([]);
    expect(EMPTY_SELECTION.ids.size).toBe(0);
  });
});

describe('rangeSelect', () => {
  it('selects from the anchor to the clicked id in either direction', () => {
    expect(ids(rangeSelect(toggleSelect(EMPTY_SELECTION, 'b'), order, 'd'))).toEqual(['b', 'c', 'd']);
    expect(ids(rangeSelect(toggleSelect(EMPTY_SELECTION, 'd'), order, 'b'))).toEqual(['b', 'c', 'd']);
  });

  it('keeps earlier picks and the anchor', () => {
    const picked = toggleSelect(toggleSelect(EMPTY_SELECTION, 'a'), 'd');
    const range = rangeSelect(picked, order, 'e');
    expect(ids(range)).toEqual(['a', 'd', 'e']);
    expect(range.anchor).toBe('d');
  });

  it('selects only the clicked id when there is no anchor', () => {
    const range = rangeSelect(EMPTY_SELECTION, order, 'c');
    expect(ids(range)).toEqual(['c']);
    expect(range.anchor).toBe('c');
  });

  it('ignores an id that is not shown', () => {
    const one = toggleSelect(EMPTY_SELECTION, 'a');
    expect(rangeSelect(one, order, 'zz')).toBe(one);
  });
});

describe('pruneSelection', () => {
  it('returns the same selection when everything is still shown', () => {
    const one = toggleSelect(EMPTY_SELECTION, 'a');
    expect(pruneSelection(one, new Set(order))).toBe(one);
  });

  it('drops hidden ids and a hidden anchor', () => {
    const two = toggleSelect(toggleSelect(EMPTY_SELECTION, 'a'), 'b');
    const pruned = pruneSelection(two, new Set(['a', 'c']));
    expect(ids(pruned)).toEqual(['a']);
    expect(pruned.anchor).toBeNull();
  });
});

describe('targetIds', () => {
  it('acts on the whole selection, in display order, when the item is part of it', () => {
    const two = toggleSelect(toggleSelect(EMPTY_SELECTION, 'd'), 'b');
    expect(targetIds(two, order, 'd')).toEqual(['b', 'd']);
  });

  it('acts on the item alone when it is not selected', () => {
    const one = toggleSelect(EMPTY_SELECTION, 'a');
    expect(targetIds(one, order, 'c')).toEqual(['c']);
  });
});
