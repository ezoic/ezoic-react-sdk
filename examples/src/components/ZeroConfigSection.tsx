import { type ReactElement } from 'react';
import { EzoicAd } from '@ezoic/react-sdk';

/**
 * Zero-config placements identified by semantic `location`. These resolve to a
 * reserved 900-range id at runtime, default `required: true`, and have no
 * dashboard-configured sizing — so explicit `sizes` must always be passed.
 */
export function ZeroConfigSection(): ReactElement {
  return (
    <section className="section">
      <h2 className="section-title">Zero-config placements — location</h2>
      <p className="section-desc">
        Location placements default to required and carry no dashboard sizing, so they must be given
        explicit sizes.
      </p>
      <div className="ad-grid">
        <div className="ad-slot ad-slot--wide">
          <span className="ad-slot-label">top_of_page · 728x90, 320x50</span>
          <EzoicAd location="top_of_page" sizes={['728x90', '320x50']} />
        </div>
        <div className="ad-slot ad-slot--wide">
          <span className="ad-slot-label">under_first_paragraph · 728x90, 300x250</span>
          <EzoicAd location="under_first_paragraph" sizes={['728x90', '300x250']} />
        </div>
        <div className="ad-slot">
          <span className="ad-slot-label">mid_content · 300x250</span>
          <EzoicAd location="mid_content" sizes={['300x250']} />
        </div>
      </div>
    </section>
  );
}
