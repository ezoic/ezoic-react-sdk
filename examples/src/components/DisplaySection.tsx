import { type ReactElement } from 'react';
import { EzoicAd } from '@ezoic/react-sdk';

/**
 * Display ads identified by numeric placeholder id. Numeric ids (1–999) are
 * configured in the Ezoic dashboard, so `sizes` is optional for them. Each ad
 * lives in its own labeled wrapper; the placeholder div itself stays bare.
 */
export function DisplaySection(): ReactElement {
  return (
    <section className="section">
      <h2 className="section-title">Display ads — numeric ids</h2>
      <p className="section-desc">
        Numeric placeholder ids are dashboard-configured. Sizes are optional here; the dashboard
        supplies sizing per id.
      </p>
      <div className="ad-grid">
        <div className="ad-slot">
          <span className="ad-slot-label">id 910</span>
          <EzoicAd id={910} />
        </div>
        <div className="ad-slot">
          <span className="ad-slot-label">id 912 · required · 300x250</span>
          <EzoicAd id={912} sizes={['300x250']} required />
        </div>
        <div className="ad-slot">
          <span className="ad-slot-label">id 913</span>
          <EzoicAd id={913} />
        </div>
      </div>
    </section>
  );
}
