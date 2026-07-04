import { useState, type ReactElement } from 'react';
import { EzoicAd } from '@ezoic/react-sdk';
import { useEventLog } from '../eventLog';

/** Ids appended one per click, capped at 921. */
const DYNAMIC_IDS: readonly number[] = [915, 916, 917, 918, 919, 920, 921];

/**
 * Appends a new numeric `<EzoicAd>` per click (ids 915–921) — the infinite
 * scroll / "load more" pattern for dynamically added content. Each added unit
 * mounts on its own commit and is requested via `showAds`; the display section
 * above shows several ids coalescing into a single `showAds` call.
 */
export function DynamicSection(): ReactElement {
  const { log } = useEventLog();
  const [count, setCount] = useState(0);

  const atMax = count >= DYNAMIC_IDS.length;
  const shownIds = DYNAMIC_IDS.slice(0, count);

  const addUnit = (): void => {
    if (atMax) {
      log('Dynamic ads: reached max id (921).');
      return;
    }
    const id = DYNAMIC_IDS[count];
    setCount((c) => c + 1);
    log(`Dynamic ads: mounted <EzoicAd id={${id}} /> (requested via showAds).`);
  };

  return (
    <section className="section">
      <h2 className="section-title">Dynamic ad units</h2>
      <p className="section-desc">
        Each click appends a numeric EzoicAd (ids 915–921) — the infinite-scroll / load-more
        pattern. Newly mounted ids are requested as they appear.
      </p>
      <button className="btn" type="button" onClick={addUnit} disabled={atMax}>
        {atMax ? 'All units added' : 'Add ad unit'}
      </button>
      <div className="ad-grid">
        {shownIds.map((id) => (
          <div className="ad-slot" key={id}>
            <span className="ad-slot-label">id {id} · 300x250</span>
            <EzoicAd id={id} sizes={['300x250']} />
          </div>
        ))}
      </div>
    </section>
  );
}
