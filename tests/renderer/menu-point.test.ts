import { describe, expect, it } from 'vitest';
import { menuPoint } from '../../src/renderer/src/lib/menu-point';

const target = { getBoundingClientRect: () => ({ left: 100, bottom: 240 }) };

describe('menuPoint', () => {
  it('opens at the pointer for a mouse right-click', () => {
    expect(menuPoint({ clientX: 30, clientY: 40, currentTarget: target })).toEqual({ x: 30, y: 40 });
  });

  it('opens under the element when the menu key or Shift+F10 was used', () => {
    expect(menuPoint({ clientX: 0, clientY: 0, currentTarget: target })).toEqual({ x: 116, y: 240 });
  });
});
