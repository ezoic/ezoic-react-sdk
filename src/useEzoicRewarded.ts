import { useEffect, useMemo, useState } from 'react';
import {
  REWARDED_EVENTS,
  ensureRewardedScript,
  initRewardedAds,
  pushToRewardedCmd,
  registerRewarded,
  requestAndShowRewarded,
  requestRewarded,
  requestRewardedWithOverlay,
  rewardedContentLocker,
  showRewarded,
} from './rewarded';
import type {
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

/** Reactive lifecycle state of the current rewarded-ad flow. */
export interface EzoicRewardedState {
  /** `true` once `window.ezRewardedAds.ready` is set by the loader. */
  ready: boolean;
  /** `true` after `ezRewardedInitiated` fires; reset when a new flow starts. */
  initiated: boolean;
  /** `true` after `ezRewardedDisplayed` fires for the current flow. */
  displayed: boolean;
  /** `true` after `ezRewardedClosed` fires for the current flow. */
  closed: boolean;
  /** The most recent rewarded window event name, or `undefined` before any. */
  lastEvent?: string;
}

/** Value returned by {@link useEzoicRewarded}: lifecycle state plus methods. */
export interface EzoicRewardedApi extends EzoicRewardedState {
  /** Records a rewarded implementation is present (tracking only). */
  register: () => void;
  /** Pre-fetches an ad without showing it. */
  request: (config?: EzoicRewardedRequestConfig) => Promise<EzoicRewardedRequestOutcome>;
  /** Shows an ad pre-fetched by {@link EzoicRewardedApi.request}. */
  show: (config?: EzoicRewardedShowConfig) => Promise<EzoicRewardedShowOutcome>;
  /** Requests and immediately shows an ad (no call-to-action modal). */
  requestAndShow: (config?: EzoicRewardedRequestAndShowConfig) => Promise<EzoicRewardedShowOutcome>;
  /** Requests and shows an ad behind a call-to-action overlay (recommended). */
  requestWithOverlay: (
    text?: EzoicRewardedOverlayText,
    config?: EzoicRewardedOverlayConfig,
  ) => Promise<EzoicRewardedShowOutcome>;
  /** Gates an action (URL or function) behind watching a rewarded ad. */
  contentLocker: (action: string | (() => void), config?: EzoicContentLockerConfig) => void;
  /** Configures site-wide rewarded formats and triggers the rewarded slot. */
  initRewardedAds: (placements?: EzoicRewardedPlacements) => void;
}

/** Options for {@link useEzoicRewarded}. */
export interface UseEzoicRewardedOptions {
  /**
   * Full URL of the site-specific rewarded loader script
   * (`{yourDomainHandlerHost}/porpoiseant/ezadloadrewarded.js`). When provided,
   * the hook injects it once (idempotently). Omit if the loader is already on
   * the page by other means.
   */
  loaderUrl?: string;
}

const INITIAL_STATE: EzoicRewardedState = {
  ready: false,
  initiated: false,
  displayed: false,
  closed: false,
};

/**
 * Drives Ezoic rewarded ads. Returns the current {@link EzoicRewardedState} plus
 * promise-based methods wrapping `window.ezRewardedAds` — `request`, `show`,
 * `requestAndShow`, `requestWithOverlay`, `contentLocker` — and `register` /
 * `initRewardedAds`. The show-style methods resolve with
 * `{ status, reward, msg, adInfo?, userInfo? }`; `request` resolves with
 * `{ status, msg, adInfo? }`.
 *
 * SSR-safe: on the server (and the first client render) it returns the initial
 * state and touches no `window`. Pass `loaderUrl` to inject the site-specific
 * rewarded loader; the hook subscribes to the `ezRewardedInitiated` /
 * `ezRewardedDisplayed` / `ezRewardedClosed` window events and reflects them in
 * state, removing the listeners on unmount.
 *
 * @example
 * ```tsx
 * function WatchAdButton() {
 *   const { requestWithOverlay, displayed } = useEzoicRewarded({
 *     loaderUrl: 'https://go.example-host.com/porpoiseant/ezadloadrewarded.js',
 *   });
 *   const onClick = async () => {
 *     const { reward } = await requestWithOverlay(
 *       { header: 'Unlock this article', body: ['Watch a short ad to continue.'] },
 *       { rewardName: 'premium_article' },
 *     );
 *     if (reward) grantAccess();
 *   };
 *   return <button onClick={onClick}>{displayed ? 'Ad playing…' : 'Watch ad'}</button>;
 * }
 * ```
 */
export function useEzoicRewarded(options: UseEzoicRewardedOptions = {}): EzoicRewardedApi {
  const { loaderUrl } = options;
  const [state, setState] = useState<EzoicRewardedState>(INITIAL_STATE);

  // Inject the site-specific loader when a URL is provided (idempotent, SSR-safe).
  useEffect(() => {
    if (loaderUrl) {
      ensureRewardedScript(loaderUrl);
    }
  }, [loaderUrl]);

  // Track readiness and the rewarded lifecycle window events.
  useEffect(() => {
    const w = typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
    if (!w) return;

    let cancelled = false;

    const markReady = (): void => {
      if (cancelled) return;
      setState((prev) => (prev.ready ? prev : { ...prev, ready: true }));
    };

    // Deterministic readiness signal: the loader sets `ready` synchronously while
    // draining its `cmd` queue during init, so a queued command runs the instant
    // the loader is ready (or immediately if it already loaded). This handles an
    // arbitrarily slow loader with no polling.
    pushToRewardedCmd(markReady);

    const onInitiated = (): void => {
      if (cancelled) return;
      // A new flow: reset displayed/closed so callers can track this cycle.
      setState((prev) => ({
        ...prev,
        initiated: true,
        displayed: false,
        closed: false,
        lastEvent: REWARDED_EVENTS.INITIATED,
      }));
    };
    const onDisplayed = (): void => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, displayed: true, lastEvent: REWARDED_EVENTS.DISPLAYED }));
    };
    const onClosed = (): void => {
      if (cancelled) return;
      setState((prev) => ({ ...prev, closed: true, lastEvent: REWARDED_EVENTS.CLOSED }));
    };

    window.addEventListener(REWARDED_EVENTS.INITIATED, onInitiated);
    window.addEventListener(REWARDED_EVENTS.DISPLAYED, onDisplayed);
    window.addEventListener(REWARDED_EVENTS.CLOSED, onClosed);

    return () => {
      cancelled = true;
      window.removeEventListener(REWARDED_EVENTS.INITIATED, onInitiated);
      window.removeEventListener(REWARDED_EVENTS.DISPLAYED, onDisplayed);
      window.removeEventListener(REWARDED_EVENTS.CLOSED, onClosed);
    };
  }, []);

  return useMemo<EzoicRewardedApi>(
    () => ({
      ...state,
      register: registerRewarded,
      request: requestRewarded,
      show: showRewarded,
      requestAndShow: requestAndShowRewarded,
      requestWithOverlay: requestRewardedWithOverlay,
      contentLocker: rewardedContentLocker,
      initRewardedAds,
    }),
    [state],
  );
}
