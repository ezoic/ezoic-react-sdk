import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useEzoicConsent } from './useEzoicConsent';
import type { EzoicWindow, TcfData } from './types';

/**
 * Installs a controllable mock `window.__tcfapi`. `emit` invokes the registered
 * `addEventListener` callback; `removeListener` records `removeEventListener`.
 */
function installTcfApi() {
  let callback: ((tcData: TcfData, success: boolean) => void) | undefined;
  const removeListener = vi.fn<(listenerId?: number) => void>();
  const api = vi.fn(
    (
      command: string,
      _version: number,
      cb: (tcData: TcfData, success: boolean) => void,
      param?: number | string,
    ) => {
      if (command === 'addEventListener') callback = cb;
      if (command === 'removeEventListener') removeListener(param as number | undefined);
    },
  );
  (window as unknown as EzoicWindow).__tcfapi = api as unknown as EzoicWindow['__tcfapi'];
  return {
    api,
    removeListener,
    emit: (tcData: TcfData, success = true) => {
      act(() => callback?.(tcData, success));
    },
  };
}

beforeEach(() => {
  delete (window as unknown as EzoicWindow).__tcfapi;
});

afterEach(() => {
  cleanup();
  delete (window as unknown as EzoicWindow).__tcfapi;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useEzoicConsent', () => {
  it('returns the initial state when no CMP is present', () => {
    const { result } = renderHook(() => useEzoicConsent());
    expect(result.current).toEqual({ cmpPresent: false, tcfReady: false });
  });

  it('registers a TCF listener and reports a loaded consent string', () => {
    const tcf = installTcfApi();
    const { result } = renderHook(() => useEzoicConsent());
    expect(tcf.api).toHaveBeenCalledWith('addEventListener', 2, expect.any(Function));
    tcf.emit({
      eventStatus: 'tcloaded',
      cmpStatus: 'loaded',
      tcString: 'CONSENT123',
      gdprApplies: true,
      listenerId: 7,
    });
    expect(result.current).toEqual({
      cmpPresent: true,
      tcfReady: true,
      tcString: 'CONSENT123',
      gdprApplies: true,
      eventStatus: 'tcloaded',
      cmpStatus: 'loaded',
    });
  });

  it('treats useractioncomplete as ready and cmpuishown as not-yet-ready', () => {
    const tcf = installTcfApi();
    const { result } = renderHook(() => useEzoicConsent());

    tcf.emit({ eventStatus: 'cmpuishown', cmpStatus: 'loaded', gdprApplies: true, listenerId: 1 });
    expect(result.current.cmpPresent).toBe(true);
    expect(result.current.tcfReady).toBe(false);

    tcf.emit({
      eventStatus: 'useractioncomplete',
      cmpStatus: 'loaded',
      tcString: 'ABC',
      gdprApplies: true,
      listenerId: 1,
    });
    expect(result.current.tcfReady).toBe(true);
    expect(result.current.tcString).toBe('ABC');
  });

  it('marks the CMP present but not ready when the callback reports failure', () => {
    const tcf = installTcfApi();
    const { result } = renderHook(() => useEzoicConsent());
    tcf.emit({} as TcfData, false);
    expect(result.current.cmpPresent).toBe(true);
    expect(result.current.tcfReady).toBe(false);
    expect(result.current.tcString).toBeUndefined();
  });

  it('removes the TCF listener on unmount', () => {
    const tcf = installTcfApi();
    const { unmount } = renderHook(() => useEzoicConsent());
    tcf.emit({ eventStatus: 'tcloaded', tcString: 'X', listenerId: 42 });
    unmount();
    expect(tcf.removeListener).toHaveBeenCalledWith(42);
  });

  it('polls for a late-injected __tcfapi and then registers', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useEzoicConsent());
    // No CMP yet: still initial.
    expect(result.current.cmpPresent).toBe(false);

    const tcf = installTcfApi();
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(tcf.api).toHaveBeenCalledWith('addEventListener', 2, expect.any(Function));

    act(() => {
      // The poll registered a real callback; emit through the same channel.
      tcf.api.mock.calls
        .filter((c) => c[0] === 'addEventListener')
        .forEach((c) =>
          (c[2] as (d: TcfData, s: boolean) => void)(
            { eventStatus: 'tcloaded', tcString: 'LATE', listenerId: 3 },
            true,
          ),
        );
    });
    expect(result.current.tcfReady).toBe(true);
    expect(result.current.tcString).toBe('LATE');
  });
});
