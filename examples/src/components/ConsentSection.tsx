import { type ReactElement } from 'react';
import {
  config,
  enableConsent,
  hasAnchorAdBeenClosed,
  isInterstitialAllowed,
  isOutstreamAllowed,
  setDisablePersonalizedAds,
  setDisablePersonalizedStatistics,
  setEzoicAnchorAd,
  setInterstitialAllowed,
  setOutstreamAllowed,
  useEzoicConsent,
} from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/** Truncates a long value (e.g. the TC string) for compact display. */
function truncate(value: string | undefined, max = 24): string {
  if (!value) return '(none)';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/**
 * Reads live CMP/TCF state via {@link useEzoicConsent} and drives the consent,
 * config, and format-toggle passthroughs. The write functions queue on the
 * command queue; the `is*` / `hasAnchorAdBeenClosed` getters read the bundle
 * synchronously and return `undefined` until it loads.
 */
export function ConsentSection(): ReactElement {
  const { log } = useEventLog();
  const consent = useEzoicConsent();

  const applyConfig = (): void => {
    config({ anchorAdPosition: 'bottom', reservePlaceholderSpace: true });
    log("config({ anchorAdPosition: 'bottom', reservePlaceholderSpace: true })");
  };
  const enableAnchor = (): void => {
    setEzoicAnchorAd(true);
    log('setEzoicAnchorAd(true)');
  };
  const disablePersonalizedAds = (): void => {
    setDisablePersonalizedAds(true);
    log('setDisablePersonalizedAds(true)');
  };
  const turnOnConsent = (): void => {
    enableConsent();
    log('enableConsent()');
  };
  const disableStatistics = (): void => {
    setDisablePersonalizedStatistics(true);
    log('setDisablePersonalizedStatistics(true)');
  };
  const toggleInterstitial = (): void => {
    setInterstitialAllowed(true);
    log(`setInterstitialAllowed(true) · isInterstitialAllowed() -> ${String(isInterstitialAllowed())}`);
  };
  const toggleOutstream = (): void => {
    setOutstreamAllowed(true);
    log(`setOutstreamAllowed(true) · isOutstreamAllowed() -> ${String(isOutstreamAllowed())}`);
  };
  const checkAnchorClosed = (): void => {
    log(`hasAnchorAdBeenClosed() -> ${String(hasAnchorAdBeenClosed())}`);
  };

  return (
    <section className="section">
      <h2 className="section-title">Consent & config</h2>
      <p className="section-desc">
        Live CMP/TCF state plus the consent, config, and format-toggle passthroughs.
      </p>
      <ul className="status-list">
        <li>cmpPresent: {String(consent.cmpPresent)}</li>
        <li>tcfReady: {String(consent.tcfReady)}</li>
        <li>eventStatus: {consent.eventStatus ?? '(none)'}</li>
        <li>cmpStatus: {consent.cmpStatus ?? '(none)'}</li>
        <li>gdprApplies: {String(consent.gdprApplies)}</li>
        <li>tcString: {truncate(consent.tcString)}</li>
      </ul>
      <div className="btn-row">
        <button className="btn" type="button" onClick={applyConfig}>
          Apply config
        </button>
        <button className="btn" type="button" onClick={enableAnchor}>
          Enable anchor ad
        </button>
        <button className="btn" type="button" onClick={disablePersonalizedAds}>
          Disable personalized ads
        </button>
        <button className="btn" type="button" onClick={turnOnConsent}>
          Enable consent
        </button>
        <button className="btn" type="button" onClick={disableStatistics}>
          Disable personalized statistics
        </button>
        <button className="btn" type="button" onClick={toggleInterstitial}>
          Allow interstitial
        </button>
        <button className="btn" type="button" onClick={toggleOutstream}>
          Allow outstream
        </button>
        <button className="btn" type="button" onClick={checkAnchorClosed}>
          Check anchor closed
        </button>
      </div>
    </section>
  );
}
