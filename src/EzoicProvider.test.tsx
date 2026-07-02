import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import { EzoicProvider, useEzoic } from './EzoicProvider';
import { resetAdManagerState } from './adManager';
import type { EzoicCommandQueue, EzoicWindow } from './types';

function markerCount(marker: string): number {
  return document.querySelectorAll(`script[data-ezoic-sdk="${marker}"]`).length;
}

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone() {
  const api = { setIsSinglePageApplication: vi.fn() };
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

describe('EzoicProvider', () => {
  it('injects the full script chain on mount', () => {
    render(createElement(EzoicProvider, null, createElement('div')));
    expect(markerCount('cmp1')).toBe(1);
    expect(markerCount('cmp2')).toBe(1);
    expect(markerCount('cmd-stub')).toBe(1);
    expect(markerCount('sa')).toBe(1);
  });

  it('does not inject duplicate scripts after unmount and remount', () => {
    const { unmount } = render(createElement(EzoicProvider, null, createElement('div')));
    unmount();
    render(createElement(EzoicProvider, null, createElement('div')));
    expect(markerCount('cmp1')).toBe(1);
    expect(markerCount('cmp2')).toBe(1);
    expect(markerCount('cmd-stub')).toBe(1);
    expect(markerCount('sa')).toBe(1);
  });

  it('renders its children', () => {
    const { getByText } = render(
      createElement(EzoicProvider, null, createElement('span', null, 'child-content')),
    );
    expect(getByText('child-content')).not.toBeNull();
  });

  it('marks the page as a single-page application at boot by default', () => {
    const api = installEzstandalone();
    render(createElement(EzoicProvider, null, createElement('div')));
    expect(api.setIsSinglePageApplication).toHaveBeenCalledTimes(1);
    expect(api.setIsSinglePageApplication).toHaveBeenCalledWith(true);
  });

  it('does not set single-page mode when singlePageApp is false', () => {
    const api = installEzstandalone();
    render(createElement(EzoicProvider, { singlePageApp: false }, createElement('div')));
    expect(api.setIsSinglePageApplication).not.toHaveBeenCalled();
  });
});

describe('useEzoic', () => {
  it('throws when used outside of an EzoicProvider', () => {
    // Silence the expected React error boundary console output.
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useEzoic())).toThrow(/must be used within an <EzoicProvider>/);
    spy.mockRestore();
  });

  it('exposes the standalone passthroughs as functions', () => {
    const { result } = renderHook(() => useEzoic(), {
      wrapper: ({ children }) => createElement(EzoicProvider, null, children),
    });
    for (const name of [
      'showAds',
      'displayMore',
      'destroyPlaceholders',
      'destroyAll',
      'refreshAds',
      'isEzoicUser',
      'setIsSinglePageApplication',
    ] as const) {
      expect(typeof result.current[name]).toBe('function');
    }
  });

  it('reports isReady true once mounted and queues commands via push', () => {
    // singlePageApp={false} so the boot does not queue a setIsSinglePageApplication
    // command; this keeps the assertion focused on `push` alone.
    const { result } = renderHook(() => useEzoic(), {
      wrapper: ({ children }) => createElement(EzoicProvider, { singlePageApp: false }, children),
    });
    expect(result.current.isReady).toBe(true);

    let ran = false;
    result.current.push(() => {
      ran = true;
    });
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezstandalone?.cmd)).toBe(true);
    // Pre-init the queue is a plain array; the command is stored, not yet run.
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
    expect(ran).toBe(false);
  });
});
