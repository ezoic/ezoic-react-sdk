import { useEffect, useRef, useState, type ReactElement } from 'react';
import { acquirePlaceholder, isPlaceholderOwned, releasePlaceholder } from './adManager';
import { EZOIC_PLACEHOLDER_PREFIX, isValidPlaceholderId, placeholderDomId } from './placeholders';
import { resolveGeneratedId } from './generatedId';
import { isKnownLocation, type EzoicLocation } from './locations';
import { useEzoic } from './EzoicProvider';

/** Matches a single `"WxH"` ad size such as `"728x90"`. */
const SIZE_PATTERN = /^\d+x\d+$/;

/** Display config shared by both ways of identifying an {@link EzoicAd} slot. */
interface EzoicAdConfig {
  /** When `true`, requests the slot as required demand (`showAds` object form). */
  required?: boolean;
  /**
   * Requested creative sizes, each `"WxH"` (e.g. `"728x90"`). Entries that do
   * not match are dropped with a warning. Read once when the placeholder is
   * first shown — see the note on {@link EzoicAd} about changing props.
   */
  sizes?: string[];
}

/**
 * Props for {@link EzoicAd}. Identify the slot EITHER by numeric `id` (1–999) OR
 * by semantic `location` (zero-config, resolved to a reserved 900-range id at
 * runtime) — providing both, or neither, renders nothing and logs an error.
 */
export type EzoicAdProps =
  | (EzoicAdConfig & {
      /**
       * Display placeholder id — an integer 1–999. An invalid id renders nothing
       * and logs an error; it never throws (a bad id must not crash the page).
       */
      id: number;
      location?: never;
    })
  | (EzoicAdConfig & {
      /**
       * Semantic placement name (e.g. `"under_first_paragraph"`, `"top_of_page"`)
       * or a documented alias. Resolved to a reserved 900-range id via
       * `ezstandalone.GetGeneratedIdAsync` when the bundle is loaded, otherwise
       * from the static id→location map. An unknown name renders nothing and
       * logs an error.
       */
      location: EzoicLocation;
      id?: never;
    });

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
 * Identify the slot by numeric `id` (1–999) or by semantic `location`
 * (zero-config). A numeric placeholder renders synchronously (so it appears in
 * server-rendered HTML); a `location` placeholder resolves its id at runtime and
 * renders once resolved, since the id is only known on the client.
 *
 * Every numeric `<EzoicAd>` that mounts in the same React commit is coalesced
 * into one `showAds` call. On unmount the placeholder is torn down with
 * `destroyPlaceholders(id)`.
 *
 * The div carries no styling of its own — Ezoic manages the placeholder's
 * dimensions, and adding styles violates the integration contract. Wrap
 * `<EzoicAd>` in your own element if you need layout around it.
 *
 * Must be rendered inside an {@link EzoicProvider}. `required`/`sizes` are read
 * when the slot is first shown, so changing them later does not re-request the
 * ad. To apply new config, remount with a new React `key`.
 *
 * A `location=` placement defaults `required` to `true` (pass `required={false}`
 * to opt out) and should always be given explicit `sizes`, since zero-config
 * placeholders have no dashboard-configured sizing. A numeric `id` placement is
 * dashboard-configured, so `sizes` is optional there.
 *
 * @example
 * ```tsx
 * <EzoicProvider>
 *   <EzoicAd id={101} />
 *   <EzoicAd id={102} required sizes={['728x90', '970x250']} />
 *   <EzoicAd location="under_first_paragraph" sizes={['728x90', '320x50']} />
 * </EzoicProvider>
 * ```
 */
