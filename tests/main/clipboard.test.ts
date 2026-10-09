import { describe, expect, it, vi } from 'vitest';
import { ClipboardWatcher } from '../../src/main/clipboard';

describe('ClipboardWatcher', () => {
  it('ignores what was on the clipboard before it started', () => {
    let text = 'https://youtu.be/jNQXAC9IVRw';
    const onLink = vi.fn();
    const watcher = new ClipboardWatcher(() => text, onLink, 60_000);
    watcher.start();
    watcher.tick();
    expect(onLink).not.toHaveBeenCalled();
    text = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
    watcher.tick();
    expect(onLink).toHaveBeenCalledWith('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    watcher.stop();
  });

  it('reports each link once and skips non-YouTube text', () => {
    let text = '';
    const onLink = vi.fn();
    const watcher = new ClipboardWatcher(() => text, onLink, 60_000);
    watcher.start();
    for (const value of ['hello world', 'https://vimeo.com/1', ' https://youtu.be/jNQXAC9IVRw ', 'other', 'https://youtu.be/jNQXAC9IVRw']) {
      text = value;
      watcher.tick();
    }
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onLink).toHaveBeenCalledWith('https://youtu.be/jNQXAC9IVRw');
    watcher.stop();
  });

  it('survives clipboard read errors', () => {
    const watcher = new ClipboardWatcher(
      () => {
        throw new Error('locked');
      },
      vi.fn(),
      60_000,
    );
    watcher.start();
    expect(() => watcher.tick()).not.toThrow();
    watcher.stop();
  });
});

// Electron 44's main-process clipboard.readText() only returns a promise.
describe('ClipboardWatcher with an asynchronous reader', () => {
  const settle = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

  it('ignores the initial clipboard, then reports a new link once', async () => {
    let text = 'https://youtu.be/jNQXAC9IVRw';
    const onLink = vi.fn();
    const watcher = new ClipboardWatcher(() => Promise.resolve(text), onLink, 60_000);
    watcher.start();
    await settle();
    watcher.tick();
    await settle();
    expect(onLink).not.toHaveBeenCalled();
    text = 'https://www.youtube.com/watch?v=aaaaaaaaaaa';
    watcher.tick();
    await settle();
    watcher.tick();
    await settle();
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(onLink).toHaveBeenCalledWith('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    watcher.stop();
  });

  it('does not start a second read while one is still pending', async () => {
    let finish: (text: string) => void = () => undefined;
    const read = vi.fn(() => new Promise<string>((resolve) => (finish = resolve)));
    const watcher = new ClipboardWatcher(read, vi.fn(), 60_000);
    watcher.start();
    watcher.tick();
    watcher.tick();
    expect(read).toHaveBeenCalledTimes(1);
    finish('');
    await settle();
    watcher.tick();
    expect(read).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it('survives rejected reads', async () => {
    const watcher = new ClipboardWatcher(() => Promise.reject(new Error('locked')), vi.fn(), 60_000);
    watcher.start();
    await settle();
    expect(() => watcher.tick()).not.toThrow();
    await settle();
    watcher.stop();
  });

  it('drops a read that finishes after stop and re-baselines on restart', async () => {
    let text = 'https://youtu.be/jNQXAC9IVRw';
    let finish: (value: string) => void = () => undefined;
    let slow = false;
    const onLink = vi.fn();
    const watcher = new ClipboardWatcher(
      () => (slow ? new Promise<string>((resolve) => (finish = resolve)) : Promise.resolve(text)),
      onLink,
      60_000,
    );
    watcher.start();
    await settle();
    slow = true;
    watcher.tick();
    watcher.stop();
    finish('https://www.youtube.com/watch?v=aaaaaaaaaaa');
    await settle();
    expect(onLink).not.toHaveBeenCalled();
    // Copied while the watcher was off: it must not be announced when watching resumes.
    slow = false;
    text = 'https://www.youtube.com/watch?v=bbbbbbbbbbb';
    watcher.start();
    await settle();
    watcher.tick();
    await settle();
    expect(onLink).not.toHaveBeenCalled();
    watcher.stop();
  });
});
