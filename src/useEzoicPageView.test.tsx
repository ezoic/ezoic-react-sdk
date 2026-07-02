import { createElement, StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { EzoicProvider } from './EzoicProvider';
import { resetAdManagerState } from './adManager';
import { useEzoicPageView, type UseEzoicPageViewOptions } from './useEzoicPageView';
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

type Props = { k: string; ids?: number[] };

function renderPageView(initialProps: Props, strict = false) {
  const wrapper = ({ children }: { children: ReactNode }): ReactNode => {
    const provider = createElement(EzoicProvider, null, children);
    return strict ? createElement(StrictMode, null, provider) : provider;
  };
  return renderHook(
    ({ k, ids }: Props) => useEzoicPageView(k, { ids } satisfies UseEzoicPageViewOptions),
    { initialProps, wrapper },
  );
}

beforeEach(() => {
  resetAdManagerState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  cleanup();
  resetAdManagerState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('useEzoicPageView', () => {
  it('fires nothing on the initial render', () => {
    const api = installEzstandalone();
    renderPageView({ k: '/a', ids: [101, 102] });
    expect(api.destroyPlaceholders).not.toHaveBeenCalled();
    expect(api.destroyAll).not.toHaveBeenCalled();
    expect(api.showAds).not.toHaveBeenCalled();
  });

  it('on route change destroys the departing ids then shows the new ids, in order', () => {
    const api = installEzstandalone();
    const { rerender } = renderPageView({ k: '/a', ids: [101, 102] });
    api.destroyPlaceholders.mockClear();
    api.showAds.mockClear();

    rerender({ k: '/b', ids: [103, 104] });

    expect(api.destroyPlaceholders).toHaveBeenCalledTimes(1);
    expect(api.destroyPlaceholders).toHaveBeenCalledWith(101, 102);
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith(103, 104);
    expect(api.destroyAll).not.toHaveBeenCalled();
    // destroy must run before showAds.
    expect(api.destroyPlaceholders.mock.invocationCallOrder[0]!).toBeLessThan(
      api.showAds.mock.invocationCallOrder[0]!,
    );
  });

  it('without ids, a route change calls destroyAll then showAds() (scan-all), in order', () => {
    const api = installEzstandalone();
    const { rerender } = renderPageView({ k: '/a' });
    api.destroyAll.mockClear();
    api.showAds.mockClear();

    rerender({ k: '/b' });

    expect(api.destroyAll).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledTimes(1);
    expect(api.showAds).toHaveBeenCalledWith();
    expect(api.destroyPlaceholders).not.toHaveBeenCalled();
    expect(api.destroyAll.mock.invocationCallOrder[0]!).toBeLessThan(
      api.showAds.mock.invocationCallOrder[0]!,
    );
  });

  it('does nothing when the pageKey is unchanged across a re-render', () => {
    const api = installEzstandalone();
    const { rerender } = renderPageView({ k: '/a', ids: [101] });
    api.destroyPlaceholders.mockClear();
    api.showAds.mockClear();

    // Same key, new array instance (simulates an unrelated parent re-render).
    rerender({ k: '/a', ids: [101] });

    expect(api.destroyPlaceholders).not.toHaveBeenCalled();
    expect(api.showAds).not.toHaveBeenCalled();
    expect(api.destroyAll).not.toHaveBeenCalled();
  });

  it('fires once per route change across several navigations', () => {
    const api = installEzstandalone();
    const { rerender } = renderPageView({ k: '/a', ids: [101] });
    api.destroyPlaceholders.mockClear();
    api.showAds.mockClear();

    rerender({ k: '/b', ids: [102] });
    rerender({ k: '/c', ids: [103] });

    expect(api.showAds).toHaveBeenCalledTimes(2);
    expect(api.showAds).toHaveBeenNthCalledWith(1, 102);
    expect(api.showAds).toHaveBeenNthCalledWith(2, 103);
    expect(api.destroyPlaceholders).toHaveBeenNthCalledWith(1, 101);
    expect(api.destroyPlaceholders).toHaveBeenNthCalledWith(2, 102);
  });

  it('does not fire on mount under StrictMode (double-invoked effects)', () => {
    const api = installEzstandalone();
    renderPageView({ k: '/a', ids: [101] }, true);
    expect(api.destroyPlaceholders).not.toHaveBeenCalled();
    expect(api.destroyAll).not.toHaveBeenCalled();
    expect(api.showAds).not.toHaveBeenCalled();
  });

  it('queues route-change calls (does not throw) before the bundle loads', () => {
    // No mock bundle installed: calls are queued on the on-demand cmd stub.
    const { rerender } = renderPageView({ k: '/a', ids: [101] });
    expect(() => rerender({ k: '/b', ids: [102] })).not.toThrow();
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezstandalone?.cmd)).toBe(true);
  });
});
