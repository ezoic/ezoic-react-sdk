/**
 * Type contracts for the pieces of `window.ezstandalone` this SDK drives. Only
 * methods wired through the standalone bundle's public surface are declared, so
 * the SDK never claims a method Ezoic does not expose. The ad-serving methods
 * are optional because they only exist after `sa.min.js` initializes; the `cmd`
 * queue is always present (the pre-load stub, or this SDK, creates it).
 */

/**
 * The `ezstandalone.cmd` command queue. Before `sa.min.js` initializes it is a
 * plain array; afterwards `push` executes the command immediately. Both phases
 * expose the same `push(fn)` contract, which is all this SDK relies on.
 */
export interface EzoicCommandQueue {
  push(command: () => void): unknown;
}

/**
 * A single display placeholder passed to `showAds`. `id` is required; `required`
 * marks the slot as required demand and `sizes` constrains the requested sizes
 * (each `"WxH"`). Matches the verified `ezstandalone.showAds` object form.
 */
export interface EzoicShowAdsPlaceholder {
  /** Integer placeholder id (1–999). */
  id: number;
  /** When `true`, the slot is requested as required demand. Defaults to `false`. */
  required?: boolean;
  /** Requested creative sizes, each matching `"WxH"` (e.g. `"728x90"`). */
  sizes?: string[];
}

/**
 * An argument accepted by `showAds`: a bare integer id, an array of ids, or the
 * full {@link EzoicShowAdsPlaceholder} object form.
 */
export type EzoicShowAdsArg = number | number[] | EzoicShowAdsPlaceholder;

/**
 * A single entry passed to `ezstandalone.defineVideo`: either a bare publisher
 * div id, or the object form `{ divID }`. These are publisher-chosen div ids,
 * distinct from the numeric display placeholder ids used by `showAds`.
 */
export type EzoicVideoDefineEntry = string | { divID: string };

/**
 * A player entry pushed onto `window.openVideoPlayers` to embed an Open Video
 * (open.video) player. `videoID` is the primary content key; `playlist` is an
 * alternative. `target` is the container element (or a selector string) the
 * player renders into, and `float` opts the player into floating behavior.
 *
 * There is no `autoplay` or `loop` option — the platform does not accept them.
 */
export interface OpenVideoPlayerEntry {
  /** Container the player renders into — an Element or a CSS selector string. */
  target: Element | string;
  /** Primary content key. Required in practice; optional at the type level because {@link OpenVideoPlayerEntry.playlist} is an alternative. */
  videoID?: string;
  /** Alternative to `videoID`: a playlist identifier. */
  playlist?: string;
  /** Opt the player into floating behavior. */
  float?: boolean;
}

/**
 * The live handler `open.video/video.js` installs in place of the seeded
 * `window.openVideoPlayers` array once it loads: a `push`-compatible object that
 * drains queued entries. `visited` and `players` are internal bookkeeping the
 * handler maintains. The SDK only relies on `push`.
 */
export interface OpenVideoPlayersQueue {
  push(entry: OpenVideoPlayerEntry): void;
  visited?: boolean;
  players?: unknown[];
}

/**
 * Publisher configuration accepted by `ezstandalone.config`. Only these keys are
 * honored; the bundle logs an error and ignores anything else, so the SDK types
 * the exact verified set. Every field is optional — pass only what you set.
 *
 * The public `config` wrapper does not return the stored config, so this SDK
 * exposes `config()` as write-only (no getter). Apply configuration before the
 * first `showAds` for it to affect that request.
 */
export interface EzoicConfig {
  /** Anchor ad position (`saContext.ap`). Bundle default `"bottom"`. */
  anchorAdPosition?: string;
  /** Opt in to anchor ad expansion (`saContext.aae`). */
  anchorAdExpansion?: boolean;
  /** Disable Ezoic video (`saContext.dv`). */
  disableVideo?: boolean;
  /** Disable the interstitial format (`saContext.di`). */
  disableInterstitial?: boolean;
  /** Disable the left side rail (`saContext.dlr`). */
  disableLeftSideRail?: boolean;
  /** Disable the right side rail (`saContext.drr`). */
  disableRightSideRail?: boolean;
  /** Disable sidebar floating (`saContext.dsf`). */
  disableSidebarFloating?: boolean;
  /** Reserve placeholder space to reduce CLS (applied in `showAds`). */
  reservePlaceholderSpace?: boolean;
  /** Limit cookies (server-side effect). */
  limitCookies?: boolean;
  /** Enable the desktop vignette (`saContext.vd`). */
  vignetteDesktop?: boolean;
  /** Enable the mobile vignette (`saContext.vm`). */
  vignetteMobile?: boolean;
  /** Enable the tablet vignette (`saContext.vt`). */
  vignetteTablet?: boolean;
}

