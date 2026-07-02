import { pushToEzoicCmd } from './scripts';
import type {
  EzRewardedAdsApi,
  EzoicContentLockerConfig,
  EzoicRewardedOverlayConfig,
  EzoicRewardedOverlayText,
  EzoicRewardedPlacements,
  EzoicRewardedRequestAndShowConfig,
  EzoicRewardedRequestConfig,
  EzoicRewardedRequestOutcome,
  EzoicRewardedShowConfig,
  EzoicRewardedShowOutcome,
  EzoicWindow,
} from './types';

// ---------------------------------------------------------------------------
// Rewarded ads (`window.ezRewardedAds`).
//
// Rewarded ads are served by a SEPARATE bundle from a site-specific
// domain-handler host, with its own `cmd` queue independent of
// `ezstandalone.cmd`. Every native method is callback-based, so the SDK wraps
// them as promises that resolve when the native callback fires. The native code
// always invokes the callback in normal operation (including no-fill, cancel,
// and precondition failures), so these promises settle rather than hang — as
// long as the rewarded loader is on the page. Inject it with
// {@link ensureRewardedScript} (or pass `loaderUrl` to `useEzoicRewarded`).
// ---------------------------------------------------------------------------

/** Window DOM events fired by the rewarded loader (not by `sa.min.js`). */
export const REWARDED_EVENTS = {
  /** Reward flow started. */
  INITIATED: 'ezRewardedInitiated',
  /** Video preroll init. */
  PREROLL_INIT: 'rewardedPrerollInit',
  /** Ad became visible. */
  DISPLAYED: 'ezRewardedDisplayed',
  /** Ad closed. */
  CLOSED: 'ezRewardedClosed',
  /** Video preroll finished (after close). */
  PREROLL_FINISHED: 'rewardedPrerollFinished',
} as const;

/** Marks a `<script>` the SDK injected, so rewarded injection stays idempotent. */
const MARKER_ATTR = 'data-ezoic-sdk';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

/** Ensures `window.ezRewardedAds.cmd` exists as a queue. Idempotent. */
function ensureRewardedQueue(w: EzoicWindow): void {
  if (!w.ezRewardedAds) {
    w.ezRewardedAds = { cmd: [] };
  } else if (!w.ezRewardedAds.cmd) {
    w.ezRewardedAds.cmd = [];
  }
}

/**
 * Queues a command on `window.ezRewardedAds.cmd`, creating the stub queue first
 * if needed. The queue runs commands once the rewarded loader initializes, so
 * callers can push before the loader has finished loading. No-op on the server.
 */
export function pushToRewardedCmd(command: () => void): void {
  const w = getWindow();
  if (!w) return;
  ensureRewardedQueue(w);
  w.ezRewardedAds!.cmd.push(command);
}

/** Extracts the pathname from an absolute URL, or `null` if it cannot be parsed. */
function urlPathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/**
 * True when a rewarded loader is already on the page — either one the SDK marked,
 * or any script whose URL path matches the loader path. Matching by path (not the
 * full URL) means a host-injected loader carrying cache-buster query params — or
 * one on the same host with a different query string — is still recognized, so
 * the SDK never adds a second rewarded loader.
 */
function rewardedLoaderPresent(loaderUrl: string): boolean {
  if (document.querySelector(`script[${MARKER_ATTR}="rewarded-loader"]`)) return true;
  const wantedPath = urlPathname(loaderUrl);
  for (const script of Array.from(document.getElementsByTagName('script'))) {
    if (!script.src) continue;
    if (script.src === loaderUrl) return true;
    if (wantedPath && urlPathname(script.src) === wantedPath) return true;
  }
  return false;
}

/**
 * Injects the rewarded-ads loader script and its `cmd`-queue stub, exactly once,
 * in the required order (stub before the async loader). The loader is served
 * from a **site-specific** host — find yours in your Ezoic integration (it is
 * `{yourDomainHandlerHost}/porpoiseant/ezadloadrewarded.js`) and pass the full
 * URL here.
 *
 * Idempotent: skips injection when the SDK already added the loader or the same
 * `src` exists in the host HTML. No-op on the server (guards on `document`).
 * Scripts are appended to `<head>` (falling back to `documentElement`).
 *
 * @param loaderUrl Full URL of the rewarded loader script.
 */
export function ensureRewardedScript(loaderUrl: string): void {
  const w = getWindow();
  if (!w || typeof document === 'undefined') return;
  if (!loaderUrl) return;

  const target = document.head ?? document.documentElement;

  // Decide whether a stub already exists BEFORE creating the queue object,
  // otherwise the queue we create would make the check always true and the stub
  // node would never be injected.
  const hadStub = Boolean(
    document.querySelector(`script[${MARKER_ATTR}="rewarded-stub"]`) ||
    (w.ezRewardedAds && w.ezRewardedAds.cmd),
  );
  // Ensure the queue object exists synchronously (some DOMs do not execute an
  // injected inline stub), then add the stub node for real browsers.
  ensureRewardedQueue(w);
  if (!hadStub) {
    const stub = document.createElement('script');
    stub.setAttribute(MARKER_ATTR, 'rewarded-stub');
    stub.textContent =
      'window.ezRewardedAds = window.ezRewardedAds || {}; ' +
      'window.ezRewardedAds.cmd = window.ezRewardedAds.cmd || [];';
    target.appendChild(stub);
  }

  if (!rewardedLoaderPresent(loaderUrl)) {
    const loader = document.createElement('script');
    loader.setAttribute('src', loaderUrl);
    loader.setAttribute('async', '');
    loader.setAttribute(MARKER_ATTR, 'rewarded-loader');
    target.appendChild(loader);
  }
}

