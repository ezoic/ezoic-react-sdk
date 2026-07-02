import { pushToEzoicCmd } from './scripts';
import type { EzoicConfig, EzoicWindow } from './types';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

// ---------------------------------------------------------------------------
// Consent, privacy, config, and format-toggle passthroughs.
//
// Each write is queued on `window.ezstandalone.cmd` so it runs after the bundle
// initializes, and each is a no-op on the server. Optional chaining guards the
// case where the bundle failed to load, so a missing method degrades to a no-op
// instead of throwing on the page — the same contract as the ad passthroughs.
//
// Getters (`is*` / `hasAnchorAdBeenClosed`) cannot be queued, so they read the
// bundle synchronously and return `undefined` until it has loaded. The public
// `config` wrapper in `sa.min.js` does not return the stored config, so `config`
// is exposed write-only (no getter would ever see a value).
// ---------------------------------------------------------------------------

// -- Consent & privacy -------------------------------------------------------

/**
 * Enables Ezoic-managed consent (`ezstandalone.enableConsent`). Signals the
 * server that Ezoic manages the CMP for this visitor.
 */
export function enableConsent(): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.enableConsent?.();
  });
}

/** Disables (or re-enables) personalized statistics for this visitor. */
export function setDisablePersonalizedStatistics(disable: boolean): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.setDisablePersonalizedStatistics?.(disable);
  });
}

/** Disables (or re-enables) personalized ads for this visitor. */
export function setDisablePersonalizedAds(disable: boolean): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.setDisablePersonalizedAds?.(disable);
  });
}

// -- Configuration -----------------------------------------------------------

/**
 * The configuration keys `ezstandalone.config` accepts. `satisfies` guarantees
 * every entry is a real {@link EzoicConfig} key; a unit test asserts the set is
 * also complete (no key of the type is missing here).
 */
export const CONFIG_KEYS = [
  'anchorAdPosition',
  'anchorAdExpansion',
  'disableVideo',
  'disableInterstitial',
  'disableLeftSideRail',
  'disableRightSideRail',
  'disableSidebarFloating',
  'reservePlaceholderSpace',
  'limitCookies',
  'vignetteDesktop',
  'vignetteMobile',
  'vignetteTablet',
] as const satisfies readonly (keyof EzoicConfig)[];

const CONFIG_KEY_SET = new Set<string>(CONFIG_KEYS);

/**
 * Returns a copy of `options` keeping only keys the bundle accepts. Unknown keys
 * are dropped with a single console warning, so a typo surfaces here with a
 * clear message instead of the bundle's terser rejection.
 */
function validateConfig(options: EzoicConfig): EzoicConfig {
  const source = options as Record<string, unknown>;
  const validated: Record<string, unknown> = {};
  const unknownKeys: string[] = [];
  for (const key of Object.keys(source)) {
    if (CONFIG_KEY_SET.has(key)) {
      validated[key] = source[key];
    } else {
      unknownKeys.push(key);
    }
  }
  if (unknownKeys.length > 0) {
    console.warn(
      `[ezoic/react-sdk] config(): ignoring unknown key(s) ${unknownKeys.join(', ')}. ` +
        `Accepted keys: ${CONFIG_KEYS.join(', ')}.`,
    );
  }
  return validated as EzoicConfig;
}

/**
 * Applies publisher configuration via `ezstandalone.config`. Only the documented
 * {@link EzoicConfig} keys are forwarded (unknown keys are dropped with a
 * warning). Write-only — the bundle's public `config` wrapper does not return
 * the stored config. Call before the first `showAds` so the config affects that
 * request.
 */
export function config(options: EzoicConfig): void {
  const validated = validateConfig(options);
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.config?.(validated);
  });
}

// -- Anchor / interstitial / outstream toggles -------------------------------

/** Enables or disables the Ezoic anchor ad. */
export function setEzoicAnchorAd(enabled: boolean): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.setEzoicAnchorAd?.(enabled);
  });
}

/**
 * Whether the visitor previously closed the anchor ad. Reads the
 * `ez_anchor_closed` cookie synchronously. Returns `undefined` until `sa.min.js`
 * has loaded (the method does not exist before then).
 */
export function hasAnchorAdBeenClosed(): boolean | undefined {
  const ez = getWindow()?.ezstandalone;
  return typeof ez?.hasAnchorAdBeenClosed === 'function' ? ez.hasAnchorAdBeenClosed() : undefined;
}

/** Allows or disallows the interstitial format. */
export function setInterstitialAllowed(allowed: boolean, options?: Record<string, unknown>): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.setInterstitialAllowed?.(allowed, options);
  });
}

/**
 * Whether the interstitial format is currently allowed. Returns `undefined`
 * until `sa.min.js` has loaded.
 */
export function isInterstitialAllowed(): boolean | undefined {
  const ez = getWindow()?.ezstandalone;
  return typeof ez?.isInterstitialAllowed === 'function' ? ez.isInterstitialAllowed() : undefined;
}

/**
 * Allows or disallows floating outstream. The bundle's `setOutstreamAllowed`
 * resolves to the resulting allowed state, so this returns that promise when the
 * bundle has loaded. Before load, the call is queued (the side effect still
 * applies once the bundle initializes) and the returned promise resolves to
 * `undefined` — it never hangs waiting on a bundle that never loads.
 */
export function setOutstreamAllowed(
  allowed: boolean,
  options?: Record<string, unknown>,
): Promise<boolean | undefined> {
  const ez = getWindow()?.ezstandalone;
  if (typeof ez?.setOutstreamAllowed === 'function') {
    return Promise.resolve(ez.setOutstreamAllowed(allowed, options));
  }
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.setOutstreamAllowed?.(allowed, options);
  });
  return Promise.resolve(undefined);
}

/**
 * Whether floating outstream is currently allowed. Returns `undefined` until
 * `sa.min.js` has loaded.
 */
export function isOutstreamAllowed(): boolean | undefined {
  const ez = getWindow()?.ezstandalone;
  return typeof ez?.isOutstreamAllowed === 'function' ? ez.isOutstreamAllowed() : undefined;
}
