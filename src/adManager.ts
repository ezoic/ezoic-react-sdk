import { pushToEzoicCmd } from './scripts';
import type { EzoicShowAdsArg, EzoicShowAdsPlaceholder, EzoicWindow } from './types';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

// ---------------------------------------------------------------------------
// Imperative passthroughs to the standalone bundle.
//
// Each command is queued on `window.ezstandalone.cmd` so it runs only after the
// bundle initializes (the queue stores it until then). All are no-ops on the
// server. Optional chaining guards the rare case where the bundle failed to
// load, so a missing method degrades to a no-op instead of throwing on the page.
// ---------------------------------------------------------------------------

/**
 * Requests one or more display placeholders via `ezstandalone.showAds`. Accepts
 * bare ids, an array of ids, or the object form (`{ id, required, sizes }`). The
 * bundle applies its own 200–800 ms debounce, so several `showAds` calls in
 * quick succession still result in a single batched ad request.
 */
export function showAds(...placeholders: EzoicShowAdsArg[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.showAds?.(...placeholders);
  });
}

/**
 * Requests additional placeholders after the initial load — the primary tool
 * for infinite scroll and dynamically inserted content.
 */
export function displayMore(...ids: number[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.displayMore?.(...ids);
  });
}

/** Tears down the given placeholder ids via `ezstandalone.destroyPlaceholders`. */
export function destroyPlaceholders(...ids: number[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.destroyPlaceholders?.(...ids);
  });
}

/**
 * Tears down every selected placeholder plus the anchor, side rails, and
 * floating outstream via `ezstandalone.destroyAll`.
 */
export function destroyAll(): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.destroyAll?.();
  });
}

/** Re-requests bids for the given already-loaded placeholder ids. */
export function refreshAds(...ids: number[]): void {
  pushToEzoicCmd(() => {
    getWindow()?.ezstandalone?.refreshAds?.(...ids);
  });
}

/**
 * Reports whether the visitor is in the Ezoic-enabled A/B cohort.
 *
 * Returns the bundle's boolean result when `sa.min.js` has initialized. Before
 * that the answer is not yet known, so it returns `undefined`; when a `callback`
 * is supplied it is queued and invoked with the boolean once the bundle loads.
 */
export function isEzoicUser(
  percentage?: number,
  callback?: (isUser: boolean) => void,
): boolean | undefined {
  const ez = getWindow()?.ezstandalone;
  if (ez && typeof ez.isEzoicUser === 'function') {
    return ez.isEzoicUser(percentage, callback);
  }
  if (callback) {
    pushToEzoicCmd(() => {
      getWindow()?.ezstandalone?.isEzoicUser?.(percentage, callback);
    });
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// <EzoicAd> coordination: same-tick batching + duplicate-id registry.
//
// State is module-level on purpose: every <EzoicAd> on the page shares one
// standalone bundle, so a single global collector coalesces their mounts into
// one `showAds` call and one id registry enforces the one-owner-per-id rule.
// ---------------------------------------------------------------------------

/** Ids currently owned by a mounted `<EzoicAd>` — powers the duplicate-id guard. */
const ownedIds = new Set<number>();

/** Placeholders queued for the next microtask flush, keyed by id (dedupes). */
let pendingShow = new Map<number, EzoicShowAdsPlaceholder>();

/** Whether a flush microtask is already scheduled for the current tick. */
let flushScheduled = false;

/** Emits one `showAds` for every placeholder collected in the current tick. */
function flushShow(): void {
  flushScheduled = false;
  if (pendingShow.size === 0) return;
  const batch = pendingShow;
  pendingShow = new Map();
  const args: EzoicShowAdsArg[] = [];
  for (const placeholder of batch.values()) {
    const noConfig =
      placeholder.required === undefined &&
      (placeholder.sizes === undefined || placeholder.sizes.length === 0);
    args.push(noConfig ? placeholder.id : placeholder);
  }
  showAds(...args);
}

/**
 * Registers an `<EzoicAd>` id and queues it into the current tick's `showAds`
 * batch. Returns `true` when the caller now owns the id (and should render its
 * div and later release it); returns `false` when the id is already owned by
 * another mounted `<EzoicAd>`, after warning — the duplicate must not render a
 * second div with the same id.
 */
export function acquirePlaceholder(placeholder: EzoicShowAdsPlaceholder): boolean {
  const { id } = placeholder;
  if (ownedIds.has(id)) {
    console.warn(
      `[ezoic/react-sdk] Duplicate <EzoicAd id={${id}} />: id ${id} is already ` +
        `mounted. Rendering only the first; ignoring the duplicate.`,
    );
    return false;
  }
  ownedIds.add(id);
  pendingShow.set(id, placeholder);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushShow);
  }
  return true;
}

/**
 * Releases an owned `<EzoicAd>` id on unmount. If the id is still waiting in the
 * current batch it never reached `showAds`, so it is simply dropped. Otherwise
 * the placeholder was shown and is torn down with `destroyPlaceholders(id)`.
 */
export function releasePlaceholder(id: number): void {
  ownedIds.delete(id);
  if (pendingShow.has(id)) {
    pendingShow.delete(id);
    return;
  }
  destroyPlaceholders(id);
}

/**
 * Resets all module-level `<EzoicAd>` coordination state.
 *
 * @internal Test-only. Not exported from the package entry point; exists so unit
 * tests can isolate the shared registry and batch between cases.
 */
export function resetAdManagerState(): void {
  ownedIds.clear();
  pendingShow = new Map();
  flushScheduled = false;
}
