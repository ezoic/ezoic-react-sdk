import { useState, type ReactElement } from 'react';
import { useEzoicRewarded } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/**
 * Rewarded ads. A text input supplies the site-specific loader URL (the
 * `/porpoiseant/ezadloadrewarded.js` script from the publisher dashboard). The
 * "Request & show reward" button awaits `requestAndShow()` inside try/catch and
 * logs the outcome; without a loader URL the request will not resolve to a fill
 * locally.
 */
export function RewardedSection(): ReactElement {
  const { log } = useEventLog();
  const [loaderUrl, setLoaderUrl] = useState('');
  const trimmed = loaderUrl.trim();

  const { ready, initiated, displayed, closed, requestAndShow } = useEzoicRewarded({
    loaderUrl: trimmed || undefined,
  });

  const onRequest = async (): Promise<void> => {
    log('Rewarded: requestAndShow() called…');
    try {
      const outcome = await requestAndShow();
      log(
        `Rewarded outcome: status=${String(outcome.status)} reward=${String(outcome.reward)} msg=${outcome.msg}`,
      );
    } catch (err) {
      log(`Rewarded error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <section className="section">
      <h2 className="section-title">Rewarded ads</h2>
      <p className="section-desc">
        Provide the site-specific rewarded loader URL from your publisher dashboard. Without it, the
        request cannot resolve to a fill locally.
      </p>
      <label className="field">
        <span className="field-label">Loader URL</span>
        <input
          className="field-input"
          type="text"
          value={loaderUrl}
          onChange={(e) => setLoaderUrl(e.target.value)}
          placeholder="https://<yourDomainHandlerHost>/porpoiseant/ezadloadrewarded.js"
        />
      </label>
      <button
        className="btn"
        type="button"
        onClick={() => {
          void onRequest();
        }}
      >
        Request &amp; show reward
      </button>
      <ul className="status-list">
        <li>ready: {String(ready)}</li>
        <li>initiated: {String(initiated)}</li>
        <li>displayed: {String(displayed)}</li>
        <li>closed: {String(closed)}</li>
      </ul>
    </section>
  );
}
