import { useEffect, useMemo, useRef, useState } from 'react';
import { hasMountedPlacements } from './adManager';
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
 * Module-level guard so the default runtime-served rewarded init is scheduled at
 * most once per page, regardless of how many {@link useEzoicRewarded} instances
 * mount or how often they re-render. The first default-mode mount wins; its
 * `placements` are the ones forwarded to `initRewardedAds`.
 */
let rewardedRuntimeInitTriggered = false;

/** Interval, in milliseconds, between polls of {@link hasInitialAdLoadStarted}. */
const REWARDED_INIT_POLL_INTERVAL_MS = 250;

/**
 * Grace window, in milliseconds, from scheduling before the deferred init fires
 * on a page that has mounted NO display placements (a rewarded-only page).
 */
const REWARDED_INIT_GRACE_MS = 4000;

/** Guards the single init dispatch (once per page). */
let rewardedRuntimeInitDispatched = false;

/** Enabled-poll interval handle; cleared once init is dispatched. */
let rewardedInitPollTimer: ReturnType<typeof setInterval> | undefined;

/** Grace-window timeout handle; cleared once init is dispatched. */
let rewardedInitGraceTimer: ReturnType<typeof setTimeout> | undefined;

/** Cancels any pending {@link scheduleRewardedRuntimeInit} timers. */
function clearRewardedInitTimers(): void {
  if (rewardedInitPollTimer !== undefined) {
    clearInterval(rewardedInitPollTimer);
    rewardedInitPollTimer = undefined;
  }
  if (rewardedInitGraceTimer !== undefined) {
    clearTimeout(rewardedInitGraceTimer);
    rewardedInitGraceTimer = undefined;
  }
}

/**
 * Resets the module-level runtime-served init guards and cancels any pending
 * scheduler timers.
 *
 * @internal Test-only. Not exported from the package entry point; exists so unit
 * tests can isolate the once-per-page init between cases.
 */
export function resetRewardedRuntimeInitForTests(): void {
  rewardedRuntimeInitTriggered = false;
  rewardedRuntimeInitDispatched = false;
  clearRewardedInitTimers();
}

/**
 * Regex matching the sol standalone initial ad request path. That request is
 * issued to `//g.ezoic.net/sa.go` (via XHR) and is visible as a resource-timing
 * entry; this matches `/sa.go` immediately followed by a query string or the end
 * of the entry name.
 */
const SA_GO_REQUEST_RE = /\/sa\.go(?:\?|$)/;

/**
 * Whether the page's initial ad load has started — the safe point to dispatch the
 * runtime's `initRewardedAds`, whose internal `showAds([12])` then routes through
 * `displayMore` instead of colliding with a mid-initialization state machine.
 *
 * `window.ezstandalone.enabled` alone is NOT a reliable signal: the public
 * `ezstandalone` wrapper object initializes `enabled: false` and only flips it
 * when a publisher calls the public `enable()`, while the internal standalone
 * instance the display logic uses tracks its own flag that is never mirrored back
 * to the wrapper in the normal `showAds` flow. So a fully successful initial load
 * commonly leaves the public `enabled` at `false`. This predicate is therefore
 * true when ANY of these hold:
 *
 * 1. `window.ezstandalone.enabled === true` — correct when a publisher opts into
 *    the public `enable()` flow.
 * 2. A resource-timing entry matches {@link SA_GO_REQUEST_RE} — the direct signal
 *    that the initial `/sa.go` ad request was issued.
 * 3. A GPT container is rendered INSIDE an Ezoic placeholder (the
 *    `[id^="ezoic-pub-ad-placeholder-"] [id^="div-gpt-ad"]` selector) — this
 *    appears only once the Ezoic ad response is rendering. It is scoped to the
 *    placeholder on purpose: a bare `div-gpt-ad*` match would also fire on plain
 *    publisher-hardcoded GPT slots present in the HTML before the load,
 *    re-introducing the mount-time collision on mixed Ezoic + plain-GPT pages.
 *
 * SSR-safe: returns `false` when `window`, `performance`, or `document` is
 * unavailable.
 */
function hasInitialAdLoadStarted(): boolean {
  if (typeof window === 'undefined') return false;
  if ((window as unknown as EzoicWindow).ezstandalone?.enabled === true) return true;
  if (typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function') {
    for (const entry of performance.getEntriesByType('resource')) {
      if (SA_GO_REQUEST_RE.test(entry.name)) return true;
    }
  }
  if (
    typeof document !== 'undefined' &&
    document.querySelector('[id^="ezoic-pub-ad-placeholder-"] [id^="div-gpt-ad"]') !== null
  ) {
    return true;
  }
  return false;
}