/**
 * A single IAB TCF v2.2 `TCData` payload delivered to an `addEventListener`
 * callback. Only the fields this SDK surfaces are declared. See the IAB TCF v2.2
 * CMP API spec.
 */
export interface TcfData {
  /** The IAB TC string, when the CMP has one available. */
  tcString?: string;
  /** Whether GDPR applies to this visitor, per the CMP. */
  gdprApplies?: boolean;
  /** CMP lifecycle event: `"tcloaded" | "cmpuishown" | "useractioncomplete"`. */
  eventStatus?: string;
  /** CMP status, e.g. `"loaded"`. */
  cmpStatus?: string;
  /** Listener id assigned by the CMP; pass it to `removeEventListener`. */
  listenerId?: number;
}

/**
 * The IAB TCF v2.2 `window.__tcfapi` function, present when a TCF CMP (such as
 * Ezoic's Gatekeeper CMP) is active on the page.
 */
export type TcfApi = (
  command: string,
  version: number,
  callback: (tcData: TcfData, success: boolean) => void,
  parameter?: number | string,
) => void;

/**
 * The subset of the global `window.ezstandalone` object this SDK reads or drives.
 * Ad-serving methods are optional: they are defined by `sa.min.js` once it
 * loads. Calls the SDK makes go through the {@link EzoicCommandQueue}, so they
 * run only after those methods exist.
 */
export interface EzstandaloneApi {
  cmd: EzoicCommandQueue;
  /** Requests one or more display placeholders. Debounced internally by the bundle. */
  showAds?(...placeholders: EzoicShowAdsArg[]): void;
  /** Requests additional placeholders after the initial load (infinite scroll / dynamic content). */
  displayMore?(...ids: number[]): void;
  /** Tears down the given placeholder ids. */
  destroyPlaceholders?(...ids: number[]): void;
  /** Tears down every selected placeholder plus anchor, side rails, and floating outstream. */
  destroyAll?(): void;
  /** Re-requests bids for the given already-loaded placeholder ids. */
  refreshAds?(...ids: number[]): void;
  /** A/B helper: reports whether the visitor is in the Ezoic-enabled cohort. */
  isEzoicUser?(percentage?: number, callback?: (isUser: boolean) => void): boolean;
  /**
   * Marks the page as a single-page application. Once set, the bundle routes a
   * post-navigation `showAds` to its internal `refresh()` (new-pageview reload)
   * instead of a first load. Idempotent. The bundle's SPAMonitor also sets this
   * automatically on the first client-side URL change.
   */
  setIsSinglePageApplication?(val: boolean): void;
  /**
   * Resolves a semantic location name (e.g. `"under_first_paragraph"`) to a free
   * reserved placeholder id, waiting for the placement service if needed. The
   * result is a number, or a numeric string from the bundle's key lookup — the
   * SDK coerces it to a number. Only present once `sa.min.js` initializes.
   */
  GetGeneratedIdAsync?(locationName: string): Promise<number | string>;
  /**
   * Applies publisher {@link EzoicConfig}. Write-only: the public wrapper does
   * not return the stored config. Unknown keys are ignored by the bundle.
   */
  config?(options: EzoicConfig): void;
  /** Enables Ezoic-managed consent (sets `manageConsent = true`). */
  enableConsent?(): void;
  /** Disables personalized statistics for this visitor (`saContext.dps`). */
  setDisablePersonalizedStatistics?(disable: boolean): void;
  /** Disables personalized ads for this visitor (`saContext.dpa`). */
  setDisablePersonalizedAds?(disable: boolean): void;
  /** Enables or disables the Ezoic anchor ad (`saContext.a`). */
  setEzoicAnchorAd?(enabled: boolean): void;
  /** Whether the visitor previously closed the anchor ad (reads `ez_anchor_closed`). */
  hasAnchorAdBeenClosed?(): boolean;
  /** Allows or disallows the interstitial format. */
  setInterstitialAllowed?(allowed: boolean, options?: Record<string, unknown>): void;
  /** Whether the interstitial format is currently allowed. */
  isInterstitialAllowed?(): boolean;
  /** Allows or disallows floating outstream. Resolves to the resulting allowed state. */
  setOutstreamAllowed?(allowed: boolean, options?: Record<string, unknown>): Promise<boolean>;
  /** Whether floating outstream is currently allowed. */
  isOutstreamAllowed?(): boolean;
  /**
   * Configures the site-wide rewarded-ad formats (anchor, interstitial, video,
   * side rails) and triggers the rewarded slot. Defaults to all four enabled.
   * Present once `sa.min.js` initializes.
   */
  initRewardedAds?(placements?: EzoicRewardedPlacements): void;
  /**
   * Registers one or more Ezoic video placeholders by publisher div id
   * (register-only — does NOT request ad code).
   *
   * Note: the bundle RESETS the entire video placeholder registry on each call
   * — it clears, then appends only the entries passed (see
   * {@link EzoicVideoDefineEntry}). Defined slots load when the page-level
   * `showAds`/`display` runs; to register and load in one call use
   * {@link EzstandaloneApi.displayMoreVideo}.
   */
  defineVideo?(...entries: EzoicVideoDefineEntry[]): void;
  /** Registers (if new) AND loads the video ad code for the given video placeholder div ids; appends without clobbering. */
  displayMoreVideo?(...divIds: string[]): void;
  /** Clears the given video divs and tears down their players. */
  destroyVideoPlaceholders?(...divIds: string[]): void;
}

