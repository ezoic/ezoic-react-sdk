// @vitest-environment node
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EzoicProvider, useEzoic } from './EzoicProvider';
import { EzoicAd } from './EzoicAd';
import { useEzoicPageView } from './useEzoicPageView';
import { useEzoicRewarded } from './useEzoicRewarded';
import {
  ensureRewardedScript,
  initRewardedAds,
  registerRewarded,
  requestRewarded,
  rewardedContentLocker,
} from './rewarded';

// These tests run in the Node environment (no jsdom): there is no `window` or
// `document`. They prove the provider renders on the server without touching
// browser globals, as required for react-dom/server and the Next.js app router.

describe('server-side rendering', () => {
  it('has no window/document in this environment', () => {
    expect(typeof window).toBe('undefined');
    expect(typeof document).toBe('undefined');
  });

  it('renders EzoicProvider to a string without throwing or injecting scripts', () => {
    const html = renderToString(
      createElement(EzoicProvider, null, createElement('span', null, 'hello-ssr')),
    );
    expect(html).toContain('hello-ssr');
    // Effects do not run on the server, so no script tags are emitted.
    expect(html).not.toContain('ezojs.com');
    expect(html).not.toContain('gatekeeperconsent');
  });

  it('renders a child that reads useEzoic without throwing and reports not-ready', () => {
    function Child(): string {
      const { isReady } = useEzoic();
      return `ready:${String(isReady)}`;
    }
    const html = renderToString(createElement(EzoicProvider, null, createElement(Child)));
    expect(html).toContain('ready:false');
  });

  it('renders EzoicAd to a bare placeholder div on the server without touching window', () => {
    const html = renderToString(
      createElement(EzoicProvider, null, createElement(EzoicAd, { id: 101 })),
    );
    expect(html).toContain('id="ezoic-pub-ad-placeholder-101"');
    // No script injection happens on the server.
    expect(html).not.toContain('ezojs.com');
  });

  it('renders a child calling useEzoicPageView without throwing or touching window', () => {
    function Child(): string {
      useEzoicPageView('/initial-route', { ids: [101, 102] });
      return 'pageview-ok';
    }
    const html = renderToString(createElement(EzoicProvider, null, createElement(Child)));
    expect(html).toContain('pageview-ok');
    // The effect never runs on the server, so no ad calls and no scripts.
    expect(html).not.toContain('ezojs.com');
  });

  it('renders a child calling useEzoicRewarded without throwing and reports not-ready', () => {
    function Child(): string {
      const { ready, initiated } = useEzoicRewarded({
        loaderUrl: 'https://go.example-host.com/porpoiseant/ezadloadrewarded.js',
      });
      return `rewarded:${String(ready)}:${String(initiated)}`;
    }
    const html = renderToString(createElement(EzoicProvider, null, createElement(Child)));
    expect(html).toContain('rewarded:false:false');
  });

  it('rewarded fire-and-forget passthroughs are safe no-ops on the server', () => {
    expect(() => registerRewarded()).not.toThrow();
    expect(() =>
      ensureRewardedScript('https://go.example-host.com/porpoiseant/ezadloadrewarded.js'),
    ).not.toThrow();
    expect(() => rewardedContentLocker('https://example.com/premium')).not.toThrow();
    expect(() => initRewardedAds({ anchor: true })).not.toThrow();
  });

  it('rewarded promise wrappers reject on the server rather than touching window', async () => {
    await expect(requestRewarded()).rejects.toThrow(/only available in the browser/);
  });
});
