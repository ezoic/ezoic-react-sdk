import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEzoicRewarded } from './useEzoicRewarded';
import { REWARDED_EVENTS } from './rewarded';
import type { EzoicCommandQueue, EzoicWindow } from './types';

const LOADER_URL = 'https://go.example-host.com/porpoiseant/ezadloadrewarded.js';

function immediateQueue(): EzoicCommandQueue {
  return {
    push: (fn: () => void) => {
      fn();
      return 0;
    },
  } as unknown as EzoicCommandQueue;
}

function installRewardedAds(ready: boolean): Record<string, unknown> {
  const api: Record<string, unknown> = {
    ready,
    request: vi.fn((cb: (d: unknown) => void) => cb({ status: true, msg: 'ad ready' })),
  };
  (window as unknown as EzoicWindow).ezRewardedAds = {
    cmd: immediateQueue(),
    ...api,
  } as unknown as EzoicWindow['ezRewardedAds'];
  return api;
}

function emit(name: string): void {
  act(() => {
    window.dispatchEvent(new Event(name));
  });
}

beforeEach(() => {
  document.head.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezRewardedAds;
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezRewardedAds;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useEzoicRewarded', () => {
  it('returns initial state and the wrapper methods with no loader present', () => {
    const { result } = renderHook(() => useEzoicRewarded());
    expect(result.current.ready).toBe(false);
    expect(result.current.initiated).toBe(false);
    expect(result.current.displayed).toBe(false);
    expect(result.current.closed).toBe(false);
    expect(result.current.lastEvent).toBeUndefined();
    expect(typeof result.current.request).toBe('function');
    expect(typeof result.current.requestWithOverlay).toBe('function');
    expect(typeof result.current.contentLocker).toBe('function');
    expect(typeof result.current.initRewardedAds).toBe('function');
  });

  it('injects the loader script once when loaderUrl is provided', () => {
    const { rerender } = renderHook((props: { loaderUrl?: string }) => useEzoicRewarded(props), {
      initialProps: { loaderUrl: LOADER_URL },
    });
    rerender({ loaderUrl: LOADER_URL });
    expect(document.querySelectorAll('script[data-ezoic-sdk="rewarded-loader"]').length).toBe(1);
    expect(
      document.querySelector('script[data-ezoic-sdk="rewarded-loader"]')!.getAttribute('src'),
    ).toBe(LOADER_URL);
  });

  it('does not inject a loader when loaderUrl is omitted', () => {
    renderHook(() => useEzoicRewarded());
    expect(document.querySelectorAll('script[data-ezoic-sdk="rewarded-loader"]').length).toBe(0);
  });

  it('reports ready immediately when the loader has already initialized', () => {
    // installRewardedAds provides an immediate-executor cmd queue (loaded loader),
    // so the queued readiness marker runs synchronously on mount.
    installRewardedAds(true);
    const { result } = renderHook(() => useEzoicRewarded());
    expect(result.current.ready).toBe(true);
  });

  it('marks ready when the loader later drains its queued readiness command', () => {
    const { result } = renderHook(() => useEzoicRewarded());
    expect(result.current.ready).toBe(false);
    // The hook queued a readiness marker on the array stub. Simulate the loader
    // initializing exactly as setupCommandQueue does: swap cmd to an immediate
    // executor, set ready, then drain the previously-queued functions.
    act(() => {
      const w = window as unknown as EzoicWindow;
      const queued = w.ezRewardedAds!.cmd as unknown as Array<() => void>;
      (w.ezRewardedAds as unknown as { ready?: boolean; cmd: EzoicCommandQueue }).cmd = {
        push: (f: () => void) => f(),
      } as unknown as EzoicCommandQueue;
      (w.ezRewardedAds as unknown as { ready?: boolean }).ready = true;
      queued.forEach((f) => f());
    });
    expect(result.current.ready).toBe(true);
  });

  it('reflects the rewarded lifecycle window events in state', () => {
    const { result } = renderHook(() => useEzoicRewarded());

    emit(REWARDED_EVENTS.INITIATED);
    expect(result.current.initiated).toBe(true);
    expect(result.current.displayed).toBe(false);
    expect(result.current.lastEvent).toBe(REWARDED_EVENTS.INITIATED);

    emit(REWARDED_EVENTS.DISPLAYED);
    expect(result.current.displayed).toBe(true);
    expect(result.current.lastEvent).toBe(REWARDED_EVENTS.DISPLAYED);

    emit(REWARDED_EVENTS.CLOSED);
    expect(result.current.closed).toBe(true);
    expect(result.current.lastEvent).toBe(REWARDED_EVENTS.CLOSED);
  });

  it('resets displayed/closed when a new flow starts (initiated again)', () => {
    const { result } = renderHook(() => useEzoicRewarded());
    emit(REWARDED_EVENTS.INITIATED);
    emit(REWARDED_EVENTS.DISPLAYED);
    emit(REWARDED_EVENTS.CLOSED);
    expect(result.current.displayed).toBe(true);
    expect(result.current.closed).toBe(true);

    emit(REWARDED_EVENTS.INITIATED);
    expect(result.current.initiated).toBe(true);
    expect(result.current.displayed).toBe(false);
    expect(result.current.closed).toBe(false);
  });

  it('stops updating state after unmount (listeners removed)', () => {
    const { result, unmount } = renderHook(() => useEzoicRewarded());
    emit(REWARDED_EVENTS.INITIATED);
    expect(result.current.initiated).toBe(true);
    unmount();
    // Dispatching after unmount must not throw and must not update the snapshot.
    window.dispatchEvent(new Event(REWARDED_EVENTS.DISPLAYED));
    expect(result.current.displayed).toBe(false);
  });

  it('exposes methods wired to the rewarded module', async () => {
    const api = installRewardedAds(true);
    const { result } = renderHook(() => useEzoicRewarded());
    const outcome = await result.current.request({ minCPM: 1 });
    expect(outcome).toEqual({ status: true, msg: 'ad ready' });
    expect(api.request).toHaveBeenCalledWith(expect.any(Function), { minCPM: 1 });
  });
});