// ---------------------------------------------------------------------------
// Rewarded ads (`window.ezRewardedAds`).
//
// Rewarded ads are driven by a SEPARATE bundle loaded from a site-specific
// domain-handler host (`{host}/porpoiseant/ezadloadrewarded.js`), with its own
// `cmd` queue independent of `ezstandalone.cmd`. Every method is callback-based
// (none returns a value), so the SDK wraps them as promises. Shapes below match
// the verified rewarded API.
// ---------------------------------------------------------------------------

/**
 * Site-wide rewarded placement toggles for
 * {@link EzstandaloneApi.initRewardedAds}. Every field defaults to `true`.
 */
export interface EzoicRewardedPlacements {
  /** Enable the anchor ad. */
  anchor?: boolean;
  /** Enable the interstitial format. */
  interstitial?: boolean;
  /** Enable floating outstream video. */
  video?: boolean;
  /** Enable the left and right side rails. */
  sideRails?: boolean;
}

/** Config for {@link EzRewardedAdsApi.request}. */
export interface EzoicRewardedRequestConfig {
  /** Minimum floor price for the ad. `null` (default) uses the domain config. */
  minCPM?: number | null;
  /** Type of reward to grant (e.g. `"coins"`). */
  rewardType?: string;
  /** Amount of reward to grant (e.g. `100`). */
  rewardAmount?: number;
}

/** Config for {@link EzRewardedAdsApi.show}. */
export interface EzoicRewardedShowConfig {
  /** Reward name for analytics tracking. */
  rewardName?: string;
  /** Arbitrary user information passed through for tracking. */
  userInfo?: Record<string, unknown>;
}

/** Config for {@link EzRewardedAdsApi.requestAndShow}. */
export interface EzoicRewardedRequestAndShowConfig extends EzoicRewardedRequestConfig {
  /** Reward name for analytics tracking. */
  rewardName?: string;
  /** Always invoke the callback, even when the reward is not granted. */
  alwaysCallback?: boolean;
  /** Grant the reward even when the ad fails to fill. */
  rewardOnNoFill?: boolean;
  /** Show a loading overlay while the ad is requested. */
  loadingOverlay?: boolean;
}

/** Customizable overlay text for {@link EzRewardedAdsApi.requestWithOverlay}. */
export interface EzoicRewardedOverlayText {
  /** Header text for the call-to-action modal. */
  header?: string;
  /** Body lines explaining the reward (one string per line). */
  body?: string[];
  /** Accept button text. */
  accept?: string;
  /** Cancel button text. */
  cancel?: string;
}

/** Config for {@link EzRewardedAdsApi.requestWithOverlay}. */
export interface EzoicRewardedOverlayConfig extends EzoicRewardedRequestAndShowConfig {
  /** Lock page scrolling while the overlay is shown. */
  lockScroll?: boolean;
  /** Skip the call-to-action overlay and show the ad immediately. */
  dontAsk?: boolean;
}

/** Call-to-action modal config for {@link EzoicContentLockerConfig}. */
export interface EzoicContentLockerCallToAction {
  /** Disable the call-to-action modal entirely. */
  disabled?: boolean;
  /** Header text. */
  header?: string;
  /** Body text. */
  body?: string;
  /** Button text. */
  button?: string;
}

