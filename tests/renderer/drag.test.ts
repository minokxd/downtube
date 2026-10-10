import { describe, expect, it } from 'vitest';
import { ITEMS_MIME, anchorFor, dropSide, hasDragItems, readDragItems, writeDragItems } from '../../src/renderer/src/lib/drag';

class FakeDataTransfer {
  private readonly data = new Map<string, string>();
  effectAllowed = 'none';
  get types(): string[] {
    return [...this.data.keys()];
  }
  setData(type: string, value: string): void {
    this.data.set(type, value);
  }
  getData(type: string): string {
    return this.data.get(type) ?? '';
  }
}

const transfer = () => new FakeDataTransfer() as unknown as DataTransfer;

describe('drag data', () => {
  it('writes the ids and reads them back', () => {
    const dt = transfer();
    writeDragItems(dt, ['a', 'b']);
    expect(dt.effectAllowed).toBe('copyMove');
    expect(hasDragItems(dt)).toBe(true);
    expect(readDragItems(dt)).toEqual(['a', 'b']);
  });

  it('does not treat other drags, such as files, as library items', () => {
    const dt = transfer();
    dt.setData('Files', 'x');
    expect(hasDragItems(dt)).toBe(false);
    expect(readDragItems(dt)).toEqual([]);
  });

  it('reads nothing from malformed data', () => {
    const dt = transfer();
    dt.setData(ITEMS_MIME, '{not json');
    expect(readDragItems(dt)).toEqual([]);
    dt.setData(ITEMS_MIME, JSON.stringify({ ids: ['a'] }));
    expect(readDragItems(dt)).toEqual([]);
    dt.setData(ITEMS_MIME, JSON.stringify(['a', 3, null, 'b']));
    expect(readDragItems(dt)).toEqual(['a', 'b']);
  });
});

describe('drop position', () => {
  const rect = { left: 100, width: 200 };

  it('drops before a card on its left half and after it on its right half', () => {
    expect(dropSide(150, rect)).toBe('before');
    expect(dropSide(250, rect)).toBe('after');
  });

  it('turns the side into the id to insert before', () => {
    const order = ['a', 'b', 'c'];
    expect(anchorFor(order, 'b', 'before')).toBe('b');
    expect(anchorFor(order, 'b', 'after')).toBe('c');
    expect(anchorFor(order, 'c', 'after')).toBeNull();
    expect(anchorFor(order, 'zz', 'before')).toBeNull();
  });
});
