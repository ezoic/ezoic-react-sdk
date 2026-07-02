import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { EzoicAd } from './EzoicAd';
import { EzoicProvider } from './EzoicProvider';
import { resetAdManagerState } from './adManager';
import type { EzoicCommandQueue, EzoicWindow, EzstandaloneApi } from './types';

/** Installs a mock `window.ezstandalone` whose cmd queue runs commands immediately. */
function installEzstandalone(): {
  showAds: ReturnType<typeof vi.fn>;
  destroyPlaceholders: ReturnType<typeof vi.fn>;
} {
  const showAds = vi.fn();
  const destroyPlaceholders = vi.fn();
  (window as unknown as EzoicWindow).ezstandalone = {
    cmd: {
      push: (fn: () => void) => {
        fn();
        return 0;
      },
    } as unknown as EzoicCommandQueue,
    showAds,
    destroyPlaceholders,
  } as EzstandaloneApi;
  return { showAds, destroyPlaceholders };
}

const flushMicrotasks = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

function divCount(id: number): number {
  return document.querySelectorAll(`#ezoic-pub-ad-placeholder-${id}`).length;
}

beforeEach(() => {
  resetAdManagerState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(async () => {
  cleanup();
  await flushMicrotasks();
  resetAdManagerState();
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
  vi.restoreAllMocks();
});

describe('EzoicAd rendering', () => {
  it('renders a bare placeholder div carrying only the id attribute', async () => {
    installEzstandalone();
    render(createElement(EzoicProvider, null, createElement(EzoicAd, { id: 101 })));
    const el = document.getElementById('ezoic-pub-ad-placeholder-101');
    expect(el).not.toBeNull();
    expect(el!.tagName).toBe('DIV');
    // No styling, class, or other attributes — only the id.
    expect(el!.getAttributeNames()).toEqual(['id']);
    await flushMicrotasks();
  });

  it('renders nothing and errors (does not throw) for an out-of-range id', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installEzstandalone();
    expect(() =>
      render(createElement(EzoicProvider, null, createElement(EzoicAd, { id: 1000 }))),
    ).not.toThrow();
    expect(divCount(1000)).toBe(0);
    expect(error).toHaveBeenCalledOnce();
    await flushMicrotasks();
  });

  it('throws when rendered outside an EzoicProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(createElement(EzoicAd, { id: 101 }))).toThrow(
      /must be used within an <EzoicProvider>/,
    );
    spy.mockRestore();
  });
});

describe('EzoicAd showAds batching', () => {
  it('mounts N ads as N divs and fires exactly one showAds with all ids', async () => {
    const { showAds } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { id: 101 }),
        createElement(EzoicAd, { id: 102 }),
        createElement(EzoicAd, { id: 103 }),
      ),
    );
    expect(divCount(101)).toBe(1);
    expect(divCount(102)).toBe(1);
    expect(divCount(103)).toBe(1);
    await flushMicrotasks();
    expect(showAds).toHaveBeenCalledTimes(1);
    expect(showAds).toHaveBeenCalledWith(101, 102, 103);
  });

  it('passes required and sizes through as the showAds object form', async () => {
    const { showAds } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { id: 101, required: true, sizes: ['728x90', '970x250'] }),
      ),
    );
    await flushMicrotasks();
    expect(showAds).toHaveBeenCalledWith({
      id: 101,
      required: true,
      sizes: ['728x90', '970x250'],
    });
  });

  it('drops invalid sizes with a warning and still shows the placeholder', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { showAds } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { id: 101, sizes: ['728x90', 'huge', '300'] }),
      ),
    );
    await flushMicrotasks();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(showAds).toHaveBeenCalledWith({ id: 101, sizes: ['728x90'] });
  });
});

describe('EzoicAd lifecycle', () => {
  it('destroys the placeholder on unmount', async () => {
    const { destroyPlaceholders } = installEzstandalone();
    const { unmount } = render(
      createElement(EzoicProvider, null, createElement(EzoicAd, { id: 101 })),
    );
    await flushMicrotasks();
    unmount();
    await flushMicrotasks();
    expect(destroyPlaceholders).toHaveBeenCalledTimes(1);
    expect(destroyPlaceholders).toHaveBeenCalledWith(101);
  });

  it('warns on a duplicate id, renders a single div, and requests it once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { showAds } = installEzstandalone();
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { id: 101 }),
        createElement(EzoicAd, { id: 101 }),
      ),
    );
    await flushMicrotasks();
    expect(warn).toHaveBeenCalledOnce();
    expect(divCount(101)).toBe(1);
    expect(showAds).toHaveBeenCalledTimes(1);
    expect(showAds).toHaveBeenCalledWith(101);
  });
});