/** Config for {@link EzRewardedAdsApi.contentLocker}. */
export interface EzoicContentLockerConfig {
  /** Show a loading overlay while preparing the ad. Defaults to `true`. */
  loadingOverlay?: boolean;
  /** Called with the request result once the ad is ready to display. */
  readyCallback?: ((result: EzoicRewardedRequestOutcome) => void) | null;
  /** Reward name for analytics tracking. */
  rewardName?: string;
  /** Minimum floor price for the ad. `null` (default) uses the domain config. */
  minCPM?: number | null;
  /** Type of reward to grant. */
  rewardType?: string;
  /** Amount of reward to grant. */
  rewardAmount?: number;
  /** Call-to-action modal configuration. */
  callToAction?: EzoicContentLockerCallToAction;
}

/**
 * Result delivered to a {@link EzRewardedAdsApi.request} callback. `status` is
 * `true` when an ad was successfully pre-fetched.
 */
export interface EzoicRewardedRequestOutcome {
  /** Whether the ad request succeeded (an ad is ready to show). */
  status: boolean;
  /** Human-readable status message. */
  msg: string;
  /** Ad metadata, present when an ad filled. */
  adInfo?: Record<string, unknown>;
}

/**
 * Result delivered to a `show` / `requestAndShow` / `requestWithOverlay`
 * callback. `reward` is `true` only when the visitor earned the reward.
 */
export interface EzoicRewardedShowOutcome {
  /** Whether the ad flow completed without an error (an ad was shown or handled). */
  status: boolean;
  /** Whether the reward was granted (ad watched to completion, or `rewardOnNoFill`). */
  reward: boolean;
  /** Human-readable status message (e.g. `"ad watched"`, `"user cancelled"`). */
  msg: string;
  /** Ad metadata, present when an ad was shown. */
  adInfo?: Record<string, unknown>;
  /** User information echoed back, present when the reward was granted. */
  userInfo?: Record<string, unknown>;
}

/**
 * The subset of `window.ezRewardedAds` this SDK drives. Methods are optional:
 * they only exist after the rewarded loader script initializes. Calls go through
 * the {@link EzoicCommandQueue}, so they run once the methods exist.
 */
export interface EzRewardedAdsApi {
  cmd: EzoicCommandQueue;
  /** `true` once the rewarded loader has finished initializing. */
  ready?: boolean;
  /** Records that a rewarded implementation is present (tracking only). */
  register?(): void;
  /** Pre-fetches a rewarded ad without showing it. */
  request?(
    callback: (data: EzoicRewardedRequestOutcome) => void,
    config?: EzoicRewardedRequestConfig,
  ): void;
  /** Shows a previously requested ad. Must follow a successful `request`. */
  show?(callback: (data: EzoicRewardedShowOutcome) => void, config?: EzoicRewardedShowConfig): void;
  /** Requests and immediately shows an ad with no call-to-action modal. */
  requestAndShow?(
    callback: (data: EzoicRewardedShowOutcome) => void,
    config?: EzoicRewardedRequestAndShowConfig,
  ): void;
  /** Requests and shows an ad behind a customizable call-to-action overlay. */
  requestWithOverlay?(
    callback: (data: EzoicRewardedShowOutcome) => void,
    text?: EzoicRewardedOverlayText,
    config?: EzoicRewardedOverlayConfig,
  ): void;
  /** Gates an action (URL redirect or function) behind watching a rewarded ad. */
  contentLocker?(action: string | (() => void), config?: EzoicContentLockerConfig): void;
}

/**
 * `Window` augmented with the optional Ezoic globals this SDK reads or creates.
 */
export interface EzoicWindow {
  ezstandalone?: EzstandaloneApi;
  /**
   * IAB TCF v2.2 API, present when a TCF CMP (e.g. Ezoic's Gatekeeper CMP) is
   * active. {@link useEzoicConsent} reads consent state through it.
   */
  __tcfapi?: TcfApi;
  /**
   * The rewarded-ads global, created by the site-specific rewarded loader script
   * (`{host}/porpoiseant/ezadloadrewarded.js`). {@link useEzoicRewarded} and the
   * rewarded passthroughs drive it through its own `cmd` queue.
   */
  ezRewardedAds?: EzRewardedAdsApi;
  /**
   * The Open Video (open.video) player queue. Before `video.js` loads it is a
   * plain array of {@link OpenVideoPlayerEntry}; after load the platform
   * REPLACES it with a live {@link OpenVideoPlayersQueue} handler that drains
   * pushes. It must only ever be guard-initialized
   * (`window.openVideoPlayers = window.openVideoPlayers || []`) and NEVER reset
   * or reassigned to a fresh array — doing so clobbers the live handler and
   * every subsequent push is lost.
   */
  openVideoPlayers?: OpenVideoPlayerEntry[] | OpenVideoPlayersQueue;
}
