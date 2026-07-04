import { type ReactElement } from 'react';
import { useEzoicRewarded } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/**
 * Rewarded ads in the default (runtime-served) mode: no loader URL. Because the
 * SDK bootstraps the Ezoic header scripts, `useEzoicRewarded({ placements })`
 * pushes `ezstandalone.initRewardedAds(...)` and the Ezoic runtime serves the
 * host-correct rewarded loader itself. The "Request & show reward" button awaits
 * `requestAndShow()` inside try/catch and logs the outcome.
 */
export function RewardedSection(): ReactElement {
  const { log } = useEventLog();

  const { ready, initiated, displayed, closed, requestAndShow } = useEzoicRewarded({
    placements: { anchor: false, interstitial: false, video: true, sideRails: false },
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
        No loader URL is needed on Ezoic-integrated pages — the loader is served by Ezoic
        automatically after <code>initRewardedAds</code> runs. This panel scopes the site-wide
        placements to floating video only.
      </p>
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
