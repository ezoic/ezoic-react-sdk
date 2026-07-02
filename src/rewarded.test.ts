import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REWARDED_EVENTS,
  ensureRewardedScript,
  initRewardedAds,
  pushToRewardedCmd,
  registerRewarded,
  requestAndShowRewarded,
  requestRewarded,
  requestRewardedWithOverlay,
  rewardedContentLocker,
  showRewarded,
} from './rewarded';
import type { EzoicCommandQueue, EzoicWindow } from './types';

const LOADER_URL = 'https://go.example-host.com/porpoiseant/ezadloadrewarded.js';

/** A cmd queue whose push() runs the command immediately (loader "loaded"). */
function immediateQueue(): EzoicCommandQueue {
  return {
    push: (fn: () => void) => {
      fn();
      return 0;
    },
  } as unknown as EzoicCommandQueue;
}

/**
 * Installs a mock `window.ezRewardedAds` whose cmd queue runs immediately and
 * whose methods invoke their callback synchronously with a representative
 * outcome. Individual methods can be overridden (e.g. omitted to simulate a
 * method missing after the loader initialized).
 */
function installRewardedAds(overrides: Record<string, unknown> = {}) {
  const api: Record<string, unknown> = {
    ready: true,
    register: vi.fn(),
    request: vi.fn((cb: (d: unknown) => void) =>
      cb({ status: true, msg: 'ad ready', adInfo: { fill: 1 } }),
    ),
    show: vi.fn((cb: (d: unknown) => void, config?: { userInfo?: unknown }) =>
      cb({ status: true, reward: true, msg: 'ad closed', adInfo: {}, userInfo: config?.userInfo }),
    ),
    requestAndShow: vi.fn((cb: (d: unknown) => void) =>
      cb({ status: true, reward: true, msg: 'ad closed' }),
    ),
    requestWithOverlay: vi.fn((cb: (d: unknown) => void) =>
      cb({ status: true, reward: false, msg: 'user cancelled' }),
    ),
    contentLocker: vi.fn(),
    ...overrides,
  };
  (window as unknown as EzoicWindow).ezRewardedAds = {
    cmd: immediateQueue(),
    ...api,
  } as unknown as EzoicWindow['ezRewardedAds'];
  return api;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezRewardedAds;
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezRewardedAds;
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('REWARDED_EVENTS', () => {
  it('exposes the verified rewarded window event names', () => {
    expect(REWARDED_EVENTS.INITIATED).toBe('ezRewardedInitiated');
    expect(REWARDED_EVENTS.DISPLAYED).toBe('ezRewardedDisplayed');
    expect(REWARDED_EVENTS.CLOSED).toBe('ezRewardedClosed');
  });
});

describe('pushToRewardedCmd', () => {
  it('creates the stub queue on demand when called before the loader', () => {
    pushToRewardedCmd(() => undefined);
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezRewardedAds?.cmd)).toBe(true);
    expect((w.ezRewardedAds!.cmd as unknown as unknown[]).length).toBe(1);
  });
});

describe('ensureRewardedScript', () => {
  function markerCount(marker: string): number {
    return document.querySelectorAll(`script[data-ezoic-sdk="${marker}"]`).length;
  }
  function srcCount(src: string): number {
    return Array.from(document.getElementsByTagName('script')).filter((s) => s.src === src).length;
  }

  it('injects the cmd stub before the async loader, in order', () => {
    ensureRewardedScript(LOADER_URL);
    const markers = Array.from(document.querySelectorAll('script[data-ezoic-sdk]')).map((s) =>
      s.getAttribute('data-ezoic-sdk'),
    );
    expect(markers).toEqual(['rewarded-stub', 'rewarded-loader']);
    const loader = document.querySelector('script[data-ezoic-sdk="rewarded-loader"]')!;
    expect(loader.getAttribute('src')).toBe(LOADER_URL);
    expect(loader.hasAttribute('async')).toBe(true);
  });

  it('creates the ezRewardedAds cmd queue so commands can be pushed', () => {
    ensureRewardedScript(LOADER_URL);
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezRewardedAds?.cmd)).toBe(true);
  });

  it('is idempotent — a second call adds no duplicate scripts', () => {
    ensureRewardedScript(LOADER_URL);
    ensureRewardedScript(LOADER_URL);
    expect(markerCount('rewarded-stub')).toBe(1);
    expect(markerCount('rewarded-loader')).toBe(1);
  });

  it('tolerates a pre-existing host loader with the same src', () => {
    const host = document.createElement('script');
    host.src = LOADER_URL;
    document.head.appendChild(host);
    ensureRewardedScript(LOADER_URL);
    expect(srcCount(LOADER_URL)).toBe(1);
    expect(markerCount('rewarded-loader')).toBe(0);
  });

  it('recognizes a pre-existing host loader carrying a cache-buster query (dedup by path)', () => {
    const host = document.createElement('script');
    host.src = `${LOADER_URL}?cb=1720000000`;
    document.head.appendChild(host);
    ensureRewardedScript(LOADER_URL);
    // The path matches, so the SDK adds no second rewarded loader.
    expect(markerCount('rewarded-loader')).toBe(0);
    expect(
      Array.from(document.getElementsByTagName('script')).filter((s) =>
        s.src.startsWith(LOADER_URL),
      ).length,
    ).toBe(1);
  });

  it('does nothing when given an empty loader URL', () => {
    ensureRewardedScript('');
    expect(document.querySelectorAll('script[data-ezoic-sdk]').length).toBe(0);
  });
});

