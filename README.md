# @ezoic/react-sdk

[![CI](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

The official [Ezoic](https://www.ezoic.com) SDK for React. It wraps the Ezoic
standalone ad integration so a React app can manage consent scripts, display ad
placeholders, single-page-app navigation, rewarded ads, and video without
hand-writing the raw snippets.

> **Pre-1.0 / under active development.** The public API is still being built
> out and may change before `1.0.0`. This release ships the package foundation,
> `<EzoicProvider>` for consent + script management, the `<EzoicAd>` display
> component with batched `showAds` and the `useEzoic()` ad-serving passthroughs,
> single-page-app routing (`useEzoicPageView`), and zero-config location
> placements (`<EzoicAd location="…" />`). Rewarded ads and video land in
> subsequent releases (see
> [Roadmap](#roadmap)). Follow
> [Ezoic Ads integration docs](https://docs.ezoic.com/docs/ezoicads/integration/)
> for the underlying behavior.

## Requirements

- React 18 or newer (declared as a peer dependency)

## Install

```sh
npm install @ezoic/react-sdk
```

`react` and `react-dom` are peer dependencies and must already be installed in
your app.

## Quickstart

Wrap your app once in `<EzoicProvider>`, drop an `<EzoicAd>` where you want an
ad, done.

```tsx
import { EzoicProvider, EzoicAd } from '@ezoic/react-sdk';

export default function App() {
  return (
    <EzoicProvider>
      <h1>My site</h1>
      {/* Recommended: pass sizes + required on every placement. */}
      <EzoicAd id={101} sizes={['728x90', '300x250']} required />
    </EzoicProvider>
  );
}
```

See [Usage](#usage) below for SPA routing, zero-config placements, consent,
rewarded, and video.

## Usage

### Provider setup

Wrap your app (or the subtree that shows ads) in a single `<EzoicProvider>`. It
injects the required scripts once, in the order Ezoic requires — the Gatekeeper
consent (CMP) scripts first, then the `ezstandalone.cmd` queue stub, then the
async `sa.min.js` bundle. Injection runs in an effect, so it is safe under
server-side rendering and the Next.js app router (it never touches `window`
during render). It is idempotent: it will not double-inject, and it tolerates
scripts already present in your host HTML.

By default the provider also marks the page as a single-page application at boot
(`setIsSinglePageApplication(true)`), which is correct for React apps that
navigate client-side — see [Single-page-app routing](#single-page-app-routing).
Pass `singlePageApp={false}` only for a provider that renders on one page that
never navigates.

```tsx
import { EzoicProvider, useEzoic } from '@ezoic/react-sdk';

export default function App() {
  return (
    <EzoicProvider>
      <YourApp />
    </EzoicProvider>
  );
}
```

Queue commands against `ezstandalone` with the `push` helper from `useEzoic()`.
Commands are run after `sa.min.js` initializes, so it is safe to push before the
scripts finish loading:

```tsx
function ShowAdsOnMount() {
  const { push } = useEzoic();
  useEffect(() => {
    push(() => {
      // Runs after sa.min.js initializes. Prefer <EzoicAd> and the typed
      // passthroughs below; use `push` only for raw ezstandalone calls the SDK
      // does not wrap yet.
    });
  }, [push]);
  return null;
}
```

`isReady` becomes `true` once the provider has injected the scripts on the
client. It does **not** mean ads have rendered — pushed commands are queued
until the bundle initializes.

### Display ads

Render a display placeholder with `<EzoicAd id={101} />`. It outputs a bare
`<div id="ezoic-pub-ad-placeholder-101">` and requests the slot for you — no raw
snippets, no manual `showAds`.

```tsx
import { EzoicProvider, EzoicAd } from '@ezoic/react-sdk';

export default function Article() {
  return (
    <EzoicProvider>
      <EzoicAd id={101} />
      <p>…article content…</p>
      <EzoicAd id={102} required sizes={['728x90', '970x250']} />
    </EzoicProvider>
  );
}
```

Behavior:

- **One request per commit.** Every `<EzoicAd>` that mounts in the same React
  commit is coalesced into a single `showAds(...)` call, so a page full of
  placeholders makes one ad request (Ezoic adds its own debounce on top).
- **Cleanup on unmount.** Unmounting an `<EzoicAd>` calls
  `destroyPlaceholders(id)` so the slot is torn down.
- **`required` / `sizes` props** map to the `showAds` object form. `sizes`
  entries must be `"WxH"` (e.g. `"728x90"`); invalid entries are dropped with a
  warning. These are read once when the slot is first shown — to change them,
  remount with a new React `key`.
- **Never styled.** The placeholder div carries no styling of its own — Ezoic
  manages its dimensions. Wrap `<EzoicAd>` in your own element for layout.
- **Fail-safe id validation.** Ids must be integers 1–999. An invalid id logs an
  error and renders nothing; it never throws (a bad id must not crash the page).
- **Duplicate guard.** Mounting two `<EzoicAd>` with the same id renders a single
  div and warns; the duplicate is suppressed.

For imperative control, `useEzoic()` exposes typed passthroughs to the
`ezstandalone` API:

```tsx
function DynamicContent() {
  const { showAds, destroyPlaceholders, refreshAds } = useEzoic();
  // Reveal ads in newly loaded content (infinite scroll, etc.):
  showAds(201, 202);
  // Tear placeholders down / refresh existing slots:
  destroyPlaceholders(201);
  refreshAds(101);
  return null;
}
```

`showAds`, `displayMore`, `destroyPlaceholders`, `destroyAll`, `refreshAds`, and
`isEzoicUser` all queue onto the `ezstandalone.cmd` queue, so they are safe to
call before the bundle finishes loading. `isEzoicUser(percentage?, callback?)`
returns `boolean | undefined` — `undefined` until the bundle is loaded; pass a
callback to be notified once it resolves.

### Zero-config placements

Instead of picking numeric ids, name a semantic position and let Ezoic choose a
reserved id in the 900–999 range:

```tsx
import { EzoicProvider, EzoicAd } from '@ezoic/react-sdk';

export default function Article() {
  return (
    <EzoicProvider>
      <EzoicAd location="top_of_page" sizes={['728x90', '320x50']} />
      <p>…intro…</p>
      <EzoicAd location="under_first_paragraph" sizes={['728x90', '320x50']} />
      <p>…more content…</p>
      <EzoicAd location="mid_content" sizes={['300x250']} />
    </EzoicProvider>
  );
}
```

Behavior:

- **Runtime resolution.** When the bundle is loaded, the id is resolved with
  `ezstandalone.GetGeneratedIdAsync`, which allocates a free id on the page (so
  repeated locations get distinct ids). Until then the id is unknown, so a
  `location` placeholder renders once resolved on the client — it is not present
  in server-rendered HTML (use a numeric `id` for an SSR placeholder).
- **Static fallback.** If the bundle never loads, the SDK resolves the name from
  the documented id→location map so the placeholder still renders.
- **Documented names + aliases.** All names on the
  [Ezoic integration docs](https://docs.ezoic.com/docs/ezoicads/integration/) are
  supported — `top_of_page`, `under_first_paragraph`, `under_second_paragraph`,
  `mid_content`, the `sidebar_*` family, `incontent_5`…`incontent_88`, and
  aliases like `incontent_1`. An unknown name logs an error and renders nothing.
- **Either `id` or `location`.** Provide one, not both.
- **`required` defaults to `true` for `location=`.** The ad server only treats a
  placeholder as zero-config when its id is in the reserved range AND it is
  flagged `required`, so a `location` placement is sent as `required: true`
  unless you pass `required={false}` to opt out. Numeric `id` placements are
  unaffected — `required` stays optional and defaults to unset.
- **Always pass `sizes` for `location=`.** Zero-config placeholders have no
  dashboard-configured sizing, so the SDK warns (and the ad will not fill) if
  `sizes` is omitted. Numeric `id` placements are dashboard-configured, so
  `sizes` is optional there.

For custom containers you can resolve an id yourself with
`resolveGeneratedId(location)` (returns a promise), or use the pure
`resolveLocationIdFromMap(location)` and the exported `ID_TO_LOCATION` map.

### Single-page-app routing

In a single-page app, the browser never does a full page load between routes, so
Ezoic needs to know when a client-side navigation is a new pageview. Two things
handle this:

1. **Boot flag.** `<EzoicProvider>` calls `setIsSinglePageApplication(true)` at
   boot (unless you pass `singlePageApp={false}`). After that, the first
   `showAds` following a navigation reloads ads as a **new pageview** rather than
   appending to the previous one.
2. **Route-change hook.** `useEzoicPageView(pageKey, { ids })` tears down the
   departing route's placeholders and requests the new route's placeholders when
   `pageKey` changes.

Pass any value that is stable within a page and changes on navigation — a router
pathname or route key. On the **first** render the hook only records a baseline
and fires nothing (the initial page's ads load via `<EzoicAd>` mounts). On each
later `pageKey` change it calls `destroyPlaceholders(...departingIds)` then
`showAds(...newIds)`, in that order. If you omit `ids`, a route change calls
`destroyAll()` then `showAds()` (rescan every placeholder div) — use that for
pages whose placeholder divs you render manually and cannot enumerate.

The SDK never calls `newPage()` itself. The `sa.min.js` bundle ships a monitor
that patches `history.pushState`/`replaceState` and calls `newPage()` on the
client-side URL change on its own; the SDK coalesces with it rather than
double-firing.

Use the hook for **manually-rendered** placeholder divs, or to force a
new-pageview reload when the **same** `<EzoicAd>` ids persist across routes. When
each route renders a **different** set of `<EzoicAd>` components, those already
destroy on unmount and show on mount — do not also pass the same ids to the hook,
or the ad is requested twice.

#### React Router (v6)

```tsx
import { useLocation } from 'react-router-dom';
import { EzoicAd, useEzoicPageView } from '@ezoic/react-sdk';

function RouteAds() {
  // Re-key ads on every pathname change.
  useEzoicPageView(useLocation().pathname, { ids: [101, 102] });
  return (
    <>
      <EzoicAd id={101} />
      <EzoicAd id={102} />
    </>
  );
}
```

#### Next.js (app router)

```tsx
'use client';
import { usePathname } from 'next/navigation';
import { EzoicAd, useEzoicPageView } from '@ezoic/react-sdk';

export function RouteAds() {
  useEzoicPageView(usePathname(), { ids: [101, 102] });
  return (
    <>
      <EzoicAd id={101} />
      <EzoicAd id={102} />
    </>
  );
}
```

Render `<EzoicProvider>` once in the root layout (a client component), then use
`RouteAds` in the pages that show ads. For the Next.js pages router, use
`useRouter().asPath` (or subscribe to `routeChangeComplete`) as the `pageKey`.

#### Infinite scroll / dynamic content

For content appended to the **same** pageview (infinite scroll, "load more"),
call `showAds(...newIds)` directly with the ids of the newly added placeholders —
do not use `useEzoicPageView`, which is for full route changes:

```tsx
const { showAds } = useEzoic();
// after appending divs for ids 201, 202 to the DOM:
showAds(201, 202);
```

### Consent & privacy

Ezoic's Gatekeeper CMP is injected first by `<EzoicProvider>` and manages consent
automatically. These passthroughs let you drive Ezoic's consent behavior, and
`useEzoicConsent()` reads live IAB TCF v2.2 consent state:

```tsx
import {
  enableConsent,
  setDisablePersonalizedStatistics,
  setDisablePersonalizedAds,
  useEzoicConsent,
} from '@ezoic/react-sdk';

// Signal that Ezoic manages consent for this visitor:
enableConsent();
// Honor a "do not sell/share" style choice:
setDisablePersonalizedAds(true);
setDisablePersonalizedStatistics(true);

function ConsentGate({ children }: { children: React.ReactNode }) {
  const { tcfReady, gdprApplies, tcString } = useEzoicConsent();
  if (gdprApplies && !tcfReady) return <p>Loading consent…</p>;
  return <>{children}</>;
}
```

`useEzoicConsent()` returns `{ cmpPresent, tcfReady, tcString, gdprApplies,
eventStatus, cmpStatus }`. It subscribes via `window.__tcfapi('addEventListener',
…)` when a TCF CMP is present, updates as the consent string changes, and removes
its listener on unmount. It is SSR-safe (returns `{ cmpPresent: false, tcfReady:
false }` on the server and until a CMP appears) and never throws when no CMP is
present.

### Configuration & format toggles

`config()` applies publisher configuration. Only the documented keys are accepted
(TypeScript enforces this; unknown keys are dropped with a warning). It is
**write-only** — the bundle's public wrapper does not return the stored config.
Call it **before** the first `showAds` so the config affects that request:

```tsx
import {
  config,
  setEzoicAnchorAd,
  setInterstitialAllowed,
  isInterstitialAllowed,
} from '@ezoic/react-sdk';

config({
  anchorAdPosition: 'top',
  reservePlaceholderSpace: true,
  disableSidebarFloating: true,
});

// Format toggles:
setEzoicAnchorAd(true);
setInterstitialAllowed(false);
const allowed = isInterstitialAllowed(); // boolean | undefined (undefined until sa.min.js loads)
```

Accepted `config` keys: `anchorAdPosition`, `anchorAdExpansion`, `disableVideo`,
`disableInterstitial`, `disableLeftSideRail`, `disableRightSideRail`,
`disableSidebarFloating`, `reservePlaceholderSpace`, `limitCookies`,
`vignetteDesktop`, `vignetteMobile`, `vignetteTablet`.

The anchor / interstitial / outstream toggles are `setEzoicAnchorAd(bool)`,
`hasAnchorAdBeenClosed()`, `setInterstitialAllowed(bool, opts?)`,
`isInterstitialAllowed()`, `setOutstreamAllowed(bool, opts?)` (returns a promise),
and `isOutstreamAllowed()`. The `is*` / `has*` getters return `boolean |
undefined` (undefined until `sa.min.js` loads).

### Rewarded ads

Rewarded ads let a visitor watch an ad in exchange for a reward (unlock content,
in-game currency, etc.). They are served by a **separate** bundle from your
site-specific rewarded loader script — its own `cmd` queue, independent of
`sa.min.js`. The loader URL looks like
`https://<your-domain-handler-host>/porpoiseant/ezadloadrewarded.js`; find the
exact host in your Ezoic integration and pass it to the hook as `loaderUrl`.

`useEzoicRewarded()` injects that loader once, wraps every rewarded method as a
promise, and surfaces the `ezRewardedInitiated` / `ezRewardedDisplayed` /
`ezRewardedClosed` window events as state:

```tsx
import { useEzoicRewarded } from '@ezoic/react-sdk';

function UnlockButton() {
  const { requestWithOverlay, displayed } = useEzoicRewarded({
    loaderUrl: 'https://<your-domain-handler-host>/porpoiseant/ezadloadrewarded.js',
  });

  async function onClick() {
    // Recommended flow: a call-to-action overlay explains the reward first.
    const { reward, msg } = await requestWithOverlay(
      { header: 'Unlock this article', body: ['Watch a short ad to continue.'] },
      { rewardName: 'premium_article' },
    );
    if (reward) unlockContent();
    else console.log('No reward:', msg); // no-fill, closed early, or cancelled
  }

  return <button onClick={onClick}>{displayed ? 'Ad playing…' : 'Watch ad to unlock'}</button>;
}
```

Outcome shapes match the rewarded API:

- `request(config?)` → `{ status, msg, adInfo? }` — pre-fetches an ad without showing it.
- `show(config?)`, `requestAndShow(config?)`, `requestWithOverlay(text?, config?)`
  → `{ status, reward, msg, adInfo?, userInfo? }`. `reward` is `true` only when
  the visitor earned the reward; it is `false` for no-fill, closed-early, and
  cancelled outcomes (`msg` distinguishes them).
- `contentLocker(action, config?)` gates an `action` (a URL to redirect to, or a
  function to run) behind watching an ad; use `config.readyCallback` to observe
  the ad becoming ready.

For site-wide rewarded formats (anchor, interstitial, floating video, side
rails), call `initRewardedAds(placements?)` once at boot — this drives
`ezstandalone.initRewardedAds` on the standard `cmd` queue. Every format defaults
to **enabled**: with no argument all four are on, and omitting a key leaves that
format on. Only an explicit `false` disables a format — e.g.
`initRewardedAds({ video: false })` keeps anchor, interstitial, and side rails on
while turning off floating video.

SSR-safe: on the server the hook returns its initial state and the promise
wrappers reject with a clear "browser only" error rather than touching `window`.
If the rewarded loader is missing, calls queue and never throw.

### Video

The SDK supports two independent video paths.

**Ezoic outstream/instream video** (`<EzoicVideo>`) runs on the same standalone
bundle as display ads. It renders a publisher-chosen `<div id>` and loads it via
a batched `displayMoreVideo`, which both registers the placeholder and requests
its ad code. Every `<EzoicVideo>` that mounts in the same commit is coalesced
into one `displayMoreVideo(...divIds)` call; the bundle appends to its video
registry without clobbering, so same-tick mounts share one call and later mounts
add ids safely. On unmount the slot is torn down with
`destroyVideoPlaceholders(divId)`.

```tsx
import { EzoicProvider, EzoicVideo } from '@ezoic/react-sdk';

function Article() {
  return (
    <EzoicProvider>
      <EzoicVideo divId="my-video-slot" />
      <EzoicVideo divId="sidebar-video" style={{ minHeight: 240 }} />
    </EzoicProvider>
  );
}
```

**Open Video** (`<EzoicVideoEmbed>`) embeds a player from Ezoic's video platform
at [open.video](https://open.video), independent of `sa.min.js` (no
`<EzoicProvider>` required). It injects `https://open.video/video.js` once and
pushes a player entry onto `window.openVideoPlayers` targeting its own container
div. Mount-once semantics: `videoId`, `float`, and `scriptUrl` are read on mount
— to play a different video, remount with a new React `key`.

```tsx
import { EzoicVideoEmbed } from '@ezoic/react-sdk';

function VideoBlock() {
  return <EzoicVideoEmbed videoId="YOUR_VIDEO_ID" float />;
}
```

Unlike display placeholders, **video containers may be styled**: both
`<EzoicVideo>` and `<EzoicVideoEmbed>` accept `className`/`style` on their
publisher-chosen container div. (Display placeholder divs — `<EzoicAd>` — must
never be styled; Ezoic manages their dimensions.)

Both paths are SSR-safe: the container div renders on the server, and every
imperative call (`defineVideo`, `displayMoreVideo`, `destroyVideoPlaceholders`,
`ensureOpenVideoScript`, `pushOpenVideoPlayer`) is a no-op there.

### Placeholder helpers

Most apps should use `<EzoicAd>` above. These low-level helpers are exported for
advanced or non-React callers that build placeholder divs themselves. A display
placeholder is a bare `<div id="ezoic-pub-ad-placeholder-<id>">` element (never
style the placeholder div itself — Ezoic manages its dimensions).

```tsx
import { placeholderDomId, isValidPlaceholderId } from '@ezoic/react-sdk';

// Valid display placeholder ids are integers in the inclusive range 1–999.
isValidPlaceholderId(101); // true
isValidPlaceholderId(1000); // false

// Build an Ezoic display placeholder div id:
function AdSlot({ id }: { id: number }) {
  return <div id={placeholderDomId(id)} />;
}
```

### Migrating from raw Ezoic snippets

If you already integrated Ezoic by hand, replace the raw snippet with the SDK.

Before — hand-written cmd-queue stub, a bare placeholder div, and a manual
`showAds` call:

```html
<script>
  window.ezstandalone = window.ezstandalone || {};
  ezstandalone.cmd = ezstandalone.cmd || [];
</script>

<div id="ezoic-pub-ad-placeholder-101"></div>

<script>
  ezstandalone.cmd.push(function () {
    ezstandalone.showAds(101);
  });
</script>
```

After — the SDK equivalent:

```tsx
import { EzoicProvider, EzoicAd } from '@ezoic/react-sdk';

export default function App() {
  return (
    <EzoicProvider>
      <EzoicAd id={101} sizes={['728x90']} required />
    </EzoicProvider>
  );
}
```

The Provider owns the CMP + `ezstandalone.cmd` queue + `sa.min.js` injection, and
each `<EzoicAd>` handles its own `showAds` on mount and `destroyPlaceholders` on
unmount. No manual queue calls are needed.

## API

| Export                                                              | Description                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<EzoicProvider singlePageApp?>`                                    | Injects the consent + `sa.min.js` scripts, marks SPA mode at boot (default on), and provides SDK context.                                                                                                                              |
| `<EzoicAd id\|location required? sizes?>`                           | Renders a bare display placeholder div and requests it via batched `showAds`. Pass a numeric `id` (1–999) or a semantic `location` name (zero-config, resolved to a 900-range id).                                                     |
| `useEzoic()`                                                        | Hook returning `{ isReady, push, showAds, displayMore, destroyPlaceholders, destroyAll, refreshAds, isEzoicUser, setIsSinglePageApplication }`. Must be used inside `<EzoicProvider>`.                                                 |
| `useEzoicPageView(pageKey, { ids? })`                               | On `pageKey` change, destroys the departing route's ids then `showAds` the new ids (or `destroyAll()` + `showAds()` when `ids` is omitted). Fires nothing on first render.                                                             |
| `showAds(...placeholders)`                                          | Batched request for ids or `{ id, required?, sizes? }` objects; queues on `cmd`.                                                                                                                                                       |
| `displayMore(...ids)`                                               | Reveals additional placeholders (dynamic content); queues on `cmd`.                                                                                                                                                                    |
| `destroyPlaceholders(...ids)`                                       | Tears down the given placeholders; queues on `cmd`.                                                                                                                                                                                    |
| `destroyAll()`                                                      | Tears down every placeholder; queues on `cmd`.                                                                                                                                                                                         |
| `refreshAds(...ids)`                                                | Refreshes the given (or all) placeholders; queues on `cmd`.                                                                                                                                                                            |
| `isEzoicUser(pct?, cb?)`                                            | `boolean \| undefined` (undefined until loaded); pass a callback to resolve async.                                                                                                                                                     |
| `setIsSinglePageApplication(bool)`                                  | Marks the page as a single-page app; queues on `cmd`. Called at boot by the provider.                                                                                                                                                  |
| `useEzoicConsent()`                                                 | Hook returning live IAB TCF v2.2 consent state `{ cmpPresent, tcfReady, tcString, gdprApplies, eventStatus, cmpStatus }` via `window.__tcfapi`. SSR-safe; never throws without a CMP.                                                  |
| `enableConsent()`                                                   | Signals that Ezoic manages consent for this visitor; queues on `cmd`.                                                                                                                                                                  |
| `setDisablePersonalizedStatistics(bool)`                            | Disables/enables personalized statistics; queues on `cmd`.                                                                                                                                                                             |
| `setDisablePersonalizedAds(bool)`                                   | Disables/enables personalized ads; queues on `cmd`.                                                                                                                                                                                    |
| `config(options)`                                                   | Write-only publisher config. Only accepted keys are forwarded (unknown keys dropped with a warning). Call before the first `showAds`.                                                                                                  |
| `CONFIG_KEYS`                                                       | Read-only tuple of the accepted `config` keys.                                                                                                                                                                                         |
| `setEzoicAnchorAd(bool)`                                            | Enables/disables the anchor ad; queues on `cmd`.                                                                                                                                                                                       |
| `hasAnchorAdBeenClosed()`                                           | `boolean \| undefined` — whether the visitor closed the anchor ad (undefined until loaded).                                                                                                                                            |
| `setInterstitialAllowed(bool, opts?)`                               | Allows/disallows the interstitial format; queues on `cmd`.                                                                                                                                                                             |
| `isInterstitialAllowed()`                                           | `boolean \| undefined` — whether the interstitial is allowed (undefined until loaded).                                                                                                                                                 |
| `setOutstreamAllowed(bool, opts?)`                                  | Allows/disallows floating outstream. Returns `Promise<boolean \| undefined>` (resolves the bundle result, or `undefined` if queued before load).                                                                                       |
| `isOutstreamAllowed()`                                              | `boolean \| undefined` — whether floating outstream is allowed (undefined until loaded).                                                                                                                                               |
| `useEzoicRewarded({ loaderUrl? })`                                  | Hook for rewarded ads. Injects the site-specific loader and returns `{ ready, initiated, displayed, closed, lastEvent, register, request, show, requestAndShow, requestWithOverlay, contentLocker, initRewardedAds }`. SSR-safe.       |
| `requestRewarded(config?)`                                          | Promise wrapper for `ezRewardedAds.request` → `{ status, msg, adInfo? }`.                                                                                                                                                              |
| `showRewarded(config?)`                                             | Promise wrapper for `ezRewardedAds.show` → `{ status, reward, msg, adInfo?, userInfo? }`.                                                                                                                                              |
| `requestAndShowRewarded(config?)`                                   | Promise wrapper for `ezRewardedAds.requestAndShow` (no call-to-action modal) → show outcome.                                                                                                                                           |
| `requestRewardedWithOverlay(text?, cfg?)`                           | Promise wrapper for `ezRewardedAds.requestWithOverlay` (recommended CTA flow) → show outcome.                                                                                                                                          |
| `rewardedContentLocker(action, config?)`                            | Gates `action` (URL or function) behind watching a rewarded ad; queues on the rewarded `cmd`.                                                                                                                                          |
| `registerRewarded()`                                                | Records that a rewarded implementation is present (tracking only); queues on the rewarded `cmd`.                                                                                                                                       |
| `initRewardedAds(placements?)`                                      | Configures site-wide rewarded formats and triggers the slot via `ezstandalone.initRewardedAds`. Every format defaults to enabled; only an explicit `false` disables one.                                                               |
| `<EzoicVideo divId className? style?>`                              | Renders a publisher-chosen video container div and loads it via batched `displayMoreVideo`. Destroys it on unmount. May be styled. Requires `<EzoicProvider>`.                                                                         |
| `<EzoicVideoEmbed videoId float? scriptUrl? id? className? style?>` | Embeds an Open Video (open.video) player: injects `open.video/video.js` once and pushes to `window.openVideoPlayers`. Independent of `sa.min.js` — no provider required. May be styled. Mount-once (change `videoId` via a new `key`). |
| `defineVideo(...entries)`                                           | Registers video placeholders (register-only; resets the registry, then appends the passed entries — does not request ad code); queues on `cmd`.                                                                                        |
| `displayMoreVideo(...divIds)`                                       | Registers (if new) and loads video ad code for the given divs; appends without clobbering; queues on `cmd`.                                                                                                                            |
| `destroyVideoPlaceholders(...divIds)`                               | Tears down the given video divs and their players; queues on `cmd`.                                                                                                                                                                    |
| `ensureOpenVideoScript(scriptUrl?)`                                 | Imperative, idempotent injection of the Open Video script; guard-seeds `window.openVideoPlayers` (never resets it). No-op on the server.                                                                                               |
| `pushOpenVideoPlayer(entry)`                                        | Pushes an `{ target, videoID?, playlist?, float? }` entry onto `window.openVideoPlayers` (guard-only init, never reset). No-op on the server.                                                                                          |
| `OPEN_VIDEO_SCRIPT_URL`                                             | The Open Video (`open.video/video.js`) script URL.                                                                                                                                                                                     |
| `ensureRewardedScript(loaderUrl)`                                   | Imperative, idempotent injection of the rewarded loader + `cmd` stub (advanced / non-React).                                                                                                                                           |
| `pushToRewardedCmd(fn)`                                             | Queues a command on `window.ezRewardedAds.cmd`; no-op on the server.                                                                                                                                                                   |
| `REWARDED_EVENTS`                                                   | Read-only map of the rewarded window event names (`ezRewardedInitiated`, etc.).                                                                                                                                                        |
| `ensureEzoicScripts(opts)`                                          | Imperative, order-safe, idempotent script injection (advanced / non-React).                                                                                                                                                            |
| `pushToEzoicCmd(fn)`                                                | Queues a command on `window.ezstandalone.cmd`; no-op on the server.                                                                                                                                                                    |
| `CMP_SCRIPT_URL_1/2`                                                | The Gatekeeper consent (CMP) script URLs.                                                                                                                                                                                              |
| `SA_SCRIPT_URL`                                                     | The `sa.min.js` standalone bundle URL.                                                                                                                                                                                                 |
| `placeholderDomId(id)`                                              | Builds `ezoic-pub-ad-placeholder-<id>`. Throws `RangeError` on an invalid id.                                                                                                                                                          |
| `isValidPlaceholderId(id)`                                          | Type guard for a scannable display placeholder id (integer 1–999).                                                                                                                                                                     |
| `resolveGeneratedId(location)`                                      | Resolves a location name to a 900-range id via `GetGeneratedIdAsync`, falling back to the static map. Returns a promise.                                                                                                               |
| `resolveLocationIdFromMap(location)`                                | Pure static resolver: location name → 900-range id from `ID_TO_LOCATION` (no bundle needed).                                                                                                                                           |
| `isKnownLocation(name)`                                             | Type guard for a documented location name or alias.                                                                                                                                                                                    |
| `ID_TO_LOCATION`                                                    | The documented 900–999 id→location map (read-only).                                                                                                                                                                                    |
| `LOCATION_ALIASES`                                                  | Read-only map of location-name aliases to their canonical names.                                                                                                                                                                       |
| `EZOIC_PLACEHOLDER_PREFIX`                                          | The `ezoic-pub-ad-placeholder-` DOM id prefix.                                                                                                                                                                                         |
| `MIN_PLACEHOLDER_ID`                                                | `1` — lowest scannable placeholder id.                                                                                                                                                                                                 |
| `MAX_PLACEHOLDER_ID`                                                | `999` — highest scannable placeholder id.                                                                                                                                                                                              |
| `VERSION`                                                           | The installed SDK version string.                                                                                                                                                                                                      |

## Roadmap

- [x] Package skeleton (TypeScript, dual ESM/CJS build, tests, lint, CI)
- [x] `<EzoicProvider>` — consent + `sa.min.js` script management
- [x] `<EzoicAd>` display placeholders with batched `showAds`
- [x] Single-page-app routing helpers (`useEzoicPageView`)
- [x] Zero-config location placements (`<EzoicAd location="…" />`)
- [x] Consent + config passthroughs (`useEzoicConsent`, `config`, format toggles)
- [x] Rewarded ads (`useEzoicRewarded`)
- [x] Video (Ezoic + Open Video)
- [ ] Docs site + example app

## Examples

The [`examples/`](./examples) Vite demo app exercises every feature. Run it with:

```bash
cd examples
npm install
npm run dev
```

It demonstrates provider setup, display ads, zero-config locations, dynamic
`showAds`, SPA routing, consent, rewarded, and video, with an on-page event log.
Ads will not fill on localhost (no demand) — the demo is for verifying wiring and
structure.

## Development

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

The library is built with [tsup](https://tsup.egoist.dev/) into dual ESM/CJS
output with TypeScript declarations. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

[MIT](./LICENSE)
