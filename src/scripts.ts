import type { EzoicWindow } from './types';

/**
 * Gatekeeper consent (CMP) loader. Injected first so consent is resolved before
 * ads request. See https://docs.ezoic.com/docs/ezoicads/integration/.
 */
export const CMP_SCRIPT_URL_1 = 'https://cmp.gatekeeperconsent.com/min.js';

/** Second Gatekeeper consent (CMP) script, injected immediately after the first. */
export const CMP_SCRIPT_URL_2 = 'https://the.gatekeeperconsent.com/cmp.min.js';

/** The Ezoic standalone bundle. Loaded `async` after the CMP scripts and stub. */
export const SA_SCRIPT_URL = 'https://www.ezojs.com/ezoic/sa.min.js';

/** Marks a `<script>` element the SDK injected, so injection stays idempotent. */
const MARKER_ATTR = 'data-ezoic-sdk';

type ScriptMarker = 'cmp1' | 'cmp2' | 'cmd-stub' | 'sa' | 'analytics';

/** Options controlling which scripts {@link ensureEzoicScripts} injects. */
export interface EnsureEzoicScriptsOptions {
  /** Override the `sa.min.js` URL. Defaults to {@link SA_SCRIPT_URL}. */
  saScriptUrl?: string;
  /**
   * Override the two Gatekeeper CMP script URLs. Defaults to
   * {@link CMP_SCRIPT_URL_1} and {@link CMP_SCRIPT_URL_2}. Consent scripts are
   * always injected before `sa.min.js`; this only changes their URLs.
   */
  cmpScriptUrls?: readonly [string, string];
  /** Optional analytics script URL, injected last (after `sa.min.js`). */
  analyticsUrl?: string;
}

function getWindow(): EzoicWindow | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as EzoicWindow);
}

/**
 * Ensures `window.ezstandalone.cmd` exists as a queue. Idempotent and safe to
 * call before `sa.min.js` loads: commands queued here run once it initializes.
 */
function ensureCommandQueue(w: EzoicWindow): void {
  if (!w.ezstandalone) {
    w.ezstandalone = { cmd: [] };
  } else if (!w.ezstandalone.cmd) {
    w.ezstandalone.cmd = [];
  }
}

/**
 * Queues a command on `window.ezstandalone.cmd`, creating the stub queue first
 * if needed. No-op on the server (there is no `window`).
 *
 * The queue runs commands after `sa.min.js` initializes, so callers can push
 * before the provider has finished injecting scripts.
 */
export function pushToEzoicCmd(command: () => void): void {
  const w = getWindow();
  if (!w) return;
  ensureCommandQueue(w);
  w.ezstandalone!.cmd.push(command);
}

/** True when a script the SDK owns (by marker) or the same `src` is on the page. */
function externalScriptPresent(src: string, marker: ScriptMarker): boolean {
  const scripts = document.getElementsByTagName('script');
  for (const script of Array.from(scripts)) {
    if (script.getAttribute(MARKER_ATTR) === marker) return true;
    // `script.src` resolves to an absolute URL; the SDK's URLs are absolute.
    if (script.src === src) return true;
  }
  return false;
}

/** True when a cmd-queue stub exists — ours, a host stub, or a loaded bundle. */
function stubPresent(w: EzoicWindow): boolean {
  if (document.querySelector(`script[${MARKER_ATTR}="cmd-stub"]`)) return true;
  return Boolean(w.ezstandalone && w.ezstandalone.cmd);
}

/**
 * Builds an external `<script>`. `data-cfasync="false"` is set BEFORE `src` so
 * Cloudflare Rocket Loader cannot defer or reorder the consent scripts, which
 * Ezoic's integration requires.
 */
function createExternalScript(
  src: string,
  marker: ScriptMarker,
  opts: { async?: boolean; cfasync?: boolean },
): HTMLScriptElement {
  const script = document.createElement('script');
  if (opts.cfasync) script.setAttribute('data-cfasync', 'false');
  script.setAttribute('src', src);
  if (opts.async) script.setAttribute('async', '');
  script.setAttribute(MARKER_ATTR, marker);
  return script;
}

/** Builds the inline cmd-queue stub `<script>` (the canonical pre-load guard). */
function createStubScript(): HTMLScriptElement {
  const script = document.createElement('script');
  script.setAttribute(MARKER_ATTR, 'cmd-stub');
  script.textContent =
    'window.ezstandalone = window.ezstandalone || {}; ' +
    'window.ezstandalone.cmd = window.ezstandalone.cmd || [];';
  return script;
}

/**
 * Injects the Ezoic script chain in the required order, exactly once:
 *
 * 1. Gatekeeper CMP `min.js` (`data-cfasync="false"`)
 * 2. Gatekeeper CMP `cmp.min.js` (`data-cfasync="false"`)
 * 3. inline `ezstandalone.cmd` stub
 * 4. `sa.min.js` (`async`)
 * 5. optional analytics script
 *
 * Idempotent: each step is skipped when the SDK already injected it or when the
 * same script already exists in the host HTML. No-op on the server (guards on
 * `document`). Scripts are appended to `<head>` (falling back to
 * `documentElement`).
 */
export function ensureEzoicScripts(options: EnsureEzoicScriptsOptions = {}): void {
  const w = getWindow();
  if (!w || typeof document === 'undefined') return;

  const [cmp1, cmp2] = options.cmpScriptUrls ?? [CMP_SCRIPT_URL_1, CMP_SCRIPT_URL_2];
  const saUrl = options.saScriptUrl ?? SA_SCRIPT_URL;
  const target = document.head ?? document.documentElement;

  if (!externalScriptPresent(cmp1, 'cmp1')) {
    target.appendChild(createExternalScript(cmp1, 'cmp1', { cfasync: true }));
  }
  if (!externalScriptPresent(cmp2, 'cmp2')) {
    target.appendChild(createExternalScript(cmp2, 'cmp2', { cfasync: true }));
  }

  // Decide whether a stub already exists BEFORE creating the queue object,
  // otherwise the queue we create would make stubPresent always true and the
  // stub node would never be injected.
  const hadStub = stubPresent(w);
  // Ensure the queue object exists synchronously (the injected inline stub is
  // not executed by some test DOMs), then add the stub node for real browsers
  // and script-order fidelity.
  ensureCommandQueue(w);
  if (!hadStub) {
    target.appendChild(createStubScript());
  }

  if (!externalScriptPresent(saUrl, 'sa')) {
    target.appendChild(createExternalScript(saUrl, 'sa', { async: true }));
  }

  if (options.analyticsUrl && !externalScriptPresent(options.analyticsUrl, 'analytics')) {
    target.appendChild(createExternalScript(options.analyticsUrl, 'analytics', { async: true }));
  }
}
