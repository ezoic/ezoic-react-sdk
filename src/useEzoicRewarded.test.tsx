import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { useEzoicRewarded, resetRewardedRuntimeInitForTests } from './useEzoicRewarded';
import { acquirePlaceholder, resetAdManagerState } from './adManager';
import { REWARDED_EVENTS } from './rewarded';
import type { EzoicCommandQueue, EzoicRewardedPlacements, EzoicWindow } from './types';

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

/**
 * Installs `window.ezstandalone` with an immediate-executor `cmd` queue and an
 * `initRewardedAds` spy, so default-mode assertions run the real
 * `initRewardedAds` → `pushToEzoicCmd` → `ezstandalone.initRewardedAds` path.
 *
 * `enabled` defaults to `true` so non-timing tests take the scheduler's fast
 * path and dispatch synchronously on mount. Timing tests pass `false` and drive
 * the deferred poll/grace paths with fake timers.
 */
function installEzstandalone(enabled = true): ReturnType<typeof vi.fn> {
  const initSpy = vi.fn();
  (window as unknown as EzoicWindow).ezstandalone = {
    cmd: immediateQueue(),
    enabled,
    initRewardedAds: initSpy,
  } as unknown as EzoicWindow['ezstandalone'];
  return initSpy;
}

/** Flips `window.ezstandalone.enabled` to simulate the initial ad load starting. */
function setEzstandaloneEnabled(enabled: boolean): void {
  const es = (window as unknown as EzoicWindow).ezstandalone as unknown as
    | { enabled?: boolean }
    | undefined;
  if (es) es.enabled = enabled;
}

function emit(name: string): void {
  act(() => {
    window.dispatchEvent(new Event(name));
  });
}

