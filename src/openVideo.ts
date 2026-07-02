import type { OpenVideoPlayerEntry, EzoicWindow } from './types';

// ---------------------------------------------------------------------------
// Open Video embeds (open.video).
//
// Open Video is a video platform independent of `ezstandalone`. Embedding a
// player is two steps: inject `open.video/video.js` once, and push a player
// entry onto `window.openVideoPlayers`. Before the script loads that global is
// a plain array; after load the platform REPLACES it with a live handler object
// that drains pushes. The global must therefore only ever be guard-initialized
// (`= x || []`) and NEVER reset to a fresh array — a reset would clobber the
// live handler and drop every push. See {@link OpenVideoPlayerEntry}.
// ---------------------------------------------------------------------------

/** The Open Video player script. Injected once by {@link ensureOpenVideoScript}. */
export const OPEN_VIDEO_SCRIPT_URL = 'https://open.video/video.js';

/** Marks a `<script>` the SDK injected, so Open Video injection stays idempotent. */
const MARKER_ATTR = 'data-ezoic-sdk';

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

/**
 * Seeds `window.openVideoPlayers` as an empty array only when it is falsy.
 *
 * Guard-only by design: if the platform has already replaced the global with
 * its live handler object (or another push is already queued), this leaves it
 * untouched. It must never reset the global to a fresh array.
 */
function ensureOpenVideoQueue(w: EzoicWindow): void {
  w.openVideoPlayers = w.openVideoPlayers || [];
}

/** Extracts the pathname from an absolute URL, or `null` if it cannot be parsed. */
function urlPathname(url: string): string | null {
  try {
    return new URL(url).pathname;
  } catch {
    return null;
  }
}

/**
 * True when an Open Video script is already on the page — either one the SDK
 * marked, or any script whose URL path matches. Matching by path (not the full
 * URL) means a host-injected script carrying cache-buster query params is still
 * recognized, so the SDK never adds a second copy.
 */
function openVideoScriptPresent(scriptUrl: string): boolean {
  if (document.querySelector(`script[${MARKER_ATTR}="open-video"]`)) return true;
  const wantedPath = urlPathname(scriptUrl);
  for (const script of Array.from(document.getElementsByTagName('script'))) {
    if (!script.src) continue;
    if (script.src === scriptUrl) return true;
    if (wantedPath && urlPathname(script.src) === wantedPath) return true;
  }
  return false;
}

/**
 * Injects the Open Video player script exactly once and seeds the
 * `window.openVideoPlayers` queue so pushes made before the script loads are
 * captured.
 *
 * Idempotent: skips injection when the SDK already added the script or the same
 * path exists in the host HTML (dedup by path, so a cache-buster query still
 * matches). No-op on the server (guards on `document`). The script is appended
 * to `<head>` (falling back to `documentElement`).
 *
 * The queue is only guard-initialized (`= x || []`); this never resets the
 * global, so a live handler installed by an already-loaded `video.js` is
 * preserved.
 *
 * @param scriptUrl Full URL of the Open Video script. Defaults to
 *   {@link OPEN_VIDEO_SCRIPT_URL}.
 */
export function ensureOpenVideoScript(scriptUrl: string = OPEN_VIDEO_SCRIPT_URL): void {
  const w = getWindow();
  if (!w || typeof document === 'undefined') return;
  if (!scriptUrl) return;

  // Seed the queue synchronously so pushes before the script loads are captured.
  ensureOpenVideoQueue(w);

  if (!openVideoScriptPresent(scriptUrl)) {
    const target = document.head ?? document.documentElement;
    const script = document.createElement('script');
    script.setAttribute('src', scriptUrl);
    script.setAttribute('async', '');
    script.setAttribute(MARKER_ATTR, 'open-video');
    target.appendChild(script);
  }
}

/**
 * Pushes an Open Video player entry onto `window.openVideoPlayers`. The platform
 * (or the seeded array) drains it once `video.js` has loaded. No-op on the
 * server.
 *
 * The queue is guard-initialized before the push and never reset, so a push
 * routed through the platform's live handler still reaches it.
 */
export function pushOpenVideoPlayer(entry: OpenVideoPlayerEntry): void {
  const w = getWindow();
  if (!w) return;
  ensureOpenVideoQueue(w);
  w.openVideoPlayers!.push(entry);
}
