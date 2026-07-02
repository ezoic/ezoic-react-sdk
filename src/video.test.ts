import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquireVideo,
  defineVideo,
  destroyVideoPlaceholders,
  displayMoreVideo,
  releaseVideo,
  resetVideoState,
} from './video';
import type { EzoicCommandQueue, EzoicWindow } from './types';

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone() {
  const api = {
    defineVideo: vi.fn(),
    displayMoreVideo: vi.fn(),
    destroyVideoPlaceholders: vi.fn(),
  };
  (window as unknown as EzoicWindow).ezstandalone = {
    cmd: {
      push: (fn: () => void) => {
        fn();
        return 0;
      },
    } as unknown as EzoicCommandQueue,
    ...api,
  };
  return api;
}

/** Yields to the microtask queue so a scheduled batch flush runs. */
const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  resetVideoState();
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(async () => {
  await flushMicrotasks();
  resetVideoState();
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('passthroughs', () => {
  it('defineVideo forwards bare ids and the object form to ezstandalone.defineVideo', () => {
    const api = installEzstandalone();
    defineVideo('a', { divID: 'b' });
    expect(api.defineVideo).toHaveBeenCalledTimes(1);
    expect(api.defineVideo).toHaveBeenCalledWith('a', { divID: 'b' });
  });

  it('displayMoreVideo and destroyVideoPlaceholders forward correctly', () => {
    const api = installEzstandalone();
    displayMoreVideo('a', 'b');
    destroyVideoPlaceholders('c');
    expect(api.displayMoreVideo).toHaveBeenCalledWith('a', 'b');
    expect(api.destroyVideoPlaceholders).toHaveBeenCalledWith('c');
  });

  it('passthroughs are queued (not thrown) before the bundle loads', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    expect(() => defineVideo('a')).not.toThrow();
    const w = window as unknown as EzoicWindow;
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});

describe('acquireVideo batching', () => {
  it('coalesces same-tick acquisitions into one displayMoreVideo(all) and never calls defineVideo', async () => {
    const api = installEzstandalone();
    expect(acquireVideo('a')).toBe(true);
    expect(acquireVideo('b')).toBe(true);
    // Nothing fires synchronously — batching waits for the microtask.
    expect(api.displayMoreVideo).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledTimes(1);
    expect(api.displayMoreVideo).toHaveBeenCalledWith('a', 'b');
    // The component path must never call defineVideo.
    expect(api.defineVideo).not.toHaveBeenCalled();
  });

  it('appends new ids on a later flush without clobbering (one displayMoreVideo per tick)', async () => {
    const api = installEzstandalone();
    acquireVideo('a');
    acquireVideo('b');
    await flushMicrotasks();
    // A third acquisition in a later tick.
    expect(acquireVideo('c')).toBe(true);
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledTimes(2);
    // First tick loads a, b; second tick loads only the newly-added c.
    expect(api.displayMoreVideo.mock.calls[0]!).toEqual(['a', 'b']);
    expect(api.displayMoreVideo.mock.calls[1]!).toEqual(['c']);
    expect(api.defineVideo).not.toHaveBeenCalled();
  });

  it('warns and returns false for a duplicate divId, adding no second queued id', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = installEzstandalone();
    expect(acquireVideo('a')).toBe(true);
    expect(acquireVideo('a')).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledTimes(1);
    expect(api.displayMoreVideo).toHaveBeenCalledWith('a');
  });
});

describe('releaseVideo', () => {
  it('drops a divId released before the batch flushes (never loaded, never destroyed)', async () => {
    const api = installEzstandalone();
    acquireVideo('a');
    acquireVideo('b');
    releaseVideo('a');
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledTimes(1);
    expect(api.displayMoreVideo).toHaveBeenCalledWith('b');
    expect(api.destroyVideoPlaceholders).not.toHaveBeenCalled();
  });

  it('destroys a divId released after it was loaded', async () => {
    const api = installEzstandalone();
    acquireVideo('a');
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledWith('a');
    releaseVideo('a');
    expect(api.destroyVideoPlaceholders).toHaveBeenCalledTimes(1);
    expect(api.destroyVideoPlaceholders).toHaveBeenCalledWith('a');
  });

  it('lets the same divId be re-acquired after release (registry frees it)', async () => {
    const api = installEzstandalone();
    acquireVideo('a');
    await flushMicrotasks();
    releaseVideo('a');
    // Re-acquire the freed id: no duplicate warning, loads again.
    expect(acquireVideo('a')).toBe(true);
    await flushMicrotasks();
    expect(api.displayMoreVideo).toHaveBeenCalledTimes(2);
  });
});
