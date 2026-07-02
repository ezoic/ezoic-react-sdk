import { pushToEzoicCmd } from './scripts';
import type { EzoicVideoDefineEntry, EzoicWindow } from './types';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

// ---------------------------------------------------------------------------
// Imperative passthroughs to the standalone bundle's video methods.
//
// These drive the SAME `window.ezstandalone.cmd` queue as display ads, so they
// run only after `sa.min.js` initializes and are no-ops on the server. Optional
// chaining guards the rare case where the bundle failed to load.
// ---------------------------------------------------------------------------

/**
 * Registers Ezoic video placeholders via `ezstandalone.defineVideo` WITHOUT
 * requesting ad code. Accepts bare publisher div ids or the object form
 * (`{ divID }`).
 *
 * The bundle clears its video registry on each call, then appends only the
 * entries passed, so a caller managing multiple video divs must pass the full
 * set in one call. Defined slots load when the page-level `showAds`/`display`
 * runs. To register AND load a slot in one call (the common case), use
 * {@link displayMoreVideo} instead. `<EzoicVideo>` uses `displayMoreVideo`.
 */
export function defineVideo(...entries: EzoicVideoDefineEntry[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.defineVideo?.(...entries);
  });
}

/**
 * Registers (if not already registered) AND loads the video ad code for the
 * given publisher video div ids via `ezstandalone.displayMoreVideo`.
 *
 * Appends to the bundle's video registry (does not clear it), so it is safe to
 * call repeatedly with new ids; ids already registered are skipped by the
 * bundle. This is the self-contained load path `<EzoicVideo>` uses.
 */
export function displayMoreVideo(...divIds: string[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.displayMoreVideo?.(...divIds);
  });
}

/**
 * Clears the given video divs and tears down their players via
 * `ezstandalone.destroyVideoPlaceholders`.
 */
export function destroyVideoPlaceholders(...divIds: string[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.destroyVideoPlaceholders?.(...divIds);
  });
}

// ---------------------------------------------------------------------------
// <EzoicVideo> coordination: same-tick batching via displayMoreVideo only.
//
// State is module-level on purpose: every <EzoicVideo> on the page shares one
// standalone bundle. `displayMoreVideo` both registers (appends, no clear) and
// loads its ids, so the collector simply coalesces every id acquired in a tick
// into ONE `displayMoreVideo(...ids)` call. It never calls `defineVideo` (that
// register-only primitive clears the registry and does not request ad code).
// Appending across ticks is additive and clobber-free.
// ---------------------------------------------------------------------------

/** Div ids currently owned by a mounted `<EzoicVideo>` — the release-tracking set and the duplicate-id guard. */
const ownedVideoIds = new Set<string>();

/** Div ids queued for the next microtask flush. */
let pendingVideoIds = new Set<string>();

/** Whether a flush microtask is already scheduled for the current tick. */
let videoFlushScheduled = false;

/**
 * Emits one `displayMoreVideo` with every id acquired in the current tick,
 * which both registers and loads them. No `defineVideo` is called.
 */
function flushVideo(): void {
  videoFlushScheduled = false;
  if (pendingVideoIds.size === 0) return;
  const batch = pendingVideoIds;
  pendingVideoIds = new Set();
  displayMoreVideo(...batch);
}

/**
 * Registers an `<EzoicVideo>` div id and queues it into the current tick's
 * video batch. Returns `true` when the caller now owns the id (and should render
 * its div and later release it); returns `false` when the id is already owned by
 * another mounted `<EzoicVideo>`, after warning — the duplicate must not render a
 * second div with the same id.
 *
 * @param divId Publisher-chosen video container div id.
 */
export function acquireVideo(divId: string): boolean {
  if (ownedVideoIds.has(divId)) {
    console.warn(
      `[ezoic/react-sdk] Duplicate <EzoicVideo divId="${divId}" />: divId "${divId}" is ` +
        `already mounted. Rendering only the first; ignoring the duplicate.`,
    );
    return false;
  }
  ownedVideoIds.add(divId);
  pendingVideoIds.add(divId);
  if (!videoFlushScheduled) {
    videoFlushScheduled = true;
    queueMicrotask(flushVideo);
  }
  return true;
}

/**
 * Releases an owned `<EzoicVideo>` div id on unmount. If the id is still waiting
 * in the current batch it never reached `displayMoreVideo`, so it is simply
 * dropped. Otherwise the placeholder was loaded and is torn down with
 * `destroyVideoPlaceholders(divId)`.
 */
export function releaseVideo(divId: string): void {
  ownedVideoIds.delete(divId);
  if (pendingVideoIds.has(divId)) {
    pendingVideoIds.delete(divId);
    return;
  }
  destroyVideoPlaceholders(divId);
}

/**
 * Resets all module-level `<EzoicVideo>` coordination state.
 *
 * @internal Test-only. Not exported from the package entry point; exists so unit
 * tests can isolate the shared registry and batch between cases.
 */
export function resetVideoState(): void {
  ownedVideoIds.clear();
  pendingVideoIds = new Set();
  videoFlushScheduled = false;
}
