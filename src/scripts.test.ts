import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CMP_SCRIPT_URL_1, SA_SCRIPT_URL, ensureEzoicScripts, pushToEzoicCmd } from './scripts';
import type { EzoicWindow } from './types';

function injectedMarkers(): string[] {
  return Array.from(document.querySelectorAll('script[data-ezoic-sdk]')).map(
    (s) => s.getAttribute('data-ezoic-sdk') ?? '',
  );
}

function markerCount(marker: string): number {
  return document.querySelectorAll(`script[data-ezoic-sdk="${marker}"]`).length;
}

function srcCount(src: string): number {
  return Array.from(document.getElementsByTagName('script')).filter((s) => s.src === src).length;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as unknown as EzoicWindow).ezstandalone;
});

describe('ensureEzoicScripts', () => {
  it('injects CMP, CMP2, cmd-stub, and sa.min.js in that exact order', () => {
    ensureEzoicScripts();
    expect(injectedMarkers()).toEqual(['cmp1', 'cmp2', 'cmd-stub', 'sa']);
  });

  it('sets data-cfasync="false" before src on both CMP scripts', () => {
    ensureEzoicScripts();
    for (const marker of ['cmp1', 'cmp2']) {
      const el = document.querySelector(`script[data-ezoic-sdk="${marker}"]`);
      expect(el).not.toBeNull();
      const names = Array.from(el!.attributes).map((a) => a.name);
      expect(names).toContain('data-cfasync');
      expect(el!.getAttribute('data-cfasync')).toBe('false');
      expect(names.indexOf('data-cfasync')).toBeLessThan(names.indexOf('src'));
    }
  });

  it('loads sa.min.js async and without data-cfasync', () => {
    ensureEzoicScripts();
    const sa = document.querySelector('script[data-ezoic-sdk="sa"]');
    expect(sa).not.toBeNull();
    expect(sa!.hasAttribute('async')).toBe(true);
    expect(sa!.hasAttribute('data-cfasync')).toBe(false);
    expect(sa!.getAttribute('src')).toBe(SA_SCRIPT_URL);
  });

  it('creates the cmd queue so commands can be pushed after injection', () => {
    ensureEzoicScripts();
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezstandalone?.cmd)).toBe(true);
    let ran = false;
    pushToEzoicCmd(() => {
      ran = true;
    });
    // Before sa.min.js loads the queue is a plain array; the command is stored.
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
    expect(ran).toBe(false);
  });

  it('is idempotent — a second call injects no duplicate scripts', () => {
    ensureEzoicScripts();
    ensureEzoicScripts();
    expect(markerCount('cmp1')).toBe(1);
    expect(markerCount('cmp2')).toBe(1);
    expect(markerCount('cmd-stub')).toBe(1);
    expect(markerCount('sa')).toBe(1);
  });

  it('tolerates a pre-existing host sa.min.js and does not add a second', () => {
    const host = document.createElement('script');
    host.src = SA_SCRIPT_URL;
    document.head.appendChild(host);
    ensureEzoicScripts();
    expect(srcCount(SA_SCRIPT_URL)).toBe(1);
    expect(markerCount('sa')).toBe(0);
  });

  it('tolerates a pre-existing host CMP script', () => {
    const host = document.createElement('script');
    host.src = CMP_SCRIPT_URL_1;
    document.head.appendChild(host);
    ensureEzoicScripts();
    expect(srcCount(CMP_SCRIPT_URL_1)).toBe(1);
    expect(markerCount('cmp1')).toBe(0);
    // The rest of the chain still injects.
    expect(markerCount('cmp2')).toBe(1);
    expect(markerCount('sa')).toBe(1);
  });

  it('tolerates a pre-existing cmd-queue stub without adding another', () => {
    (window as unknown as EzoicWindow).ezstandalone = { cmd: [] };
    ensureEzoicScripts();
    expect(markerCount('cmd-stub')).toBe(0);
  });

  it('injects an optional analytics script last', () => {
    const analytics = 'https://example.com/analytics.js';
    ensureEzoicScripts({ analyticsUrl: analytics });
    expect(injectedMarkers()).toEqual(['cmp1', 'cmp2', 'cmd-stub', 'sa', 'analytics']);
    expect(document.querySelector('script[data-ezoic-sdk="analytics"]')!.getAttribute('src')).toBe(
      analytics,
    );
  });

  it('honors overridden sa and CMP URLs', () => {
    ensureEzoicScripts({
      saScriptUrl: 'https://cdn.example.com/sa.js',
      cmpScriptUrls: ['https://cdn.example.com/cmp1.js', 'https://cdn.example.com/cmp2.js'],
    });
    expect(document.querySelector('script[data-ezoic-sdk="sa"]')!.getAttribute('src')).toBe(
      'https://cdn.example.com/sa.js',
    );
    expect(document.querySelector('script[data-ezoic-sdk="cmp1"]')!.getAttribute('src')).toBe(
      'https://cdn.example.com/cmp1.js',
    );
  });
});

describe('pushToEzoicCmd', () => {
  it('creates the stub queue on demand when called before injection', () => {
    delete (window as unknown as EzoicWindow).ezstandalone;
    pushToEzoicCmd(() => undefined);
    const w = window as unknown as EzoicWindow;
    expect(Array.isArray(w.ezstandalone?.cmd)).toBe(true);
    expect((w.ezstandalone!.cmd as unknown as unknown[]).length).toBe(1);
  });
});