/**
 * Runs `invoke` on the rewarded API once it is reachable through the `cmd`
 * queue, resolving/rejecting the returned promise from within. Rejects
 * immediately on the server, and rejects (rather than hangs) if the loader
 * loaded but the specific method is missing.
 */
function callRewarded<T>(
  methodName: string,
  invoke: (api: EzRewardedAdsApi, resolve: (value: T) => void) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!getWindow()) {
      reject(new Error('[ezoic/react-sdk] Rewarded ads are only available in the browser.'));
      return;
    }
    pushToRewardedCmd(() => {
      const api = getWindow()?.ezRewardedAds;
      if (!api || typeof api[methodName as keyof EzRewardedAdsApi] !== 'function') {
        reject(new Error(`[ezoic/react-sdk] window.ezRewardedAds.${methodName} is not available.`));
        return;
      }
      try {
        invoke(api, resolve);
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  });
}

/**
 * Records that a rewarded-ad implementation is present on this page (a tracking
 * row only — it does not request or show an ad). Idempotent per pageview.
 */
export function registerRewarded(): void {
  pushToRewardedCmd(() => {
    getWindow()?.ezRewardedAds?.register?.();
  });
}

/**
 * Pre-fetches a rewarded ad without showing it, for a snappier
 * {@link showRewarded} later. Resolves with `{ status, msg, adInfo? }`.
 */
export function requestRewarded(
  config?: EzoicRewardedRequestConfig,
): Promise<EzoicRewardedRequestOutcome> {
  return callRewarded<EzoicRewardedRequestOutcome>('request', (api, resolve) => {
    api.request!((data) => resolve(data), config);
  });
}

/**
 * Shows an ad that a prior {@link requestRewarded} pre-fetched. Resolves with
 * `{ status, reward, msg, adInfo?, userInfo? }`. If no ad was requested first,
 * the native code resolves `{ status: false, reward: false, msg: '…call
 * request() first' }` (it never hangs). Most callers should use
 * {@link requestAndShowRewarded} or {@link requestRewardedWithOverlay} instead.
 */
export function showRewarded(config?: EzoicRewardedShowConfig): Promise<EzoicRewardedShowOutcome> {
  return callRewarded<EzoicRewardedShowOutcome>('show', (api, resolve) => {
    api.show!((data) => resolve(data), config);
  });
}

/**
 * Requests and immediately shows a rewarded ad with no call-to-action modal.
 * Resolves with `{ status, reward, msg, adInfo?, userInfo? }`.
 */
export function requestAndShowRewarded(
  config?: EzoicRewardedRequestAndShowConfig,
): Promise<EzoicRewardedShowOutcome> {
  return callRewarded<EzoicRewardedShowOutcome>('requestAndShow', (api, resolve) => {
    api.requestAndShow!((data) => resolve(data), config);
  });
}

/**
 * Requests and shows a rewarded ad behind a customizable call-to-action overlay
 * (the recommended flow — it explains the reward before the ad). Resolves with
 * `{ status, reward, msg, adInfo?, userInfo? }`, including the `user cancelled`
 * outcome when the visitor declines.
 */
export function requestRewardedWithOverlay(
  text?: EzoicRewardedOverlayText,
  config?: EzoicRewardedOverlayConfig,
): Promise<EzoicRewardedShowOutcome> {
  return callRewarded<EzoicRewardedShowOutcome>('requestWithOverlay', (api, resolve) => {
    api.requestWithOverlay!((data) => resolve(data), text, config);
  });
}

/**
 * Gates an action behind watching a rewarded ad (a content paywall). `action` is
 * either a URL string (redirected to after the reward) or a function (run after
 * the reward). Fire-and-forget: the native flow drives the call-to-action modal
 * and runs `action` on success; use `config.readyCallback` to observe the ad
 * becoming ready.
 */
export function rewardedContentLocker(
  action: string | (() => void),
  config?: EzoicContentLockerConfig,
): void {
  pushToRewardedCmd(() => {
    getWindow()?.ezRewardedAds?.contentLocker?.(action, config);
  });
}

/**
 * Configures the site-wide rewarded formats and triggers the rewarded slot via
 * `ezstandalone.initRewardedAds` (queued on `ezstandalone.cmd`, not the rewarded
 * queue). Every format (anchor, interstitial, video, side rails) defaults to
 * enabled: omitting a key — or the whole argument — leaves that format on. Only
 * an explicit `false` disables a format (the native code reads each key as
 * `placements.x !== undefined ? placements.x : true`).
 */
export function initRewardedAds(placements?: EzoicRewardedPlacements): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.initRewardedAds?.(placements);
  });
}
