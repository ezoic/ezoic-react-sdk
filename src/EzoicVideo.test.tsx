import { StrictMode, createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EzoicVideo } from './EzoicVideo';
import { EzoicProvider } from './EzoicProvider';
import { resetVideoState } from './video';
import type { EzoicCommandQueue, EzoicWindow, EzstandaloneApi } from './types';

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone(): {
  defineVideo: ReturnType<typeof vi.fn>;
  displayMoreVideo: ReturnType<typeof vi.fn>;
  destroyVideoPlaceholders: ReturnType<typeof vi.fn>;
} {
  const defineVideo = vi.fn();
  const displayMoreVideo = vi.fn();
  const destroyVideoPlaceholders = vi.fn();
  (window as unknown as EzoicWindow).ezstandalone = {
    cmd: {
      push: (fn: () => void) => {
        fn();
        return 0;
      },
    } as unknown as EzoicCommandQueue,
    defineVideo,
    displayMoreVideo,
    destroyVideoPlaceholders,
  } as EzstandaloneApi;
  return { defineVideo, displayMoreVideo, destroyVideoPlaceholders };
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

function divCount(id: string): number {
  return document.querySelectorAll(`#${id}`).length;
}

beforeEach(() => {
  resetVideoState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(async () => {
  cleanup();
  await flushMicrotasks();
  resetVideoState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('EzoicVideo rendering', () => {
  it('renders a div with the given id and loads it via displayMoreVideo after flush', async () => {
    const { defineVideo, displayMoreVideo } = installEzstandalone();
    render(createElement(EzoicProvider, null, createElement(EzoicVideo, { divId: 'my-video' })));
    expect(divCount('my-video')).toBe(1);
    await flushMicrotasks();
    expect(displayMoreVideo).toHaveBeenCalledWith('my-video');
    // The component path must never call defineVideo.
    expect(defineVideo).not.toHaveBeenCalled();
  });

  it('applies className and style to the container div', async () => {
    installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicVideo, {
          divId: 'styled-video',
          className: 'video-box',
          style: { minHeight: 240 },
        }),
      ),
    );
    const el = document.getElementById('styled-video');
    expect(el).not.toBeNull();
    expect(el!.className).toBe('video-box');
    expect(el!.style.minHeight).toBe('240px');
    await flushMicrotasks();
  });

  it('throws when rendered outside an EzoicProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(createElement(EzoicVideo, { divId: 'my-video' }))).toThrow(
      /must be used within an <EzoicProvider>/,
    );
    spy.mockRestore();
  });
});

describe('EzoicVideo batching', () => {
  it('mounts N videos as N divs and fires one displayMoreVideo with all ids', async () => {
    const { defineVideo, displayMoreVideo } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicVideo, { divId: 'a' }),
        createElement(EzoicVideo, { divId: 'b' }),
        createElement(EzoicVideo, { divId: 'c' }),
      ),
    );
    expect(divCount('a')).toBe(1);
    expect(divCount('b')).toBe(1);
    expect(divCount('c')).toBe(1);
    await flushMicrotasks();
    expect(displayMoreVideo).toHaveBeenCalledTimes(1);
    expect(displayMoreVideo).toHaveBeenCalledWith('a', 'b', 'c');
    expect(defineVideo).not.toHaveBeenCalled();
  });

  it('warns on a duplicate divId, renders a single div, and loads it once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { displayMoreVideo } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicVideo, { divId: 'dup' }),
        createElement(EzoicVideo, { divId: 'dup' }),
      ),
    );
    await flushMicrotasks();
    expect(warn).toHaveBeenCalledOnce();
    expect(divCount('dup')).toBe(1);
    expect(displayMoreVideo).toHaveBeenCalledTimes(1);
    expect(displayMoreVideo).toHaveBeenCalledWith('dup');
  });
});

describe('EzoicVideo lifecycle', () => {
  it('destroys the placeholder on unmount', async () => {
    const { destroyVideoPlaceholders } = installEzstandalone();
    const { unmount } = render(
      createElement(EzoicProvider, null, createElement(EzoicVideo, { divId: 'my-video' })),
    );
    await flushMicrotasks();
    unmount();
    await flushMicrotasks();
    expect(destroyVideoPlaceholders).toHaveBeenCalledTimes(1);
    expect(destroyVideoPlaceholders).toHaveBeenCalledWith('my-video');
  });

  it('nets one live div and correct teardown under StrictMode mount→unmount→mount', async () => {
    const { displayMoreVideo, destroyVideoPlaceholders } = installEzstandalone();
    render(
      createElement(
        StrictMode,
        null,
        createElement(EzoicProvider, null, createElement(EzoicVideo, { divId: 'strict-video' })),
      ),
    );
    await flushMicrotasks();
    expect(divCount('strict-video')).toBe(1);
    // StrictMode double-invokes the effect (mount→unmount→mount); the divId ends
    // up owned and loaded, with matched load/destroy calls in between.
    expect(displayMoreVideo).toHaveBeenCalledWith('strict-video');
    expect(destroyVideoPlaceholders.mock.calls.length).toBeLessThanOrEqual(
      displayMoreVideo.mock.calls.length,
    );
  });
});
