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
}
