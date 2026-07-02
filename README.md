# @ezoic/react-sdk

[![CI](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

The official [Ezoic](https://www.ezoic.com) SDK for React. It wraps the Ezoic
standalone ad integration so a React app can manage consent scripts, display ad
placeholders, single-page-app navigation, rewarded ads, and video without
hand-writing the raw snippets.

> **Pre-1.0 / under active development.** The public API is still being built
> out and may change before `1.0.0`. This release ships the package foundation,
> `<EzoicProvider>` for consent + script management, and the `<EzoicAd>` display
> component with batched `showAds` and the `useEzoic()` ad-serving passthroughs.
> Single-page-app routing, zero-config location placements, rewarded ads, and
> video land in subsequent releases (see [Roadmap](#roadmap)). Follow
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

| Export                          | Description                                                                                                                                                |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `<EzoicProvider>`               | Injects the consent + `sa.min.js` scripts and provides SDK context.                                                                                        |
| `<EzoicAd id required? sizes?>` | Renders a bare display placeholder div and requests it via batched `showAds`.                                                                              |
| `useEzoic()`                    | Hook returning `{ isReady, push, showAds, displayMore, destroyPlaceholders, destroyAll, refreshAds, isEzoicUser }`. Must be used inside `<EzoicProvider>`. |
| `showAds(...placeholders)`      | Batched request for ids or `{ id, required?, sizes? }` objects; queues on `cmd`.                                                                           |
| `displayMore(...ids)`           | Reveals additional placeholders (dynamic content); queues on `cmd`.                                                                                        |
| `destroyPlaceholders(...ids)`   | Tears down the given placeholders; queues on `cmd`.                                                                                                        |
| `destroyAll()`                  | Tears down every placeholder; queues on `cmd`.                                                                                                             |
| `refreshAds(...ids)`            | Refreshes the given (or all) placeholders; queues on `cmd`.                                                                                                |
| `isEzoicUser(pct?, cb?)`        | `boolean \| undefined` (undefined until loaded); pass a callback to resolve async.                                                                         |
| `ensureEzoicScripts(opts)`      | Imperative, order-safe, idempotent script injection (advanced / non-React).                                                                                |
| `pushToEzoicCmd(fn)`            | Queues a command on `window.ezstandalone.cmd`; no-op on the server.                                                                                        |
| `CMP_SCRIPT_URL_1/2`            | The Gatekeeper consent (CMP) script URLs.                                                                                                                  |
| `SA_SCRIPT_URL`                 | The `sa.min.js` standalone bundle URL.                                                                                                                     |
| `placeholderDomId(id)`          | Builds `ezoic-pub-ad-placeholder-<id>`. Throws `RangeError` on an invalid id.                                                                              |
| `isValidPlaceholderId(id)`      | Type guard for a scannable display placeholder id (integer 1–999).                                                                                         |
| `EZOIC_PLACEHOLDER_PREFIX`      | The `ezoic-pub-ad-placeholder-` DOM id prefix.                                                                                                             |
| `MIN_PLACEHOLDER_ID`            | `1` — lowest scannable placeholder id.                                                                                                                     |
| `MAX_PLACEHOLDER_ID`            | `999` — highest scannable placeholder id.                                                                                                                  |
| `VERSION`                       | The installed SDK version string.                                                                                                                          |

## Roadmap

- [x] Package skeleton (TypeScript, dual ESM/CJS build, tests, lint, CI)
- [x] `<EzoicProvider>` — consent + `sa.min.js` script management
- [x] `<EzoicAd>` display placeholders with batched `showAds`
- [ ] Single-page-app routing helpers
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
