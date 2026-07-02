import { useEffect, useRef, useState, type ReactElement } from 'react';
import { acquirePlaceholder, releasePlaceholder } from './adManager';
import { isValidPlaceholderId, placeholderDomId } from './placeholders';
import { useEzoic } from './EzoicProvider';

/** Matches a single `"WxH"` ad size such as `"728x90"`. */
const SIZE_PATTERN = /^\d+x\d+$/;

/** Props for {@link EzoicAd}. */
export interface EzoicAdProps {
  /**
   * Display placeholder id — an integer in the inclusive range 1–999. An
   * invalid id renders nothing and logs an error; it never throws (a bad id must
   * not crash the host page).
   */
  id: number;
  /** When `true`, requests the slot as required demand (`showAds` object form). */
  required?: boolean;
  /**
   * Requested creative sizes, each `"WxH"` (e.g. `"728x90"`). Entries that do
   * not match are dropped with a warning. Read once when the placeholder is
   * first shown — see the note on {@link EzoicAd} about changing props.
   */
  sizes?: string[];
}

/** Drops sizes that are not `"WxH"`, warning on each; returns `undefined` if none remain. */
function normalizeSizes(sizes: string[] | undefined, id: number): string[] | undefined {
  if (!sizes || sizes.length === 0) return undefined;
  const valid: string[] = [];
  for (const size of sizes) {
    if (typeof size === 'string' && SIZE_PATTERN.test(size)) {
      valid.push(size);
    } else {
      console.warn(
        `[ezoic/react-sdk] Ignoring invalid ad size ${JSON.stringify(size)} for ` +
          `placeholder ${id}; expected "WxH" like "728x90".`,
      );
    }
  }
  return valid.length > 0 ? valid : undefined;
}

/**
 * Renders a single Ezoic display placeholder as a bare
 * `<div id="ezoic-pub-ad-placeholder-<id>">` and requests it via `showAds`.
 *
 * Every `<EzoicAd>` that mounts in the same React commit is coalesced into one
 * `showAds` call, so a page full of placeholders makes a single ad request. On
 * unmount the placeholder is torn down with `destroyPlaceholders(id)`.
 *
 * The div carries no styling of its own — Ezoic manages the placeholder's
 * dimensions, and adding styles violates the integration contract. Wrap
 * `<EzoicAd>` in your own element if you need layout around it.
 *
 * Must be rendered inside an {@link EzoicProvider}. `id` identifies the slot;
 * `required`/`sizes` are read when the slot is first shown, so changing them
 * later does not re-request the ad. To apply new config, remount with a new
 * React `key`.
 *
 * @example
 * ```tsx
 * <EzoicProvider>
 *   <EzoicAd id={101} />
 *   <EzoicAd id={102} required sizes={['728x90', '970x250']} />
 * </EzoicProvider>
 * ```
 */
export function EzoicAd({ id, required, sizes }: EzoicAdProps): ReactElement | null {
  // Enforce that an <EzoicProvider> is present (throws otherwise). Also keeps the
  // provider mounted as long as any ad is on the page.
  useEzoic();

  // Latest config, read at acquire time so an unstable inline `sizes`/`required`
  // prop never re-runs the effect and churns (destroy + re-show) the ad.
  const configRef = useRef<{ required?: boolean; sizes?: string[] }>({ required, sizes });
  configRef.current = { required, sizes };

  // Tracks whether this instance owns the id, so a duplicate (which does not own
  // it) never tears down the real placeholder on unmount.
  const ownsRef = useRef(false);

  // A duplicate of an already-mounted id must not render a second div with the
  // same id. The div renders by default (so it is present in server-rendered
  // HTML); the client suppresses it once the effect detects the duplicate.
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    if (!isValidPlaceholderId(id)) {
      console.error(
        `[ezoic/react-sdk] Invalid <EzoicAd id={${String(id)}} />: expected an ` +
          `integer between 1 and 999. The placeholder was not rendered.`,
      );
      return;
    }
    const { required: cfgRequired, sizes: cfgSizes } = configRef.current;
    const acquired = acquirePlaceholder({
      id,
      required: cfgRequired,
      sizes: normalizeSizes(cfgSizes, id),
    });
    ownsRef.current = acquired;
    setSuppressed(!acquired);
    return () => {
      if (ownsRef.current) {
        releasePlaceholder(id);
        ownsRef.current = false;
      }
    };
  }, [id]);

  if (!isValidPlaceholderId(id) || suppressed) return null;
  return <div id={placeholderDomId(id)} />;
}
