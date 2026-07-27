import { type ReactElement } from 'react';
import { EzoicAd } from '@ezoic/react-sdk';

/**
 * Display ads identified by numeric placeholder id. `sizes` is optional —
 * Ezoic optimizes ad sizes automatically when it is omitted. This demo passes
 * explicit `sizes` with `required` to show the constrained form. Each ad
 * lives in its own labeled wrapper; the placeholder div itself stays bare.
 */
export function DisplaySection(): ReactElement {
  return (
    <section className="section">
      <h2 className="section-title">Display ads — numeric ids</h2>
      <p className="section-desc">
        `sizes` is optional — omit it to let Ezoic optimize ad sizes automatically. This demo
        passes explicit `sizes` with `required` to restrict which sizes may serve.
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