describe('promise wrappers resolve with the native callback outcome', () => {
  it('requestRewarded resolves { status, msg, adInfo } and forwards config', async () => {
    const api = installRewardedAds();
    const outcome = await requestRewarded({ minCPM: 2, rewardType: 'coins', rewardAmount: 5 });
    expect(outcome).toEqual({ status: true, msg: 'ad ready', adInfo: { fill: 1 } });
    expect(api.request).toHaveBeenCalledWith(expect.any(Function), {
      minCPM: 2,
      rewardType: 'coins',
      rewardAmount: 5,
    });
  });

  it('showRewarded resolves { status, reward, msg, ... } and echoes userInfo', async () => {
    const api = installRewardedAds();
    const outcome = await showRewarded({ rewardName: 'r', userInfo: { uid: 7 } });
    expect(outcome.status).toBe(true);
    expect(outcome.reward).toBe(true);
    expect(outcome.userInfo).toEqual({ uid: 7 });
    expect(api.show).toHaveBeenCalledWith(expect.any(Function), {
      rewardName: 'r',
      userInfo: { uid: 7 },
    });
  });

  it('requestAndShowRewarded resolves the show outcome', async () => {
    const api = installRewardedAds();
    const outcome = await requestAndShowRewarded({ rewardOnNoFill: true });
    expect(outcome).toEqual({ status: true, reward: true, msg: 'ad closed' });
    expect(api.requestAndShow).toHaveBeenCalledWith(expect.any(Function), { rewardOnNoFill: true });
  });

  it('requestRewardedWithOverlay forwards overlay text and config', async () => {
    const api = installRewardedAds();
    const text = { header: 'Unlock', body: ['Watch an ad'] };
    const outcome = await requestRewardedWithOverlay(text, { rewardName: 'article' });
    expect(outcome.reward).toBe(false);
    expect(api.requestWithOverlay).toHaveBeenCalledWith(expect.any(Function), text, {
      rewardName: 'article',
    });
  });
});

describe('promise wrappers guard against a missing method', () => {
  it('rejects when the loader is present but the method is not a function', async () => {
    installRewardedAds({ request: undefined });
    await expect(requestRewarded()).rejects.toThrow(/window\.ezRewardedAds\.request/);
  });

  it('queues the call (promise stays pending) when the loader has not loaded', () => {
    delete (window as unknown as EzoicWindow).ezRewardedAds;
    const p = requestRewarded();
    // Guard against any late rejection surfacing as an unhandled rejection.
    p.catch(() => undefined);
    const w = window as unknown as EzoicWindow;
    expect((w.ezRewardedAds!.cmd as unknown as unknown[]).length).toBe(1);
  });
});

describe('fire-and-forget passthroughs', () => {
  it('registerRewarded forwards to the native register', () => {
    const api = installRewardedAds();
    registerRewarded();
    expect(api.register).toHaveBeenCalledTimes(1);
  });

  it('rewardedContentLocker forwards the action and config', () => {
    const api = installRewardedAds();
    const action = vi.fn();
    const config = { rewardName: 'unlock' };
    rewardedContentLocker(action, config);
    expect(api.contentLocker).toHaveBeenCalledWith(action, config);
  });

  it('does not throw when the loader has not loaded', () => {
    delete (window as unknown as EzoicWindow).ezRewardedAds;
    expect(() => registerRewarded()).not.toThrow();
    expect(() => rewardedContentLocker('https://example.com/premium')).not.toThrow();
  });
});

describe('initRewardedAds', () => {
  it('drives ezstandalone.initRewardedAds through the ezstandalone cmd queue', () => {
    const initFn = vi.fn();
    (window as unknown as EzoicWindow).ezstandalone = {
      cmd: immediateQueue(),
      initRewardedAds: initFn,
    };
    initRewardedAds({ anchor: true, interstitial: false });
    expect(initFn).toHaveBeenCalledWith({ anchor: true, interstitial: false });
  });

  it('does not throw when ezstandalone has not loaded', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    expect(() => initRewardedAds()).not.toThrow();
    const w = window as unknown as EzoicWindow;
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});
