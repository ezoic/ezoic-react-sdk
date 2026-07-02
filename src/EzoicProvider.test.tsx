import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook } from '@testing-library/react';
import { EzoicProvider, useEzoic } from './EzoicProvider';
import type { EzoicWindow } from './types';

function markerCount(marker: string): number {
  return document.querySelectorAll(`script[data-ezoic-sdk="${marker}"]`).length;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
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
    ] as const) {
      expect(typeof result.current[name]).toBe('function');
    }
  });

  it('reports isReady true once mounted and queues commands via push', () => {
    const { result } = renderHook(() => useEzoic(), {
      wrapper: ({ children }) => createElement(EzoicProvider, null, children),
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
