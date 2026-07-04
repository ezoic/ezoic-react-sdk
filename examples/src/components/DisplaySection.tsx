import { type ReactElement } from 'react';
import { EzoicAd } from '@ezoic/react-sdk';

/**
 * Display ads identified by numeric placeholder id. These ids are in the
 * generated 900-range and carry no dashboard sizing, so every placement
 * passes explicit `sizes` with `required` — the canonical pairing. Each ad
 * lives in its own labeled wrapper; the placeholder div itself stays bare.
 */
export function DisplaySection(): ReactElement {
  return (
    <section className="section">
      <h2 className="section-title">Display ads — numeric ids</h2>
      <p className="section-desc">
        Generated ids have no dashboard sizing, so every placement passes explicit `sizes` with
        `required` — the canonical pairing.
      </p>
      <div className="ad-grid">
        <div className="ad-slot">
          <span className="ad-slot-label">id 910 · 300x250, 336x280</span>
          <EzoicAd id={910} sizes={['300x250', '336x280']} required />
        </div>
        <div className="ad-slot">
          <span className="ad-slot-label">id 912 · required · 300x250</span>
          <EzoicAd id={912} sizes={['300x250']} required />
        </div>
        <div className="ad-slot ad-slot--wide">
          <span className="ad-slot-label">id 913 · 728x90, 300x250</span>
          <EzoicAd id={913} sizes={['728x90', '300x250']} required />
        </div>
      </div>
    </section>
  );
}
