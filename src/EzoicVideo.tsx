import { useEffect, useRef, useState, type ReactElement } from 'react';
import { acquireVideo, releaseVideo } from './video';
import { useEzoic } from './EzoicProvider';

/** Props for {@link EzoicVideo}. */
export interface EzoicVideoProps {
  /** Publisher-chosen video container div id (e.g. `"my-video-slot"`). */
  divId: string;
  /** Optional class name applied to the container div. */
  className?: string;
  /** Optional inline styles applied to the container div. */
  style?: React.CSSProperties;
}

/**
 * Renders an Ezoic video placeholder as a bare `<div id={divId}>` and loads it
 * via `ezstandalone.displayMoreVideo` (which registers AND requests ad code).
 *
 * Every `<EzoicVideo>` that mounts in the same React commit is coalesced into a
 * single `displayMoreVideo(...divIds)` call. `displayMoreVideo` appends to the
 * bundle's video registry without clobbering it, so same-tick mounts share one
 * call and later mounts add ids safely. On unmount the placeholder is torn down
 * with `destroyVideoPlaceholders(divId)`.
 *
 * Unlike `<EzoicAd>`, the container div MAY be styled: video placeholders are
 * publisher-chosen divs (not `ezoic-pub-ad-placeholder-*`), so `className` and
 * `style` are applied to it.
 *
 * Must be rendered inside an {@link EzoicProvider}. The effect keys on `divId`:
 * changing `divId` tears down the old placeholder and loads the new one. To
 * reset other semantics, remount with a new React `key`.
 *
 * @example
 * ```tsx
 * <EzoicProvider>
 *   <EzoicVideo divId="my-video-slot" />
 *   <EzoicVideo divId="sidebar-video" style={{ minHeight: 240 }} />
 * </EzoicProvider>
 * ```
 */
export function EzoicVideo({ divId, className, style }: EzoicVideoProps): ReactElement | null {
  // Enforce that an <EzoicProvider> is present (throws otherwise).
  useEzoic();

  // Tracks whether this instance owns its divId, so a duplicate (which does not
  // own it) never tears down the real placeholder on unmount.
  const ownsRef = useRef(false);

  // A duplicate of an already-mounted divId must not render a second div with
  // the same id. The div renders by default (so it is present in server-rendered
  // HTML) and the client suppresses it once the effect detects the duplicate.
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const acquired = acquireVideo(divId);
    if (cancelled) {
      // Extremely rare (StrictMode double-invoke ordering); release if we won.
      if (acquired) releaseVideo(divId);
      return;
    }
    ownsRef.current = acquired;
    setSuppressed(!acquired);

    return () => {
      cancelled = true;
      if (ownsRef.current) {
        releaseVideo(divId);
      }
      ownsRef.current = false;
    };
  }, [divId]);

  if (suppressed) return null;
  return <div id={divId} className={className} style={style} />;
}
