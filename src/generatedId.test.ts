import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveGeneratedId } from './generatedId';
import type { EzoicCommandQueue, EzoicWindow, EzstandaloneApi } from './types';

/**
 * Installs a mock `window.ezstandalone` whose cmd queue runs commands
 * immediately (mimicking a loaded bundle). `generatedId` controls what
 * `GetGeneratedIdAsync` resolves to; omit it to simulate a bundle without the
 * async API.
 */
function installBundle(
  opts: {
    generatedId?: number | string;
    reject?: boolean;
    omitAsync?: boolean;
  } = {},
): void {
  const api: Partial<EzstandaloneApi> = {
    cmd: {
      push: (fn: () => void) => {
        fn();
        return 0;
      },
    } as unknown as EzoicCommandQueue,
    // showAds present so the fallback timer treats the bundle as loaded.
    showAds: vi.fn(),
  };
  if (!opts.omitAsync) {
    api.GetGeneratedIdAsync = vi.fn(() =>
      opts.reject ? Promise.reject(new Error('no fill')) : Promise.resolve(opts.generatedId ?? 0),
    );
  }
  (window as unknown as EzoicWindow).ezstandalone = api as EzstandaloneApi;
}

beforeEach(() => {
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('resolveGeneratedId — primary (GetGeneratedIdAsync)', () => {
  it('resolves the id the bundle returns as a number', async () => {
    installBundle({ generatedId: 909 });
    await expect(resolveGeneratedId('under_first_paragraph', undefined, -1)).resolves.toBe(909);
  });

  it('coerces a numeric-string result to a number', async () => {
    installBundle({ generatedId: '915' });
    await expect(resolveGeneratedId('incontent_5', undefined, -1)).resolves.toBe(915);
  });

  it('falls back to the static map when the bundle returns a non-id', async () => {
    installBundle({ generatedId: 0 });
    // under_first_paragraph -> 909 from the static map.
    await expect(resolveGeneratedId('under_first_paragraph', undefined, -1)).resolves.toBe(909);
  });

  it('falls back to the static map when GetGeneratedIdAsync rejects', async () => {
    installBundle({ reject: true });
    await expect(resolveGeneratedId('mid_content', undefined, -1)).resolves.toBe(911);
  });
});

describe('resolveGeneratedId — fallback (static map)', () => {
  it('uses the static map when the bundle loaded without the async API', async () => {
    installBundle({ omitAsync: true });
    await expect(resolveGeneratedId('top_of_page', undefined, -1)).resolves.toBe(900);
  });

  it('uses the static map when the bundle never loads (timer fires)', async () => {
    // No bundle installed: the queued command never runs; the timer fires.
    await expect(resolveGeneratedId('under_first_paragraph', undefined, 5)).resolves.toBe(909);
  });

  it('honours the isTaken hint to pick a free id for a repeated location', async () => {
    installBundle({ omitAsync: true });
    await expect(resolveGeneratedId('mid_content', (id) => id === 911, -1)).resolves.toBe(915);
  });

  it('rejects an unknown location', async () => {
    installBundle({ omitAsync: true });
    await expect(resolveGeneratedId('not_a_place', undefined, -1)).rejects.toThrow(
      /Unknown zero-config location/,
    );
  });
});
