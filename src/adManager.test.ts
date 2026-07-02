import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acquirePlaceholder,
  destroyAll,
  destroyPlaceholders,
  displayMore,
  isEzoicUser,
  refreshAds,
  releasePlaceholder,
  resetAdManagerState,
  setIsSinglePageApplication,
  showAds,
} from './adManager';
import type { EzoicCommandQueue, EzoicWindow } from './types';

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone() {
  const api = {
    showAds: vi.fn(),
    displayMore: vi.fn(),
    destroyPlaceholders: vi.fn(),
    destroyAll: vi.fn(),
    refreshAds: vi.fn(),
    isEzoicUser: vi.fn(() => true),
    setIsSinglePageApplication: vi.fn(),
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
  resetAdManagerState();
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(async () => {
  await flushMicrotasks();
  resetAdManagerState();
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('passthroughs', () => {
  it('showAds forwards bare ids to ezstandalone.showAds', () => {
    const api = installEzstandalone();
    showAds(101, 102);
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith(101, 102);
  });

  it('showAds forwards the object form unchanged', () => {
    const api = installEzstandalone();
    showAds({ id: 101, required: true, sizes: ['728x90'] });
    expect(api.showAds).toHaveBeenCalledWith({ id: 101, required: true, sizes: ['728x90'] });
  });

  it('displayMore, destroyPlaceholders, destroyAll, refreshAds forward correctly', () => {
    const api = installEzstandalone();
    displayMore(103, 104);
    destroyPlaceholders(101);
    destroyAll();
    refreshAds(105);
    expect(api.displayMore).toHaveBeenCalledWith(103, 104);
    expect(api.destroyPlaceholders).toHaveBeenCalledWith(101);
    expect(api.destroyAll).toHaveBeenCalledWith();
    expect(api.refreshAds).toHaveBeenCalledWith(105);
  });

  it('setIsSinglePageApplication forwards the flag to ezstandalone', () => {
    const api = installEzstandalone();
    setIsSinglePageApplication(true);
    expect(api.setIsSinglePageApplication).toHaveBeenCalledTimes(1);
    expect(api.setIsSinglePageApplication).toHaveBeenCalledWith(true);
  });

  it('isEzoicUser returns the bundle result and forwards percentage + callback', () => {
    const callback = vi.fn();
    const api = installEzstandalone();
    const result = isEzoicUser(10, callback);
    expect(result).toBe(true);
    expect(api.isEzoicUser).toHaveBeenCalledWith(10, callback);
  });

  it('isEzoicUser returns undefined and queues the callback before the bundle loads', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    const callback = vi.fn();
    const result = isEzoicUser(50, callback);
    expect(result).toBeUndefined();
    // The callback was queued on the on-demand cmd stub, not dropped.
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezstandalone?.cmd)).toBe(true);
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
    expect(callback).not.toHaveBeenCalled();
  });

  it('command passthroughs are no-ops on to a not-yet-loaded bundle (queued, not thrown)', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    expect(() => showAds(101)).not.toThrow();
    const w = window as unknown as EzoicWindow;
    // The command is stored on the plain-array stub and runs when the bundle loads.
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});

describe('acquirePlaceholder batching', () => {
  it('coalesces same-tick acquisitions into a single showAds with all ids', async () => {
    const api = installEzstandalone();
    expect(acquirePlaceholder({ id: 101 })).toBe(true);
    expect(acquirePlaceholder({ id: 102 })).toBe(true);
    expect(acquirePlaceholder({ id: 103 })).toBe(true);
    // Nothing fires synchronously — batching waits for the microtask.
    expect(api.showAds).not.toHaveBeenCalled();
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith(101, 102, 103);
  });

  it('passes required/sizes through as the object form, bare ids as integers', async () => {
    const api = installEzstandalone();
    acquirePlaceholder({ id: 101 });
    acquirePlaceholder({ id: 102, required: true, sizes: ['728x90'] });
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledWith(101, { id: 102, required: true, sizes: ['728x90'] });
  });

  it('warns and returns false for a duplicate id, keeping one batch entry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = installEzstandalone();
    expect(acquirePlaceholder({ id: 101 })).toBe(true);
    expect(acquirePlaceholder({ id: 101 })).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith(101);
  });
});

describe('releasePlaceholder', () => {
  it('drops an id released before the batch flushes (never shown, never destroyed)', async () => {
    const api = installEzstandalone();
    acquirePlaceholder({ id: 101 });
    acquirePlaceholder({ id: 102 });
    releasePlaceholder(101);
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith(102);
    expect(api.destroyPlaceholders).not.toHaveBeenCalled();
  });

  it('destroys an id released after it was shown', async () => {
    const api = installEzstandalone();
    acquirePlaceholder({ id: 101 });
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledWith(101);
    releasePlaceholder(101);
    expect(api.destroyPlaceholders).toHaveBeenCalledTimes(1);
    expect(api.destroyPlaceholders).toHaveBeenCalledWith(101);
  });

  it('lets the same id be re-acquired after release (registry frees it)', async () => {
    const api = installEzstandalone();
    acquirePlaceholder({ id: 101 });
    await flushMicrotasks();
    releasePlaceholder(101);
    // Re-acquire the freed id: no duplicate warning, shows again.
    expect(acquirePlaceholder({ id: 101 })).toBe(true);
    await flushMicrotasks();
    expect(api.showAds).toHaveBeenCalledTimes(2);
  });
});
