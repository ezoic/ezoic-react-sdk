import { type CSSProperties, type ReactElement } from 'react';
import { EzoicVideo, EzoicVideoEmbed } from '@ezoic/react-sdk';

/** Container styling is allowed for video placeholders (unlike display placeholders). */
const videoStyle: CSSProperties = { minHeight: 240 };

/**
 * Ezoic video. `<EzoicVideo>` renders an outstream/instream placeholder driven by
 * the provider; `<EzoicVideoEmbed>` embeds an Open Video (open.video) player and
 * is independent of the provider. Both container divs MAY be styled.
 */
export function VideoSection(): ReactElement {
  return (
    <section className="section">
      <h2 className="section-title">Video</h2>
      <div className="video-block">
        <h3 className="video-title">EzoicVideo — outstream / instream</h3>
        <p className="section-desc">
          Provider-driven video placeholder. Its container div may carry layout styles.
        </p>
        <EzoicVideo divId="ezoic-video-demo" style={videoStyle} />
      </div>
      <div className="video-block">
        <h3 className="video-title">EzoicVideoEmbed — Open Video</h3>
        <p className="section-desc">
          Replace <code>videoId</code> with your Open Video content id from the dashboard.
        </p>
        <EzoicVideoEmbed videoId="YOUR_OPEN_VIDEO_ID" float />
      </div>
    </section>
  );
}
