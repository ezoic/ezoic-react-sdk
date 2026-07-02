import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ensureEzoicScripts, pushToEzoicCmd, type EnsureEzoicScriptsOptions } from './scripts';
import {
  destroyAll,
  destroyPlaceholders,
  displayMore,
  isEzoicUser,
  refreshAds,
  setIsSinglePageApplication,
  showAds,
} from './adManager';
import type { EzoicShowAdsArg } from './types';

/** Value exposed by {@link useEzoic}. */
export interface EzoicContextValue {
  /**
   * `true` once the provider has run its client-side script injection. This
   * signals the SDK is mounted and {@link EzoicContextValue.push} is wired — it
   * does NOT mean `sa.min.js` has finished loading or that ads have rendered.
   * Commands pushed before ads load are queued and run after initialization.
   */
  isReady: boolean;
  /**
   * Queues a command on `window.ezstandalone.cmd`. Runs after the standalone
   * bundle initializes. No-op on the server.
   */
  push: (command: () => void) => void;
  /**
   * Requests one or more display placeholders. Accepts bare ids, an array of
   * ids, or the object form (`{ id, required, sizes }`). Queued until the bundle
   * loads. `<EzoicAd>` calls this for you; use it directly for imperative flows.
   */
  showAds: (...placeholders: EzoicShowAdsArg[]) => void;
  /** Requests additional placeholders after the initial load (infinite scroll / dynamic content). */
  displayMore: (...ids: number[]) => void;
  /** Tears down the given placeholder ids. */
  destroyPlaceholders: (...ids: number[]) => void;
  /** Tears down every selected placeholder plus anchor, side rails, and floating outstream. */
  destroyAll: () => void;
  /** Re-requests bids for the given already-loaded placeholder ids. */
  refreshAds: (...ids: number[]) => void;
  /**
   * Reports whether the visitor is in the Ezoic-enabled A/B cohort. Returns
   * `undefined` until `sa.min.js` loads; pass a `callback` to be notified once
   * the answer is known.
   */
  isEzoicUser: (percentage?: number, callback?: (isUser: boolean) => void) => boolean | undefined;
  /**
   * Marks the page as a single-page application. The provider calls this at
   * boot unless {@link EzoicProviderProps.singlePageApp} is `false`; exposed here
   * for imperative flows that need to toggle it later.
   */
  setIsSinglePageApplication: (val: boolean) => void;
}

const EzoicContext = createContext<EzoicContextValue | null>(null);

/** Props for {@link EzoicProvider}. */
export interface EzoicProviderProps extends EnsureEzoicScriptsOptions {
  children?: ReactNode;
  /**
   * Whether to mark the page as a single-page application at boot by pushing
   * `ezstandalone.setIsSinglePageApplication(true)`. Defaults to `true`, which
   * is correct for React apps that navigate client-side: after a route change,
   * `showAds` routes to the bundle's `refresh()` (new-pageview reload). Set to
   * `false` only for a provider that renders on a single, never-navigated page.
   */
  singlePageApp?: boolean;
}

/**
 * Injects the Ezoic script chain (Gatekeeper CMP → cmd-queue stub →
 * `sa.min.js` → optional analytics) once on mount and exposes the SDK context.
 *
 * Injection runs in an effect, so it never touches `window`/`document` during
 * render and is safe under `react-dom/server` and the Next.js app router. Wrap
 * your app (or the subtree that shows ads) in a single `<EzoicProvider>`.
 *
 * @example
 * ```tsx
 * export default function App() {
 *   return (
 *     <EzoicProvider>
 *       <YourRoutes />
 *     </EzoicProvider>
 *   );
 * }
 * ```
 */
export function EzoicProvider({
  children,
  saScriptUrl,
  cmpScriptUrls,
  analyticsUrl,
  singlePageApp = true,
}: EzoicProviderProps): ReactNode {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    ensureEzoicScripts({ saScriptUrl, cmpScriptUrls, analyticsUrl });
    // Enable SPA mode before the first ad request so client-side navigations
    // reload ads as new pageviews. `setIsSinglePageApplication` is idempotent,
    // so re-running this effect (e.g. if a script URL prop changes) is safe.
    if (singlePageApp) {
      setIsSinglePageApplication(true);
    }
    setIsReady(true);
  }, [saScriptUrl, cmpScriptUrls, analyticsUrl, singlePageApp]);

  const value = useMemo<EzoicContextValue>(
    () => ({
      isReady,
      push: pushToEzoicCmd,
      showAds,
      displayMore,
      destroyPlaceholders,
      destroyAll,
      refreshAds,
      isEzoicUser,
      setIsSinglePageApplication,
    }),
    [isReady],
  );

  return <EzoicContext.Provider value={value}>{children}</EzoicContext.Provider>;
}

/**
 * Returns the Ezoic SDK context. Must be called inside an {@link EzoicProvider}.
 *
 * @throws Error when used outside of an `<EzoicProvider>`.
 */
export function useEzoic(): EzoicContextValue {
  const context = useContext(EzoicContext);
  if (context === null) {
    throw new Error('useEzoic must be used within an <EzoicProvider>.');
  }
  return context;
}
