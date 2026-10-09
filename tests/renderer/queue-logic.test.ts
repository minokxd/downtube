import { describe, expect, it } from 'vitest';
import { moveInOrder, nextIndex, prevIndex, removeFromOrder, shuffleOrder } from '../../src/renderer/src/player/queue-logic';

describe('shuffleOrder', () => {
  it('puts the chosen track first and keeps every id', () => {
    const result = shuffleOrder(['a', 'b', 'c', 'd'], 'a', () => 0);
    expect(result).toEqual(['a', 'c', 'd', 'b']);
    expect([...result].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shuffles everything when no first id is given', () => {
    const result = shuffleOrder(['a', 'b', 'c'], undefined, () => 0.5);
    expect([...result].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('nextIndex', () => {
  it.each([
    [3, 0, 'off', true, 1],
    [3, 2, 'off', true, null],
    [3, 2, 'all', true, 0],
    [3, 1, 'one', true, 1],
    [3, 1, 'one', false, 2],
    [0, 0, 'all', true, null],
  ] as const)('length %i, index %i, repeat %s, auto %s → %s', (length, index, repeat, auto, expected) => {
    expect(nextIndex(length, index, repeat, auto)).toBe(expected);
  });
});

describe('prevIndex', () => {
  it('steps back and wraps only with repeat all', () => {
    expect(prevIndex(3, 2, 'off')).toBe(1);
    expect(prevIndex(3, 0, 'off')).toBe(0);
    expect(prevIndex(3, 0, 'all')).toBe(2);
  });
});

describe('removeFromOrder', () => {
  it('keeps the current track selected', () => {
    expect(removeFromOrder(['a', 'b', 'c'], 1, 0)).toEqual({ order: ['b', 'c'], index: 0 });
    expect(removeFromOrder(['a', 'b', 'c'], 1, 1)).toEqual({ order: ['a', 'c'], index: 1 });
    expect(removeFromOrder(['a', 'b', 'c'], 2, 2)).toEqual({ order: ['a', 'b'], index: 1 });
    expect(removeFromOrder(['a', 'b', 'c'], 1, 2)).toEqual({ order: ['a', 'b'], index: 1 });
  });
});

describe('moveInOrder', () => {
  it('swaps neighbours and follows the current track', () => {
    expect(moveInOrder(['a', 'b', 'c'], 0, 0, 1)).toEqual({ order: ['b', 'a', 'c'], index: 1 });
    expect(moveInOrder(['a', 'b', 'c'], 0, 1, -1)).toEqual({ order: ['b', 'a', 'c'], index: 1 });
    expect(moveInOrder(['a', 'b'], 0, 0, -1)).toEqual({ order: ['a', 'b'], index: 0 });
  });
});
