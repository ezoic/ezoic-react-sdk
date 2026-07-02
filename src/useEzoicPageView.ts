import { useEffect, useRef } from 'react';
import { destroyAll, destroyPlaceholders, showAds } from './adManager';
import { useEzoic } from './EzoicProvider';

/** Options for {@link useEzoicPageView}. */
export interface UseEzoicPageViewOptions {
  /**
   * The placeholder ids shown on the current route. When provided, a route
   * change tears down the departing route's ids with `destroyPlaceholders(...)`
   * and requests these ids with `showAds(...)`. When omitted, a route change
   * calls `destroyAll()` then `showAds()` (scan every placeholder div in the
   * DOM) — use this for pages whose placeholder divs you render manually and
   * cannot easily enumerate.
   */
  ids?: number[];
}

/**
 * Router-agnostic single-page-application page-view coordinator.
 *
 * Call it once per rendered view with a value that changes on every navigation
 * — a router pathname, a route key, or any stable per-page string. On the first
 * render it only records the baseline; the initial page's ads load via
 * {@link EzoicAd} mounts or an explicit `showAds`. On each subsequent change of
 * `pageKey` it tears down the departing route's placeholders and then requests
 * the new route's placeholders, in that order.
 *
 * It never calls `newPage()` itself: the standalone bundle's built-in SPAMonitor
 * already fires `newPage()` on the client-side URL change (it patches
 * `history.pushState`/`replaceState` and listens for `popstate`), so the SDK
 * coalesces with it rather than double-firing. After that reset, the SDK's
 * `showAds` routes to the bundle's `refresh()` new-pageview reload.
 *
 * Use this for manually-rendered placeholder divs, or to force a new-pageview
 * reload when the same {@link EzoicAd} ids persist across routes. When each
 * route renders a different set of {@link EzoicAd} components, those components
 * already destroy on unmount and show on mount — do not also pass the same ids
 * here, or the ad would be requested twice.
 *
 * Must be called inside an {@link EzoicProvider}.
 *
 * @param pageKey A value that is stable within a page and changes on navigation.
 * @param options See {@link UseEzoicPageViewOptions}.
 *
 * @example
 * ```tsx
 * // React Router v6
 * import { useLocation } from 'react-router-dom';
 * function Ads() {
 *   useEzoicPageView(useLocation().pathname, { ids: [101, 102] });
 *   return (
 *     <>
 *       <EzoicAd id={101} />
 *       <EzoicAd id={102} />
 *     </>
 *   );
 * }
 * ```
 */
export function useEzoicPageView(pageKey: string, options?: UseEzoicPageViewOptions): void {
  // Enforce that an <EzoicProvider> is present (throws otherwise).
  useEzoic();

  // Read ids at fire time from a ref so an unstable inline `ids` array does not
  // re-run the effect; the effect depends only on `pageKey`.
  const idsRef = useRef<number[] | undefined>(options?.ids);
  idsRef.current = options?.ids;

  const prevKeyRef = useRef<string | undefined>(undefined);
  const prevIdsRef = useRef<number[] | undefined>(undefined);

  useEffect(() => {
    const prevKey = prevKeyRef.current;
    const currentIds = idsRef.current;

    // First render: record the baseline and fire nothing. Under StrictMode the
    // effect runs twice on mount; the second run sees prevKey === pageKey below
    // and is a no-op, so a mount never triggers a spurious reload.
    if (prevKey === undefined) {
      prevKeyRef.current = pageKey;
      prevIdsRef.current = currentIds;
      return;
    }

    // Same route (an unrelated re-render): nothing to do.
    if (prevKey === pageKey) return;

    // Route change: tear down the departing route, then request the new one.
    const departing = prevIdsRef.current;
    if (departing && departing.length > 0) {
      destroyPlaceholders(...departing);
    } else {
      // Departing ids unknown — reset everything (anchor, rails, floating,
      // and every selected placeholder) before rescanning.
      destroyAll();
    }

    if (currentIds && currentIds.length > 0) {
      showAds(...currentIds);
    } else {
      showAds();
    }

    prevKeyRef.current = pageKey;
    prevIdsRef.current = currentIds;
    // Depends only on `pageKey`; ids are read from a ref (which exhaustive-deps
    // ignores), so an unstable inline `ids` array never churns this effect.
  }, [pageKey]);
}
