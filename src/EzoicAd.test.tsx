import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { EzoicAd, type EzoicAdProps } from './EzoicAd';
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

/** Installs a bundle whose cmd runs immediately, with a stubbed GetGeneratedIdAsync. */
function installEzstandaloneWithLocations(generatedId?: number | string): {
  showAds: ReturnType<typeof vi.fn>;
  destroyPlaceholders: ReturnType<typeof vi.fn>;
  getGeneratedId: ReturnType<typeof vi.fn>;
} {
  const showAds = vi.fn();
  const destroyPlaceholders = vi.fn();
  const getGeneratedId = vi.fn((location: string) =>
    generatedId === undefined ? Promise.resolve(location) : Promise.resolve(generatedId),
  );
  const api: Partial<EzstandaloneApi> = {
    cmd: {
      push: (fn: () => void) => {
        fn();
        return 0;
      },
    } as unknown as EzoicCommandQueue,
    showAds,
    destroyPlaceholders,
  };
  if (generatedId !== undefined) api.GetGeneratedIdAsync = getGeneratedId;
  (window as unknown as EzoicWindow).ezstandalone = api as EzstandaloneApi;
  return { showAds, destroyPlaceholders, getGeneratedId };
}

/** Flushes the async resolution chain (cmd -> GetGeneratedIdAsync -> acquire -> setState). */
const settleLocation = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 6; i += 1) await Promise.resolve();
  });
};

describe('EzoicAd zero-config location', () => {
  it('resolves a location via GetGeneratedIdAsync, renders its div, and shows it', async () => {
    const { showAds, getGeneratedId } = installEzstandaloneWithLocations(909);
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { location: 'under_first_paragraph' }),
      ),
    );
    await settleLocation();
    expect(getGeneratedId).toHaveBeenCalledWith('under_first_paragraph');
    expect(divCount(909)).toBe(1);
    expect(showAds).toHaveBeenCalledWith(909);
  });

  it('coerces a numeric-string id from the bundle', async () => {
    const { showAds } = installEzstandaloneWithLocations('915');
    render(createElement(EzoicProvider, null, createElement(EzoicAd, { location: 'incontent_5' })));
    await settleLocation();
    expect(divCount(915)).toBe(1);
    expect(showAds).toHaveBeenCalledWith(915);
  });

  it('falls back to the static map when the bundle lacks GetGeneratedIdAsync', async () => {
    const { showAds } = installEzstandaloneWithLocations(); // no async API
    render(createElement(EzoicProvider, null, createElement(EzoicAd, { location: 'mid_content' })));
    await settleLocation();
    expect(divCount(911)).toBe(1);
    expect(showAds).toHaveBeenCalledWith(911);
  });

  it('errors and renders nothing for an unknown location', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installEzstandaloneWithLocations(909);
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { location: 'not_a_place' } as unknown as EzoicAdProps),
      ),
    );
    await settleLocation();
    expect(error).toHaveBeenCalledOnce();
    expect(document.querySelector('[id^="ezoic-pub-ad-placeholder-"]')).toBeNull();
  });

  it('errors and renders nothing when both id and location are given', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    installEzstandaloneWithLocations(909);
    render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { id: 101, location: 'top_of_page' } as unknown as EzoicAdProps),
      ),
    );
    await settleLocation();
    expect(error).toHaveBeenCalledOnce();
    expect(document.querySelector('[id^="ezoic-pub-ad-placeholder-"]')).toBeNull();
  });

  it('destroys the resolved placeholder on unmount', async () => {
    const { destroyPlaceholders } = installEzstandaloneWithLocations(909);
    const { unmount } = render(
      createElement(
        EzoicProvider,
        null,
        createElement(EzoicAd, { location: 'under_first_paragraph' }),
      ),
    );
    await settleLocation();
    unmount();
    await flushMicrotasks();
    expect(destroyPlaceholders).toHaveBeenCalledWith(909);
  });
});
