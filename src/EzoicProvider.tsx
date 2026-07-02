import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ensureEzoicScripts, pushToEzoicCmd, type EnsureEzoicScriptsOptions } from './scripts';

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
}

const EzoicContext = createContext<EzoicContextValue | null>(null);

/** Props for {@link EzoicProvider}. */
export interface EzoicProviderProps extends EnsureEzoicScriptsOptions {
  children?: ReactNode;
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
}: EzoicProviderProps): ReactNode {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    ensureEzoicScripts({ saScriptUrl, cmpScriptUrls, analyticsUrl });
    setIsReady(true);
  }, [saScriptUrl, cmpScriptUrls, analyticsUrl]);

  const value = useMemo<EzoicContextValue>(() => ({ isReady, push: pushToEzoicCmd }), [isReady]);

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
