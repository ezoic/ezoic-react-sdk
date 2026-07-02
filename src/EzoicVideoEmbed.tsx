import { useEffect, useRef, type ReactElement } from 'react';
import { OPEN_VIDEO_SCRIPT_URL, ensureOpenVideoScript, pushOpenVideoPlayer } from './openVideo';

/** Props for {@link EzoicVideoEmbed}. */
export interface EzoicVideoEmbedProps {
  /** Open Video content id (the primary content key). */
  videoId: string;
  /** Opt the player into floating behavior. */
  float?: boolean;
  /** Override the Open Video script URL. Defaults to {@link OPEN_VIDEO_SCRIPT_URL}. */
  scriptUrl?: string;
  /** Optional id applied to the container div. */
  id?: string;
  /** Optional class name applied to the container div. */
  className?: string;
  /** Optional inline styles applied to the container div. */
  style?: React.CSSProperties;
}

/**
 * Embeds an Open Video (open.video) player. Injects `https://open.video/video.js`
 * once (idempotent) and pushes a player entry onto `window.openVideoPlayers`
 * targeting this component's container div.
 *
 * Independent of `ezstandalone` — this does NOT require an {@link EzoicProvider}.
 * The container div MAY be styled (`id`, `className`, `style` are applied).
 *
 * Mount-once semantics: `videoId`, `float`, and `scriptUrl` are read on mount
 * only. To play a different video, remount with a new React `key`. There is no
 * teardown — the platform dedupes an already-processed target element, and a
 * StrictMode remount pushes the new live element.
 *
 * SSR-safe: renders the div without touching `window`; the push happens in an
 * effect, which never runs on the server.
 *
 * @example
 * ```tsx
 * <EzoicVideoEmbed videoId="YOUR_VIDEO_ID" float />
 * ```
 */
export function EzoicVideoEmbed({
  videoId,
  float,
  scriptUrl,
  id,
  className,
  style,
}: EzoicVideoEmbedProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Snapshot the mount-once config so the effect deps can be [] honestly.
  const configRef = useRef({ videoId, float, scriptUrl });
  configRef.current = { videoId, float, scriptUrl };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const { videoId: vid, float: fl, scriptUrl: url } = configRef.current;
    ensureOpenVideoScript(url ?? OPEN_VIDEO_SCRIPT_URL);
    pushOpenVideoPlayer({ target: el, videoID: vid, float: fl });
  }, []);

  return <div ref={containerRef} id={id} className={className} style={style} />;
}
