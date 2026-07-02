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
> and single-page-app routing (`useEzoicPageView`). Zero-config location
> placements, rewarded ads, and video land in subsequent releases (see
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

## API

| Export                                | Description                                                                                                                                                                            |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<EzoicProvider singlePageApp?>`      | Injects the consent + `sa.min.js` scripts, marks SPA mode at boot (default on), and provides SDK context.                                                                              |
| `<EzoicAd id required? sizes?>`       | Renders a bare display placeholder div and requests it via batched `showAds`.                                                                                                          |
| `useEzoic()`                          | Hook returning `{ isReady, push, showAds, displayMore, destroyPlaceholders, destroyAll, refreshAds, isEzoicUser, setIsSinglePageApplication }`. Must be used inside `<EzoicProvider>`. |
| `useEzoicPageView(pageKey, { ids? })` | On `pageKey` change, destroys the departing route's ids then `showAds` the new ids (or `destroyAll()` + `showAds()` when `ids` is omitted). Fires nothing on first render.             |
| `showAds(...placeholders)`            | Batched request for ids or `{ id, required?, sizes? }` objects; queues on `cmd`.                                                                                                       |
| `displayMore(...ids)`                 | Reveals additional placeholders (dynamic content); queues on `cmd`.                                                                                                                    |
| `destroyPlaceholders(...ids)`         | Tears down the given placeholders; queues on `cmd`.                                                                                                                                    |
| `destroyAll()`                        | Tears down every placeholder; queues on `cmd`.                                                                                                                                         |
| `refreshAds(...ids)`                  | Refreshes the given (or all) placeholders; queues on `cmd`.                                                                                                                            |
| `isEzoicUser(pct?, cb?)`              | `boolean \| undefined` (undefined until loaded); pass a callback to resolve async.                                                                                                     |
| `setIsSinglePageApplication(bool)`    | Marks the page as a single-page app; queues on `cmd`. Called at boot by the provider.                                                                                                  |
| `ensureEzoicScripts(opts)`            | Imperative, order-safe, idempotent script injection (advanced / non-React).                                                                                                            |
| `pushToEzoicCmd(fn)`                  | Queues a command on `window.ezstandalone.cmd`; no-op on the server.                                                                                                                    |
| `CMP_SCRIPT_URL_1/2`                  | The Gatekeeper consent (CMP) script URLs.                                                                                                                                              |
| `SA_SCRIPT_URL`                       | The `sa.min.js` standalone bundle URL.                                                                                                                                                 |
| `placeholderDomId(id)`                | Builds `ezoic-pub-ad-placeholder-<id>`. Throws `RangeError` on an invalid id.                                                                                                          |
| `isValidPlaceholderId(id)`            | Type guard for a scannable display placeholder id (integer 1–999).                                                                                                                     |
| `EZOIC_PLACEHOLDER_PREFIX`            | The `ezoic-pub-ad-placeholder-` DOM id prefix.                                                                                                                                         |
| `MIN_PLACEHOLDER_ID`                  | `1` — lowest scannable placeholder id.                                                                                                                                                 |
| `MAX_PLACEHOLDER_ID`                  | `999` — highest scannable placeholder id.                                                                                                                                              |
| `VERSION`                             | The installed SDK version string.                                                                                                                                                      |

## Roadmap

- [x] Package skeleton (TypeScript, dual ESM/CJS build, tests, lint, CI)
- [x] `<EzoicProvider>` — consent + `sa.min.js` script management
- [x] `<EzoicAd>` display placeholders with batched `showAds`
- [x] Single-page-app routing helpers (`useEzoicPageView`)
- [ ] Zero-config location placements
- [ ] Consent + config passthroughs
- [ ] Rewarded ads
- [ ] Video (Ezoic + Humix)
- [ ] Docs site + example app

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
