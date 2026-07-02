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
}

/**
 * `Window` augmented with the optional Ezoic globals this SDK reads or creates.
 */
export interface EzoicWindow {
  ezstandalone?: EzstandaloneApi;
}
