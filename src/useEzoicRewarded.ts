import { useEffect, useMemo, useRef, useState } from 'react';
import {
  REWARDED_EVENTS,
  ensureRewardedScript,
  initRewardedAds,
  isRewardedLoaderPresent,
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

/** Options for {@link useEzoicRewarded}. Every field is optional. */
export interface UseEzoicRewardedOptions {
  /**
   * **Escape hatch — usually omit this.** Full URL of the site-specific rewarded
   * loader script (`{yourDomainHandlerHost}/porpoiseant/ezadloadrewarded.js`).
   *
   * Only supply this for pages that are **not** Ezoic JS-integrated (i.e. that do
   * not load `sa.min.js`/`ezstandalone`). When provided, the hook injects that
   * loader once (idempotently) as a `<script>` tag. On a normal Ezoic
   * JS-integrated page leave it unset: the default (runtime-served) mode lets the
   * Ezoic runtime serve the host-correct rewarded loader for you (see
   * {@link useEzoicRewarded}), so a per-site URL is neither needed nor correct.
   */
  loaderUrl?: string;

  /**
   * Site-wide rewarded placement toggles forwarded to
   * `ezstandalone.initRewardedAds` in the default (runtime-served) mode. Omitted
   * keys fall back to the runtime default (all enabled). **Ignored** when an
   * explicit {@link UseEzoicRewardedOptions.loaderUrl} is supplied.
   */
  placements?: EzoicRewardedPlacements;
}

/**
 * Module-level guard so the default runtime-served rewarded loader is triggered
 * at most once per page, regardless of how many {@link useEzoicRewarded}
 * instances mount or how often they re-render. The first default-mode mount
 * wins; its `placements` are the ones forwarded to `initRewardedAds`.
 */
let rewardedRuntimeInitTriggered = false;

/**
 * Resets the module-level runtime-served init guard.
 *
 * @internal Test-only. Not exported from the package entry point; exists so unit
 * tests can isolate the once-per-page init between cases.
 */
export function resetRewardedRuntimeInitForTests(): void {
  rewardedRuntimeInitTriggered = false;
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
 * **Default (runtime-served) mode — no URL needed on Ezoic-integrated pages.**
 * Because this SDK bootstraps the Ezoic header scripts (`sa.min.js` /
 * `ezstandalone`), the default mode does **not** inject any script. Instead, on
 * mount (client only) it pushes `ezstandalone.initRewardedAds(placements)` once
 * globally, and the Ezoic runtime serves the host-correct rewarded loader (with
 * your domain config) inside its own response and drains
 * `window.ezRewardedAds.cmd`. The push is guarded so multiple hook mounts /
 * re-renders never re-trigger it (the first caller's `placements` win).
 *
 * **Escape hatch — `loaderUrl`.** Only for pages that are **not** Ezoic
 * JS-integrated: passing `loaderUrl` keeps the legacy behavior of injecting the
 * site-specific `{host}/porpoiseant/ezadloadrewarded.js` loader as a `<script>`
 * tag instead of relying on the runtime. `placements` is ignored in this mode.
 * The default mode also detects an already-present loader (an SDK-injected one
 * or a host-HTML `/porpoiseant/ezadloadrewarded.js` include) and skips its init
 * so a second loader is never served.
 *
 * **Mixed modes on one page.** If one component passes `loaderUrl` while another
 * uses the default mode, each is an idempotent one-way trigger that fires at
 * most once, and mount order decides which runs first. If the `loaderUrl`
 * component mounts first, its injected `<script>` is in the DOM and the default
 * mode detects it and skips its init. The reverse order is not fully
 * de-duplicated: the default mode asks the runtime to serve a loader
 * asynchronously (no DOM `<script>` yet), so a `loaderUrl` component mounting
 * right after can still inject its own. Prefer a single mode per page.
 *
 * SSR-safe: on the server (and the first client render) it returns the initial
 * state and touches no `window`. The hook subscribes to the
 * `ezRewardedInitiated` / `ezRewardedDisplayed` / `ezRewardedClosed` window
 * events and reflects them in state, removing the listeners on unmount.
 *
 * @example
 * ```tsx
 * function WatchAdButton() {
 *   // No loaderUrl on an Ezoic JS-integrated page — the runtime serves it.
 *   const { requestWithOverlay, displayed } = useEzoicRewarded();
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
  const { loaderUrl, placements } = options;
  const [state, setState] = useState<EzoicRewardedState>(INITIAL_STATE);

  // Keep the latest placements in a ref so the init effect can read them without
  // depending on an unstable inline object (which would churn the effect).
  const placementsRef = useRef(placements);
  placementsRef.current = placements;

  // Two mutually exclusive modes (idempotent, SSR-safe):
  // - loaderUrl provided (escape hatch): inject the site-specific loader script.
  // - loaderUrl omitted (default): trigger initRewardedAds ONCE globally so the
  //   Ezoic runtime serves the host-correct rewarded loader itself. `placements`
  //   is read from the ref, and the module-level guard makes the first
  //   default-mode mount the only one that fires.
  useEffect(() => {
    if (loaderUrl) {
      ensureRewardedScript(loaderUrl);
      return;
    }
    if (typeof window === 'undefined') return;
    if (rewardedRuntimeInitTriggered) return;
    rewardedRuntimeInitTriggered = true;
    // If a real rewarded loader <script> is already on the page (e.g. the host
    // HTML hand-includes /porpoiseant/ezadloadrewarded.js), don't trigger the
    // runtime to serve a SECOND loader. Detects loader script elements only —
    // never the SDK's own cmd-queue stub (which this hook itself seeds).
    if (isRewardedLoaderPresent()) return;
    initRewardedAds(placementsRef.current);
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
