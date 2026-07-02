import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPEN_VIDEO_SCRIPT_URL, ensureOpenVideoScript, pushOpenVideoPlayer } from './openVideo';
import type { EzoicWindow, OpenVideoPlayerEntry, OpenVideoPlayersQueue } from './types';

function markerCount(): number {
  return document.querySelectorAll('script[data-ezoic-sdk="open-video"]').length;
}
function srcCount(src: string): number {
  return Array.from(document.getElementsByTagName('script')).filter((s) => s.src === src).length;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).openVideoPlayers;
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).openVideoPlayers;
  vi.restoreAllMocks();
});

describe('ensureOpenVideoScript', () => {
  it('injects the open.video script once and seeds openVideoPlayers as an array', () => {
    ensureOpenVideoScript();
    const script = document.querySelector('script[data-ezoic-sdk="open-video"]')!;
    expect(script.getAttribute('src')).toBe(OPEN_VIDEO_SCRIPT_URL);
    expect(script.hasAttribute('async')).toBe(true);
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.openVideoPlayers)).toBe(true);
  });

  it('is idempotent — a second call adds no duplicate script', () => {
    ensureOpenVideoScript();
    ensureOpenVideoScript();
    expect(markerCount()).toBe(1);
    expect(srcCount(OPEN_VIDEO_SCRIPT_URL)).toBe(1);
  });

  it('recognizes a pre-existing host script carrying a cache-buster query (dedup by path)', () => {
    const host = document.createElement('script');
    host.src = `${OPEN_VIDEO_SCRIPT_URL}?cb=1720000000`;
    document.head.appendChild(host);
    ensureOpenVideoScript();
    expect(markerCount()).toBe(0);
    expect(
      Array.from(document.getElementsByTagName('script')).filter((s) =>
        s.src.startsWith(OPEN_VIDEO_SCRIPT_URL),
      ).length,
    ).toBe(1);
  });

  it('does nothing when given an empty script URL', () => {
    ensureOpenVideoScript('');
    expect(document.querySelectorAll('script[data-ezoic-sdk="open-video"]').length).toBe(0);
  });

  it('NEVER replaces a live handler object already installed on openVideoPlayers', () => {
    const push = vi.fn();
    const handler: OpenVideoPlayersQueue = { push, visited: true, players: [] };
    (window as unknown as EzoicWindow).openVideoPlayers = handler;
    ensureOpenVideoScript();
    const w = window as unknown as EzoicWindow;
    // Same object identity: the guard-only init left the live handler in place.
    expect(w.openVideoPlayers).toBe(handler);
  });
});

describe('pushOpenVideoPlayer', () => {
  it('pushes { target, videoID, float } onto the seeded array', () => {
    const el = document.createElement('div');
    const entry: OpenVideoPlayerEntry = { target: el, videoID: 'abc', float: true };
    pushOpenVideoPlayer(entry);
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.openVideoPlayers)).toBe(true);
    expect((w.openVideoPlayers as OpenVideoPlayerEntry[])[0]).toEqual(entry);
  });

  it('routes the push through a live handler object without replacing it', () => {
    const push = vi.fn();
    const handler: OpenVideoPlayersQueue = { push, visited: true };
    (window as unknown as EzoicWindow).openVideoPlayers = handler;
    const el = document.createElement('div');
    pushOpenVideoPlayer({ target: el, videoID: 'xyz' });
    const w = window as unknown as EzoicWindow;
    expect(w.openVideoPlayers).toBe(handler);
    expect(push).toHaveBeenCalledWith({ target: el, videoID: 'xyz' });
  });
});