beforeEach(() => {
  document.head.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezRewardedAds;
  delete (window as unknown as EzoicWindow).ezstandalone;
  resetRewardedRuntimeInitForTests();
  resetAdManagerState();
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  // Remove any Ezoic placeholders / GPT containers a predicate-arm test added.
  document
    .querySelectorAll('[id^="ezoic-pub-ad-placeholder-"], [id^="div-gpt-ad"]')
    .forEach((el) => el.remove());
  delete (window as unknown as EzoicWindow).ezRewardedAds;
  delete (window as unknown as EzoicWindow).ezstandalone;
  resetRewardedRuntimeInitForTests();
  resetAdManagerState();
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

  it('injects the loader script once when loaderUrl is provided and does not call initRewardedAds', () => {
    const initSpy = installEzstandalone();
    const { rerender } = renderHook((props: { loaderUrl?: string }) => useEzoicRewarded(props), {
      initialProps: { loaderUrl: LOADER_URL },
    });
    rerender({ loaderUrl: LOADER_URL });
    expect(document.querySelectorAll('script[data-ezoic-sdk="rewarded-loader"]').length).toBe(1);
    expect(
      document.querySelector('script[data-ezoic-sdk="rewarded-loader"]')!.getAttribute('src'),
    ).toBe(LOADER_URL);
    // Escape-hatch mode never triggers the runtime-served init.
    expect(initSpy).not.toHaveBeenCalled();
  });

  it('ignores placements in explicit loaderUrl mode', () => {
    const initSpy = installEzstandalone();
    renderHook(() =>
      useEzoicRewarded({ loaderUrl: LOADER_URL, placements: { video: true } }),
    );
    expect(document.querySelectorAll('script[data-ezoic-sdk="rewarded-loader"]').length).toBe(1);
    expect(initSpy).not.toHaveBeenCalled();
  });

  describe('default (runtime-served) mode', () => {
    it('does not inject a loader when loaderUrl is omitted', () => {
      installEzstandalone();
      renderHook(() => useEzoicRewarded());
      expect(document.querySelectorAll('script[data-ezoic-sdk="rewarded-loader"]').length).toBe(0);
    });

    it('pushes initRewardedAds once across multiple hook instances and re-renders (no placements)', () => {
      const initSpy = installEzstandalone();
      function TwoHooks(): null {
        useEzoicRewarded();
        useEzoicRewarded();
        return null;
      }
      const { rerender } = render(<TwoHooks />);
      rerender(<TwoHooks />);
      rerender(<TwoHooks />);
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith(undefined);
    });

    it('skips initRewardedAds when an SDK-injected rewarded loader is already present', () => {
      const initSpy = installEzstandalone();
      const loader = document.createElement('script');
      loader.setAttribute('data-ezoic-sdk', 'rewarded-loader');
      loader.setAttribute('src', LOADER_URL);
      document.head.appendChild(loader);
      renderHook(() => useEzoicRewarded());
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('skips initRewardedAds when a host-HTML rewarded loader script is already present', () => {
      const initSpy = installEzstandalone();
      const loader = document.createElement('script');
      // No SDK marker — a hand-included loader on any host, with a cache buster.
      loader.setAttribute('src', 'https://cdn.example.com/porpoiseant/ezadloadrewarded.js?cb=123');
      document.head.appendChild(loader);
      renderHook(() => useEzoicRewarded());
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('still triggers initRewardedAds when only the SDK cmd-queue stub exists (no loader script)', () => {
      const initSpy = installEzstandalone();
      // The SDK's own rewarded cmd-queue stub must NOT count as a loader.
      (window as unknown as EzoicWindow).ezRewardedAds = {
        cmd: [],
      } as unknown as EzoicWindow['ezRewardedAds'];
      renderHook(() => useEzoicRewarded());
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith(undefined);
    });

    it('forwards the first mount placements to initRewardedAds exactly once', () => {
      const initSpy = installEzstandalone();
      const placements: EzoicRewardedPlacements = {
        anchor: false,
        interstitial: false,
        video: true,
        sideRails: false,
      };
      const { rerender } = renderHook(
        (props: { placements?: EzoicRewardedPlacements }) => useEzoicRewarded(props),
        { initialProps: { placements } },
      );
      // A later mount with different placements must not re-trigger (first wins).
      rerender({ placements: { video: false } });
      renderHook(() => useEzoicRewarded({ placements: { anchor: true } }));
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith(placements);
    });
  });

  describe('deferred init scheduling', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('does not dispatch initRewardedAds at mount when enabled is falsy', () => {
      const initSpy = installEzstandalone(false);
      renderHook(() => useEzoicRewarded());
      // Scheduler is armed but nothing has flipped enabled and no deadline hit.
      expect(initSpy).not.toHaveBeenCalled();
      vi.advanceTimersByTime(250);
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('dispatches once when enabled flips true before the grace deadline, then stops polling', () => {
      const initSpy = installEzstandalone(false);
      renderHook(() => useEzoicRewarded({ placements: { video: true } }));
      expect(initSpy).not.toHaveBeenCalled();

      act(() => {
        setEzstandaloneEnabled(true);
        vi.advanceTimersByTime(250);
      });
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({ video: true });

      // Poll interval and grace timer are cleared: no further dispatches.
      vi.advanceTimersByTime(10_000);
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('fires at the grace deadline when no display placements are mounted (rewarded-only page)', () => {
      const initSpy = installEzstandalone(false);
      renderHook(() => useEzoicRewarded({ placements: { anchor: true } }));
      expect(initSpy).not.toHaveBeenCalled();

      // No <EzoicAd> mounted → hasMountedPlacements() is false at the deadline.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({ anchor: true });
    });

    it('does NOT fire at the grace deadline when placements are mounted, then fires when enabled flips', () => {
      const initSpy = installEzstandalone(false);
      // Simulate a live display placement: a mounted <EzoicAd> owns an id.
      acquirePlaceholder({ id: 910 });
      renderHook(() => useEzoicRewarded({ placements: { video: true } }));

      // Deadline passes with placements present and enabled still false.
      act(() => {
        vi.advanceTimersByTime(4000);
      });
      expect(initSpy).not.toHaveBeenCalled();

      // Polling continues past the grace window; init fires when enabled flips.
      act(() => {
        setEzstandaloneEnabled(true);
        vi.advanceTimersByTime(250);
      });
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({ video: true });
    });

    it('schedules once across multiple default-mode consumers; the first caller placements win', () => {
      const initSpy = installEzstandalone(false);
      function TwoHooks(): null {
        useEzoicRewarded({ placements: { video: true } });
        useEzoicRewarded({ placements: { anchor: true } });
        return null;
      }
      render(<TwoHooks />);

      act(() => {
        setEzstandaloneEnabled(true);
        vi.advanceTimersByTime(250);
      });
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({ video: true });
    });

    it('keeps a started scheduler running after the consumer unmounts, then dispatches once', () => {
      const initSpy = installEzstandalone(false);
      const { unmount } = renderHook(() => useEzoicRewarded({ placements: { video: true } }));
      expect(initSpy).not.toHaveBeenCalled();

      // The initiating consumer unmounts before the load starts. The scheduler is
      // page-global and must NOT be cancelled by unmount.
      unmount();

      // The initial load later starts → the still-running poll dispatches once.
      act(() => {
        setEzstandaloneEnabled(true);
        vi.advanceTimersByTime(250);
      });
      expect(initSpy).toHaveBeenCalledTimes(1);
      expect(initSpy).toHaveBeenCalledWith({ video: true });
    });
  });

  describe('initial-ad-load predicate arms (fast path)', () => {
    it('dispatches when a /sa.go entry is in resource timing (public enabled stays false)', () => {
      const initSpy = installEzstandalone(false);
      // The real-page bug: public enabled never flips. The /sa.go resource entry
      // is the reliable signal that the initial ad request was issued.
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([
        { name: 'https://g.ezoic.net/sa.go?t=1' },
      ] as unknown as PerformanceEntryList);
      renderHook(() => useEzoicRewarded());
      // Fast path detects the /sa.go signal and dispatches synchronously.
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('dispatches when a GPT container is rendered inside an Ezoic placeholder (public enabled stays false)', () => {
      const initSpy = installEzstandalone(false);
      // Ezoic renders its GPT container inside the placeholder once the ad
      // response is rendering.
      const placeholder = document.createElement('div');
      placeholder.id = 'ezoic-pub-ad-placeholder-910';
      const gpt = document.createElement('div');
      gpt.id = 'div-gpt-ad-ezoic_com-medrectangle-4-0';
      placeholder.appendChild(gpt);
      document.body.appendChild(placeholder);
      renderHook(() => useEzoicRewarded());
      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('does NOT dispatch for a plain publisher GPT container outside any Ezoic placeholder', () => {
      const initSpy = installEzstandalone(false);
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([] as PerformanceEntryList);
      // Plain publisher-hardcoded GPT present before the Ezoic load — must not be
      // mistaken for the Ezoic initial load starting.
      const gpt = document.createElement('div');
      gpt.id = 'div-gpt-ad-publisher-slot-1';
      document.body.appendChild(gpt);
      renderHook(() => useEzoicRewarded());
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('does not dispatch when no initial-ad-load signal is present (all arms false)', () => {
      const initSpy = installEzstandalone(false);
      vi.spyOn(performance, 'getEntriesByType').mockReturnValue([] as PerformanceEntryList);
      renderHook(() => useEzoicRewarded());
      // enabled false, no /sa.go entry, no Ezoic-placeholder GPT → stays armed.
      expect(initSpy).not.toHaveBeenCalled();
    });
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
