/**
 * Minimal type contracts for the pieces of `window.ezstandalone` this release
 * touches. The full standalone surface (`showAds`, `destroyPlaceholders`, …) is
 * added in later releases as the component and hook API lands; keeping the
 * contract minimal avoids claiming methods the SDK does not yet drive.
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
 * The subset of the global `window.ezstandalone` object used by this release.
 */
export interface EzstandaloneApi {
  cmd: EzoicCommandQueue;
}

/**
 * `Window` augmented with the optional Ezoic globals this SDK reads or creates.
 */
export interface EzoicWindow {
  ezstandalone?: EzstandaloneApi;
}