/**
 * Defers the default (runtime-served) `initRewardedAds` call so it never preempts
 * the page's initial ad load, then dispatches it exactly once.
 *
 * The Ezoic runtime's `initRewardedAds` internally runs `showAds([12])`. Issuing
 * that before the page's first real `showAds` has established the initial load
 * collides with the runtime's mid-initialization state machine and wedges the
 * whole page. This scheduler dispatches `dispatchInit` when the first of these
 * holds:
 *
 * 1. {@link hasInitialAdLoadStarted} reports the initial load has started, so the
 *    internal `showAds([12])` routes safely through `displayMore`. Polled every
 *    {@link REWARDED_INIT_POLL_INTERVAL_MS} ms.
 * 2. The {@link REWARDED_INIT_GRACE_MS} grace window elapses with NO display
 *    placement mounted ({@link hasMountedPlacements} is `false`) — a
 *    rewarded-only page where `initRewardedAds` is itself the ad bootstrap.
 *
 * When the grace window elapses while placements ARE mounted but the initial load
 * has not started, init is NOT fired at the deadline (that could preempt the
 * pending load); the poll simply continues until the load starts or the page
 * unloads — never giving up avoids a silent failure. The single dispatch is
 * page-global and runs to completion; it is not cancelled when the triggering
 * component unmounts, because other rewarded consumers may remain. SSR-safe: a
 * no-op with no `window`.
 *
 * @param dispatchInit dispatches the actual `initRewardedAds` call with the first
 *   default-mode caller's placements. Invoked at most once.
 */
function scheduleRewardedRuntimeInit(dispatchInit: () => void): void {
  if (typeof window === 'undefined') return;

  const fire = (): void => {
    if (rewardedRuntimeInitDispatched) return;
    rewardedRuntimeInitDispatched = true;
    clearRewardedInitTimers();
    dispatchInit();
  };

  // Fast path: the initial load has already started.
  if (hasInitialAdLoadStarted()) {
    fire();
    return;
  }

  rewardedInitPollTimer = setInterval(() => {
    if (hasInitialAdLoadStarted()) fire();
  }, REWARDED_INIT_POLL_INTERVAL_MS);

  rewardedInitGraceTimer = setTimeout(() => {
    rewardedInitGraceTimer = undefined;
    if (rewardedRuntimeInitDispatched) return;
    // Rewarded-only page: init is the ad bootstrap, so fire it. Otherwise the
    // ad-load poll above owns the eventual dispatch.
    if (!hasMountedPlacements()) fire();
  }, REWARDED_INIT_GRACE_MS);
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
 * mount (client only) it schedules `ezstandalone.initRewardedAds(placements)`
 * once globally, and the Ezoic runtime serves the host-correct rewarded loader
 * (with your domain config) inside its own response and drains
 * `window.ezRewardedAds.cmd`. The trigger is guarded so multiple hook mounts /
 * re-renders never re-schedule it (the first caller's `placements` win).
 *
 * The init call is **deferred**, never fired synchronously on mount. The
 * runtime's `initRewardedAds` internally runs `showAds([12])`; issuing that
 * before the page's first real `showAds` has established the initial ad load
 * collides with the runtime's mid-initialization state machine and wedges the
 * whole page (no `sa.go` request, no ads, rewarded never loads). The hook instead
 * polls (~250 ms) for the initial ad load to start — detected via the `/sa.go`
 * ad request in resource timing, a GPT container rendered inside an Ezoic
 * placeholder, or `ezstandalone.enabled` when a publisher opts into `enable()` — and
 * dispatches once it has (so the internal `showAds([12])` routes safely through
 * `displayMore`). If a ~4 s grace window elapses first with NO `<EzoicAd>` display
 * placement mounted, the page is rewarded-only — `initRewardedAds` is itself its
 * ad bootstrap — so it fires at the deadline. With placements mounted but the load
 * not yet started, the deadline does not fire (to avoid preempting the pending
 * load); the poll continues until the load starts or the page unloads.
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
    // Defer initRewardedAds via the page-global scheduler so it never preempts
    // the page's initial ad load (see the hook doc). Snapshot placements now —
    // the first default-mode mount wins.
    const placements = placementsRef.current;
    scheduleRewardedRuntimeInit(() => initRewardedAds(placements));
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
