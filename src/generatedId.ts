import { pushToEzoicCmd } from './scripts';
import { resolveLocationIdFromMap } from './locations';
import type { EzoicWindow } from './types';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

/**
 * How long to wait for `sa.min.js` before resolving a zero-config location from
 * the static map. The primary path runs through the command queue as soon as the
 * bundle initializes; this timer only fires the static fallback when the bundle
 * never loads (offline, blocked, or a local structural test), so the placeholder
 * still gets a deterministic id. It matches the bundle's own placement-service
 * wait (40 × 100 ms) so it never pre-empts a bundle that is merely slow.
 */
export const LOCATION_FALLBACK_MS = 4000;

/**
 * Coerces the bundle's `GetGeneratedId` result — a number (God-mode allocation)
 * or a numeric string (object-key lookup) — to a positive integer, or
 * `undefined` when it is neither.
 */
function coerceId(raw: unknown): number | undefined {
  const n = typeof raw === 'string' ? Number(raw) : raw;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : undefined;
}

/**
 * Resolves a semantic location name to a reserved placeholder id.
 *
 * Primary path: once `sa.min.js` initializes, delegate to
 * `ezstandalone.GetGeneratedIdAsync`, which is DOM-aware and allocates a free id
 * (so repeated locations get distinct ids). The call is queued on
 * `ezstandalone.cmd`, guaranteeing the method exists when it runs.
 *
 * Fallback path: if the bundle never loads within {@link LOCATION_FALLBACK_MS},
 * or it loads without the async API, resolve from the static id→location map via
 * {@link resolveLocationIdFromMap} so the placeholder still renders.
 *
 * @param location A documented location name or alias (callers should validate
 *   with `isKnownLocation` first — an unknown name rejects).
 * @param isTaken Reports ids already claimed on the page, used by the static
 *   fallback to pick a free id for repeated locations.
 * @param fallbackMs Override the bundle-absent fallback delay; a negative value
 *   disables the timer (tests use a short value or disable it).
 * @returns A promise resolving to the placeholder id, rejecting only when the
 *   location cannot be resolved at all.
 */
export function resolveGeneratedId(
  location: string,
  isTaken: (id: number) => boolean = () => false,
  fallbackMs: number = LOCATION_FALLBACK_MS,
): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const done = (): void => {
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
    };

    const staticFallback = (): void => {
      if (settled) return;
      const id = resolveLocationIdFromMap(location, isTaken);
      done();
      if (id === undefined) {
        reject(
          new Error(`[ezoic/react-sdk] Unknown zero-config location: ${JSON.stringify(location)}.`),
        );
      } else {
        resolve(id);
      }
    };

    const settleWith = (id: number | undefined): void => {
      if (settled) return;
      if (id === undefined) {
        staticFallback();
        return;
      }
      done();
      resolve(id);
    };

    // Primary: authoritative resolution once the bundle has initialized. If the
    // bundle is already loaded, the command runs synchronously and settles now.
    pushToEzoicCmd(() => {
      const ez = getWindow()?.ezstandalone;
      if (ez && typeof ez.GetGeneratedIdAsync === 'function') {
        Promise.resolve(ez.GetGeneratedIdAsync(location))
          .then((raw) => settleWith(coerceId(raw)))
          .catch(() => staticFallback());
      } else {
        // Bundle initialized but the async API is absent — use the static map.
        staticFallback();
      }
    });

    // Bundle-absent safety net: only static-fallback if the bundle never loaded.
    // If the bundle is present, the queued command above owns resolution.
    if (!settled && fallbackMs >= 0 && typeof setTimeout === 'function') {
      timer = setTimeout(() => {
        if (settled) return;
        const ez = getWindow()?.ezstandalone;
        if (ez && typeof ez.showAds === 'function') return; // bundle up; keep waiting
        staticFallback();
      }, fallbackMs);
    }
  });
}
