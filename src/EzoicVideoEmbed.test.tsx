import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EzoicVideoEmbed } from './EzoicVideoEmbed';
import { OPEN_VIDEO_SCRIPT_URL } from './openVideo';
import type { EzoicWindow, OpenVideoPlayerEntry } from './types';

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

function markerCount(): number {
  return document.querySelectorAll('script[data-ezoic-sdk="open-video"]').length;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).openVideoPlayers;
});

afterEach(async () => {
  cleanup();
  await flushMicrotasks();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).openVideoPlayers;
  vi.restoreAllMocks();
});

describe('EzoicVideoEmbed', () => {
  it('injects the open.video script and pushes a player targeting its rendered element', () => {
    render(createElement(EzoicVideoEmbed, { videoId: 'abc', float: true }));
    expect(markerCount()).toBe(1);
    const script = document.querySelector('script[data-ezoic-sdk="open-video"]')!;
    expect(script.getAttribute('src')).toBe(OPEN_VIDEO_SCRIPT_URL);
    const w = window as unknown as EzoicWindow;
    const queue = w.openVideoPlayers as OpenVideoPlayerEntry[];
    expect(queue.length).toBe(1);
    const entry = queue[0]!;
    expect(entry.videoID).toBe('abc');
    expect(entry.float).toBe(true);
    // The target is the actual rendered DOM element.
    expect(entry.target).toBeInstanceOf(HTMLDivElement);
    expect(document.body.contains(entry.target as Element)).toBe(true);
  });

  it('applies id, className, and style to the container div', () => {
    render(
      createElement(EzoicVideoEmbed, {
        videoId: 'abc',
        id: 'ov-embed',
        className: 'ov-box',
        style: { minHeight: 300 },
      }),
    );
    const el = document.getElementById('ov-embed');
    expect(el).not.toBeNull();
    expect(el!.className).toBe('ov-box');
    expect(el!.style.minHeight).toBe('300px');
  });

  it('does not inject a second script on re-render', () => {
    const { rerender } = render(createElement(EzoicVideoEmbed, { videoId: 'abc' }));
    rerender(createElement(EzoicVideoEmbed, { videoId: 'abc' }));
    expect(markerCount()).toBe(1);
  });
});