export function EzoicAd(props: EzoicAdProps): ReactElement | null {
  // Enforce that an <EzoicProvider> is present (throws otherwise). Also keeps the
  // provider mounted as long as any ad is on the page.
  useEzoic();

  const { id, location, required, sizes } = props as EzoicAdConfig & {
    id?: number;
    location?: EzoicLocation;
  };

  // Latest config, read at acquire time so an unstable inline `sizes`/`required`
  // prop never re-runs the effect and churns (destroy + re-show) the ad.
  const configRef = useRef<EzoicAdConfig>({ required, sizes });
  configRef.current = { required, sizes };

  // Tracks whether this instance owns its id, and which id it acquired (for the
  // location path the id is only known after async resolution), so a duplicate
  // (which does not own it) never tears down the real placeholder on unmount.
  const ownsRef = useRef(false);
  const acquiredIdRef = useRef<number | null>(null);

  // The resolved id whose div the location path renders once known. Numeric ads
  // render their div synchronously and do not depend on this.
  const [resolvedId, setResolvedId] = useState<number | null>(null);

  // A duplicate of an already-mounted id must not render a second div with the
  // same id. For numeric ads the div renders by default (so it is present in
  // server-rendered HTML) and the client suppresses it once the effect detects
  // the duplicate.
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const acquire = (effId: number, isLocation: boolean): void => {
      if (cancelled) return;
      const { required: cfgRequired, sizes: cfgSizes } = configRef.current;
      // Zero-config `location=` placeholders are only treated as zero-config by
      // the ad server when required AND id >= 900, so default required to true
      // here; numeric `id` placements are unaffected (undefined stays undefined).
      const effectiveRequired = isLocation ? (cfgRequired ?? true) : cfgRequired;
      const normalizedSizes = normalizeSizes(cfgSizes, effId);
      const providedNoSizes = cfgSizes === undefined || cfgSizes.length === 0;
      if (isLocation && providedNoSizes) {
        console.warn(
          `[ezoic/react-sdk] <EzoicAd location=${JSON.stringify(location)} /> was shown ` +
            'without `sizes`. Zero-config location placements have no dashboard-configured ' +
            "sizing, so they need explicit sizes (e.g. sizes={['728x90','320x50']}) to " +
            'create ad placements.',
        );
      }
      const acquired = acquirePlaceholder({
        id: effId,
        required: effectiveRequired,
        sizes: normalizedSizes,
      });
      ownsRef.current = acquired;
      acquiredIdRef.current = acquired ? effId : null;
      setResolvedId(acquired ? effId : null);
      setSuppressed(!acquired);
    };

    const idProvided = id !== undefined;
    const locProvided = location !== undefined;

    if (idProvided && locProvided) {
      console.error(
        '[ezoic/react-sdk] <EzoicAd> takes either `id` or `location`, not both. ' +
          'The placeholder was not rendered.',
      );
      return;
    }
    if (!idProvided && !locProvided) {
      console.error(
        '[ezoic/react-sdk] <EzoicAd> requires an `id` or a `location`. ' +
          'The placeholder was not rendered.',
      );
      return;
    }

    if (idProvided) {
      if (!isValidPlaceholderId(id)) {
        console.error(
          `[ezoic/react-sdk] Invalid <EzoicAd id={${String(id)}} />: expected an ` +
            `integer between 1 and 999. The placeholder was not rendered.`,
        );
        return;
      }
      acquire(id, false);
    } else {
      if (!isKnownLocation(location!)) {
        console.error(
          `[ezoic/react-sdk] Unknown <EzoicAd location=${JSON.stringify(location)} />: ` +
            `not a documented Ezoic location. The placeholder was not rendered.`,
        );
        return;
      }
      resolveGeneratedId(location!, isPlaceholderOwned)
        .then((effId) => acquire(effId, true))
        .catch((err: unknown) => {
          if (cancelled) return;
          console.error(
            `[ezoic/react-sdk] Could not resolve <EzoicAd location=${JSON.stringify(location)} />.`,
            err,
          );
        });
    }

    return () => {
      cancelled = true;
      if (ownsRef.current && acquiredIdRef.current !== null) {
        releasePlaceholder(acquiredIdRef.current);
      }
      ownsRef.current = false;
      acquiredIdRef.current = null;
    };
  }, [id, location]);

  // Numeric path renders its div synchronously (SSR-safe); the location path
  // renders once its id resolves on the client.
  let domId: string | null = null;
  if (id !== undefined && location === undefined && isValidPlaceholderId(id)) {
    domId = placeholderDomId(id);
  } else if (resolvedId !== null) {
    domId = `${EZOIC_PLACEHOLDER_PREFIX}${resolvedId}`;
  }
  if (domId === null || suppressed) return null;
  return <div id={domId} />;
}
