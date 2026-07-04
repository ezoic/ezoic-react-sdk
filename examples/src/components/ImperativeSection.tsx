import { type ReactElement } from 'react';
import { useEzoic } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/**
 * Exercises the imperative {@link useEzoic} API directly: the command queue push,
 * showAds/displayMore/refreshAds/destroyPlaceholders/destroyAll, the A/B cohort
 * check, and the SPA toggle. All are queue-based no-ops until the bundle loads,
 * so they are safe to invoke on localhost.
 */
export function ImperativeSection(): ReactElement {
  const { log } = useEventLog();
  const {
    isReady,
    push,
    showAds,
    displayMore,
    destroyPlaceholders,
    destroyAll,
    refreshAds,
    isEzoicUser,
    setIsSinglePageApplication,
  } = useEzoic();

  const runPush = (): void => {
    push(() => log('push(): queued command executed'));
    log('push(): command queued on ezstandalone.cmd');
  };
  const runShowAds = (): void => {
    showAds(910, 912, 913);
    log('showAds(910, 912, 913)');
  };
  const runDisplayMore = (): void => {
    displayMore(924, 925);
    log('displayMore(924, 925)');
  };
  const runRefresh = (): void => {
    refreshAds(910, 912);
    log('refreshAds(910, 912)');
  };
  const runDestroyOne = (): void => {
    destroyPlaceholders(910);
    log('destroyPlaceholders(910)');
  };
  const runDestroyAll = (): void => {
    destroyAll();
    log('destroyAll()');
  };
  const runIsEzoicUser = (): void => {
    const result = isEzoicUser(100, (isUser) => log(`isEzoicUser callback -> ${String(isUser)}`));
    log(`isEzoicUser(100) -> ${String(result)}`);
  };
  const runSpaToggle = (): void => {
    setIsSinglePageApplication(true);
    log('setIsSinglePageApplication(true)');
  };

  return (
    <section className="section">
      <h2 className="section-title">Imperative SDK controls</h2>
      <p className="section-desc">
        The raw useEzoic() methods. These act on placeholders rendered elsewhere on this page — the
        display section owns ids 910, 912, 913 and the dynamic section owns 915–921 — so showAds/refreshAds/
        destroyPlaceholders here drive those slots, and destroyAll() clears every placeholder on the
        page. In a real app, avoid destroyAll()/destroyPlaceholders() on ids owned by mounted EzoicAd
        components — those manage their own lifecycle. isReady: <strong>{String(isReady)}</strong>{' '}
        (true once the provider wired the command queue — not that ads have loaded).
      </p>
      <div className="btn-row">
        <button className="btn" type="button" onClick={runPush}>
          push()
        </button>
        <button className="btn" type="button" onClick={runShowAds}>
          showAds()
        </button>
        <button className="btn" type="button" onClick={runDisplayMore}>
          displayMore()
        </button>
        <button className="btn" type="button" onClick={runRefresh}>
          refreshAds()
        </button>
        <button className="btn" type="button" onClick={runDestroyOne}>
          destroyPlaceholders()
        </button>
        <button className="btn" type="button" onClick={runDestroyAll}>
          destroyAll()
        </button>
        <button className="btn" type="button" onClick={runIsEzoicUser}>
          isEzoicUser()
        </button>
        <button className="btn" type="button" onClick={runSpaToggle}>
          setIsSinglePageApplication()
        </button>
      </div>
    </section>
  );
}
