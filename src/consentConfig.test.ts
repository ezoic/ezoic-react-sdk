import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONFIG_KEYS,
  config,
  enableConsent,
  hasAnchorAdBeenClosed,
  isInterstitialAllowed,
  isOutstreamAllowed,
  setDisablePersonalizedAds,
  setDisablePersonalizedStatistics,
  setEzoicAnchorAd,
  setInterstitialAllowed,
  setOutstreamAllowed,
} from './consentConfig';
import type { EzoicCommandQueue, EzoicWindow } from './types';

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone() {
  const api = {
    config: vi.fn(),
    enableConsent: vi.fn(),
    setDisablePersonalizedStatistics: vi.fn(),
    setDisablePersonalizedAds: vi.fn(),
    setEzoicAnchorAd: vi.fn(),
    hasAnchorAdBeenClosed: vi.fn(() => true),
    setInterstitialAllowed: vi.fn(),
    isInterstitialAllowed: vi.fn(() => true),
    setOutstreamAllowed: vi.fn(() => Promise.resolve(true)),
    isOutstreamAllowed: vi.fn(() => false),
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

beforeEach(() => {
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('CONFIG_KEYS', () => {
  it('is exactly the verified accepted config key set', () => {
    expect([...CONFIG_KEYS].sort()).toEqual(
      [
        'anchorAdExpansion',
        'anchorAdPosition',
        'disableInterstitial',
        'disableLeftSideRail',
        'disableRightSideRail',
        'disableSidebarFloating',
        'disableVideo',
        'limitCookies',
        'reservePlaceholderSpace',
        'vignetteDesktop',
        'vignetteMobile',
        'vignetteTablet',
      ].sort(),
    );
  });
});

describe('consent passthroughs', () => {
  it('enableConsent forwards to the bundle', () => {
    const api = installEzstandalone();
    enableConsent();
    expect(api.enableConsent).toHaveBeenCalledTimes(1);
    expect(api.enableConsent).toHaveBeenCalledWith();
  });

  it('setDisablePersonalizedStatistics forwards the flag', () => {
    const api = installEzstandalone();
    setDisablePersonalizedStatistics(true);
    expect(api.setDisablePersonalizedStatistics).toHaveBeenCalledWith(true);
  });

  it('setDisablePersonalizedAds forwards the flag', () => {
    const api = installEzstandalone();
    setDisablePersonalizedAds(false);
    expect(api.setDisablePersonalizedAds).toHaveBeenCalledWith(false);
  });

  it('does not throw when the bundle has not loaded (queued)', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    expect(() => enableConsent()).not.toThrow();
    const w = window as unknown as EzoicWindow;
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});

describe('config', () => {
  it('forwards only the accepted keys to ezstandalone.config', () => {
    const api = installEzstandalone();
    config({ anchorAdPosition: 'top', reservePlaceholderSpace: true, disableVideo: false });
    expect(api.config).toHaveBeenCalledTimes(1);
    expect(api.config).toHaveBeenCalledWith({
      anchorAdPosition: 'top',
      reservePlaceholderSpace: true,
      disableVideo: false,
    });
  });

  it('drops unknown keys and warns, forwarding only the valid ones', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const api = installEzstandalone();
    config({ anchorAdPosition: 'top', bogusKey: 1, another: true } as never);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('bogusKey');
    expect(warn.mock.calls[0]![0]).toContain('another');
    expect(api.config).toHaveBeenCalledWith({ anchorAdPosition: 'top' });
  });

  it('does not warn when every key is accepted', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    installEzstandalone();
    config({ limitCookies: true });
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('format toggles', () => {
  it('setEzoicAnchorAd forwards the flag', () => {
    const api = installEzstandalone();
    setEzoicAnchorAd(true);
    expect(api.setEzoicAnchorAd).toHaveBeenCalledWith(true);
  });

  it('setInterstitialAllowed forwards allowed and options', () => {
    const api = installEzstandalone();
    setInterstitialAllowed(true, { foo: 'bar' });
    expect(api.setInterstitialAllowed).toHaveBeenCalledWith(true, { foo: 'bar' });
  });

  it('isInterstitialAllowed returns the bundle result, undefined before load', () => {
    expect(isInterstitialAllowed()).toBeUndefined();
    const api = installEzstandalone();
    expect(isInterstitialAllowed()).toBe(true);
    expect(api.isInterstitialAllowed).toHaveBeenCalledTimes(1);
  });

  it('isOutstreamAllowed returns the bundle result, undefined before load', () => {
    expect(isOutstreamAllowed()).toBeUndefined();
    installEzstandalone();
    expect(isOutstreamAllowed()).toBe(false);
  });

  it('hasAnchorAdBeenClosed returns the bundle result, undefined before load', () => {
    expect(hasAnchorAdBeenClosed()).toBeUndefined();
    installEzstandalone();
    expect(hasAnchorAdBeenClosed()).toBe(true);
  });
});

describe('setOutstreamAllowed', () => {
  it('resolves the bundle result when the bundle has loaded', async () => {
    const api = installEzstandalone();
    const result = await setOutstreamAllowed(true, { source: 'test' });
    expect(api.setOutstreamAllowed).toHaveBeenCalledWith(true, { source: 'test' });
    expect(result).toBe(true);
  });

  it('queues the side effect and resolves undefined before the bundle loads', async () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    const result = await setOutstreamAllowed(false);
    expect(result).toBeUndefined();
    const w = window as unknown as EzoicWindow;
    // The side effect was queued on the on-demand cmd stub, not dropped.
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});
