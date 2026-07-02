# @ezoic/react-sdk

[![CI](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

The official [Ezoic](https://www.ezoic.com) SDK for React. It wraps the Ezoic
standalone ad integration so a React app can manage consent scripts, display ad
placeholders, single-page-app navigation, rewarded ads, and video without
hand-writing the raw snippets.

> **Pre-1.0 / under active development.** The public API is still being built
> out and may change before `1.0.0`. This release ships the package foundation,
> the placeholder helpers, and `<EzoicProvider>` for consent + script
> management. The display component (`<EzoicAd>`) and the `showAds` /
> `destroyPlaceholders` hook passthroughs land in subsequent releases (see
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
      // Runs after sa.min.js initializes. The typed `showAds` passthrough and
      // the <EzoicAd> component arrive in the next release; until then, call
      // ezstandalone here, e.g. ezstandalone.showAds(101, 102).
    });
  }, [push]);
  return null;
}
```

`isReady` becomes `true` once the provider has injected the scripts on the
client. It does **not** mean ads have rendered — pushed commands are queued
until the bundle initializes.

### Placeholder helpers

A display placeholder is a bare `<div id="ezoic-pub-ad-placeholder-<id>">`
element (never style the placeholder div itself — Ezoic manages its dimensions).

```tsx
import { placeholderDomId, isValidPlaceholderId } from '@ezoic/react-sdk';

// Valid display placeholder ids are integers in the inclusive range 1–999.
isValidPlaceholderId(101); // true
isValidPlaceholderId(1000); // false

// Render an Ezoic display placeholder div by hand today:
function AdSlot({ id }: { id: number }) {
  return <div id={placeholderDomId(id)} />;
}
```

The `<EzoicAd>` component that renders these divs and batches `showAds` for you
is coming in the next release.

## API

| Export                     | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `<EzoicProvider>`          | Injects the consent + `sa.min.js` scripts and provides SDK context.           |
| `useEzoic()`               | Hook returning `{ isReady, push }`. Must be used inside `<EzoicProvider>`.    |
| `ensureEzoicScripts(opts)` | Imperative, order-safe, idempotent script injection (advanced / non-React).   |
| `pushToEzoicCmd(fn)`       | Queues a command on `window.ezstandalone.cmd`; no-op on the server.           |
| `CMP_SCRIPT_URL_1/2`       | The Gatekeeper consent (CMP) script URLs.                                     |
| `SA_SCRIPT_URL`            | The `sa.min.js` standalone bundle URL.                                        |
| `placeholderDomId(id)`     | Builds `ezoic-pub-ad-placeholder-<id>`. Throws `RangeError` on an invalid id. |
| `isValidPlaceholderId(id)` | Type guard for a scannable display placeholder id (integer 1–999).            |
| `EZOIC_PLACEHOLDER_PREFIX` | The `ezoic-pub-ad-placeholder-` DOM id prefix.                                |
| `MIN_PLACEHOLDER_ID`       | `1` — lowest scannable placeholder id.                                        |
| `MAX_PLACEHOLDER_ID`       | `999` — highest scannable placeholder id.                                     |
| `VERSION`                  | The installed SDK version string.                                             |

## Roadmap

- [x] Package skeleton (TypeScript, dual ESM/CJS build, tests, lint, CI)
- [x] `<EzoicProvider>` — consent + `sa.min.js` script management
- [ ] `<EzoicAd>` display placeholders with batched `showAds`
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
