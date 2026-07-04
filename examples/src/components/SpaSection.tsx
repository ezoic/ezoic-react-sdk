import { useState, type ReactElement } from 'react';
import { EzoicAd, useEzoicPageView } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

type RouteKey = 'home' | 'article' | 'gallery';

const ROUTES: readonly RouteKey[] = ['home', 'article', 'gallery'];

// Ids owned exclusively by this section (distinct from every other section) so
// they persist across simulated routes. Because these <EzoicAd> components never
// unmount on navigation, useEzoicPageView is the sole driver of the per-route
// teardown + reload — there is no double-fire with EzoicAd's own mount/unmount.
const SPA_IDS: readonly number[] = [922, 923];

/**
 * Simulates single-page-application navigation without a real router. The ad
 * units persist across routes; changing `route` drives useEzoicPageView, which
 * tears the ids down and requests them again as a new page view. This is the
 * documented pattern for forcing a new-pageview reload when the same EzoicAd
 * ids persist across routes.
 */
export function SpaSection(): ReactElement {
  const { log } = useEventLog();
  const [route, setRoute] = useState<RouteKey>('home');

  useEzoicPageView(route, { ids: [...SPA_IDS] });

  const go = (next: RouteKey): void => {
    if (next === route) return;
    log(`SPA: ${route} -> ${next} (useEzoicPageView reloads ids ${SPA_IDS.join(', ')}).`);
    setRoute(next);
  };

  return (
    <section className="section">
      <h2 className="section-title">SPA routing</h2>
      <p className="section-desc">
        Simulated navigation — no real router. These ad units persist across routes; changing route
        drives useEzoicPageView, which tears them down and reloads them as a new page view.
      </p>
      <div className="btn-row">
        {ROUTES.map((key) => (
          <button
            key={key}
            type="button"
            className={key === route ? 'btn btn-active' : 'btn'}
            onClick={() => go(key)}
          >
            {key}
          </button>
        ))}
      </div>
      <p className="section-desc">
        Current route: <strong>{route}</strong>
      </p>
      <div className="ad-grid">
        {SPA_IDS.map((id) => (
          <div className="ad-slot" key={id}>
            <span className="ad-slot-label">id {id} · 300x250</span>
            <EzoicAd id={id} sizes={['300x250']} />
          </div>
        ))}
      </div>
    </section>
  );
}
