# @ezoic/react-sdk

[![CI](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/ezoic/ezoic-react-sdk/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

The official [Ezoic](https://www.ezoic.com) SDK for React. It wraps the Ezoic
standalone ad integration so a React app can manage consent scripts, display ad
placeholders, single-page-app navigation, rewarded ads, and video without
hand-writing the raw snippets.

> **Pre-1.0 / under active development.** The public API is still being built
> out and may change before `1.0.0`. This release ships the package foundation
> and the first verified placeholder helpers; the component and hook API lands
> in subsequent releases (see [Roadmap](#roadmap)). Follow
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

The current release exports the foundational placeholder utilities. A display
placeholder is a bare `<div id="ezoic-pub-ad-placeholder-<id>">` element (never
style the placeholder div itself — Ezoic manages its dimensions).

```tsx
import { placeholderDomId, isValidPlaceholderId, VERSION } from '@ezoic/react-sdk';

console.log(VERSION); // "0.1.0"

// Valid display placeholder ids are integers in the inclusive range 1–999.
isValidPlaceholderId(101); // true
isValidPlaceholderId(1000); // false

// Render an Ezoic display placeholder div by hand today:
function AdSlot({ id }: { id: number }) {
  return <div id={placeholderDomId(id)} />;
}
```

Ergonomic components and hooks (`<EzoicProvider>`, `<EzoicAd>`, `useEzoic()`)
that inject the scripts and drive `showAds` / `destroyPlaceholders` for you are
coming in the next releases.

## API

| Export                     | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `placeholderDomId(id)`     | Builds `ezoic-pub-ad-placeholder-<id>`. Throws `RangeError` on an invalid id. |
| `isValidPlaceholderId(id)` | Type guard for a scannable display placeholder id (integer 1–999).            |
| `EZOIC_PLACEHOLDER_PREFIX` | The `ezoic-pub-ad-placeholder-` DOM id prefix.                                |
| `MIN_PLACEHOLDER_ID`       | `1` — lowest scannable placeholder id.                                        |
| `MAX_PLACEHOLDER_ID`       | `999` — highest scannable placeholder id.                                     |
| `VERSION`                  | The installed SDK version string.                                             |

## Roadmap

- [x] Package skeleton (TypeScript, dual ESM/CJS build, tests, lint, CI)
- [ ] `<EzoicProvider>` — consent + `sa.min.js` script management
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
