import { useEffect, useState } from 'react';
import type { EzoicWindow, TcfApi, TcfData } from './types';

/** Reactive consent state read from the IAB TCF v2.2 CMP via `window.__tcfapi`. */
export interface EzoicConsentState {
  /** `true` once a TCF CMP (`window.__tcfapi`) is present on the page. */
  cmpPresent: boolean;
  /**
   * `true` once the CMP reports `eventStatus` `"tcloaded"` or
   * `"useractioncomplete"` — i.e. a usable TC string is available.
   */
  tcfReady: boolean;
  /** Latest IAB TC string, or `undefined` until loaded / when no CMP is present. */
  tcString?: string;
  /** Whether GDPR applies to this visitor, per the CMP. `undefined` until known. */
  gdprApplies?: boolean;
  /** Latest CMP `eventStatus` (`"tcloaded" | "cmpuishown" | "useractioncomplete"`). */
  eventStatus?: string;
  /** Latest CMP status string (e.g. `"loaded"`). */
  cmpStatus?: string;
}

const INITIAL_STATE: EzoicConsentState = { cmpPresent: false, tcfReady: false };

/** How many times to poll for a late-injected `__tcfapi` before giving up. */
const MAX_TCFAPI_POLLS = 40;
/** Interval between `__tcfapi` presence polls (ms). ~10s total at 40 polls. */
const TCFAPI_POLL_MS = 250;

/**
 * Subscribes to the IAB TCF v2.2 CMP (`window.__tcfapi`) and returns the current
 * {@link EzoicConsentState}. Use it to gate UI on consent — e.g. show a message
 * until `tcfReady`, or read the `tcString`.
 *
 * SSR-safe: on the server (and the first client render) it returns
 * `{ cmpPresent: false, tcfReady: false }`, matching the server output so there
 * is no hydration mismatch. When no TCF CMP is present it stays at that initial
 * state and never throws.
 *
 * The Ezoic Gatekeeper CMP loads asynchronously, so if `__tcfapi` is not yet on
 * the page this hook briefly polls for it (bounded, then gives up) before
 * registering a TCF `addEventListener`. The listener is removed on unmount.
 *
 * @example
 * ```tsx
 * function ConsentBadge() {
 *   const { tcfReady, gdprApplies } = useEzoicConsent();
 *   if (!tcfReady) return <span>Loading consent…</span>;
 *   return <span>{gdprApplies ? 'GDPR applies' : 'GDPR does not apply'}</span>;
 * }
 * ```
 */
export function useEzoicConsent(): EzoicConsentState {
  const [state, setState] = useState<EzoicConsentState>(INITIAL_STATE);

  useEffect(() => {
    const w = typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
    if (!w) return;

    let cancelled = false;
    let listenerId: number | undefined;
    let pollTimer: ReturnType<typeof setInterval> | undefined;

    const handleTcData = (tcData: TcfData, success: boolean): void => {
      if (cancelled) return;
      if (tcData && typeof tcData.listenerId === 'number') {
        listenerId = tcData.listenerId;
      }
      if (!success || !tcData) {
        setState((prev) => (prev.cmpPresent ? prev : { ...prev, cmpPresent: true }));
        return;
      }
      const tcfReady =
        tcData.eventStatus === 'tcloaded' || tcData.eventStatus === 'useractioncomplete';
      setState({
        cmpPresent: true,
        tcfReady,
        tcString: tcData.tcString,
        gdprApplies: tcData.gdprApplies,
        eventStatus: tcData.eventStatus,
        cmpStatus: tcData.cmpStatus,
      });
    };

    const register = (tcfapi: TcfApi): void => {
      setState((prev) => (prev.cmpPresent ? prev : { ...prev, cmpPresent: true }));
      tcfapi('addEventListener', 2, handleTcData);
    };

    if (typeof w.__tcfapi === 'function') {
      register(w.__tcfapi);
    } else {
      let attempts = 0;
      pollTimer = setInterval(() => {
        attempts += 1;
        const api = w.__tcfapi;
        if (typeof api === 'function') {
          clearInterval(pollTimer);
          pollTimer = undefined;
          register(api);
        } else if (attempts >= MAX_TCFAPI_POLLS) {
          clearInterval(pollTimer);
          pollTimer = undefined;
        }
      }, TCFAPI_POLL_MS);
    }

    return () => {
      cancelled = true;
      if (pollTimer !== undefined) {
        clearInterval(pollTimer);
      }
      const api = w.__tcfapi;
      if (typeof api === 'function' && typeof listenerId === 'number') {
        api('removeEventListener', 2, () => undefined, listenerId);
      }
    };
  }, []);

  return state;
}
