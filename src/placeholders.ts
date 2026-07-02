/**
 * DOM id prefix that the Ezoic standalone script scans for. A display
 * placeholder div must use the id `ezoic-pub-ad-placeholder-<id>` and carry no
 * styling of its own.
 */
export const EZOIC_PLACEHOLDER_PREFIX = 'ezoic-pub-ad-placeholder-';

/** Lowest display placeholder id the standalone script scans for (inclusive). */
export const MIN_PLACEHOLDER_ID = 1;

/** Highest display placeholder id the standalone script scans for (inclusive). */
export const MAX_PLACEHOLDER_ID = 999;

/**
 * Type guard for a display placeholder id the Ezoic standalone script will
 * discover: an integer in the inclusive range 1–999.
 *
 * The zero-config semantic range (900–999) is a subset of 1–999 and therefore
 * also valid. Ids above 999 can only be created dynamically and are not part of
 * the normal scan range, so they are rejected here.
 */
export function isValidPlaceholderId(id: unknown): id is number {
  return (
    typeof id === 'number' &&
    Number.isInteger(id) &&
    id >= MIN_PLACEHOLDER_ID &&
    id <= MAX_PLACEHOLDER_ID
  );
}

/**
 * Builds the DOM id for a display placeholder div.
 *
 * @example
 * placeholderDomId(101); // "ezoic-pub-ad-placeholder-101"
 *
 * @throws RangeError when `id` is not an integer in the range 1–999.
 */
export function placeholderDomId(id: number): string {
  if (!isValidPlaceholderId(id)) {
    throw new RangeError(
      `Invalid Ezoic placeholder id: ${String(id)}. Expected an integer between ` +
        `${MIN_PLACEHOLDER_ID} and ${MAX_PLACEHOLDER_ID}.`,
    );
  }
  return `${EZOIC_PLACEHOLDER_PREFIX}${id}`;
}
