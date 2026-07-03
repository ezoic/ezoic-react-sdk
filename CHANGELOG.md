# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Package skeleton: TypeScript, dual ESM/CJS build via tsup with type
  declarations, Vitest + Testing Library test harness (jsdom), ESLint flat
  config + Prettier, and GitHub Actions CI on a Node 20 & 22 matrix.
- Placeholder helpers: `placeholderDomId`, `isValidPlaceholderId`,
  `EZOIC_PLACEHOLDER_PREFIX`, `MIN_PLACEHOLDER_ID`, `MAX_PLACEHOLDER_ID`.
- `VERSION` export, kept in sync with `package.json` and asserted by tests.
- `<EzoicProvider>`: injects the Ezoic script chain — Gatekeeper CMP scripts
  (`data-cfasync="false"` before `src`) → `ezstandalone.cmd` queue stub →
  async `sa.min.js` → optional analytics — in that order, once. Idempotent
  (never double-injects; tolerates scripts already in the host HTML) and
  SSR-safe (injection runs in an effect; no `window` access during render).
- `useEzoic()` hook exposing `{ isReady, push }`, where `push` queues commands
  on `window.ezstandalone.cmd`. Throws when used outside `<EzoicProvider>`.
- `ensureEzoicScripts` and `pushToEzoicCmd` imperative helpers, the
  Ezoic script URL constants (`CMP_SCRIPT_URL_1/2`, `SA_SCRIPT_URL`), and the
  `EzoicWindow` / `EzstandaloneApi` / `EzoicCommandQueue` type contracts.
- `<EzoicAd id required? sizes?>` display component: renders a bare
  `ezoic-pub-ad-placeholder-<id>` div (never styled), coalesces every ad
  mounting in the same React commit into one `showAds(...)` call, and calls
  `destroyPlaceholders(id)` on unmount. Validates ids (integers 1–999; invalid
  ids render nothing and log rather than throw) and guards duplicate-mounted ids.
- `useEzoic()` ad-serving passthroughs — `showAds`, `displayMore`,
  `destroyPlaceholders`, `destroyAll`, `refreshAds`, `isEzoicUser` — each queued
  on `ezstandalone.cmd` so they are safe to call before the bundle loads.
- Single-page-app routing: `<EzoicProvider>` marks SPA mode at boot via
  `setIsSinglePageApplication(true)` (opt out with `singlePageApp={false}`), and
  the new `useEzoicPageView(pageKey, { ids? })` hook destroys the departing
  route's placeholders then requests the new route's placeholders on navigation
  (or `destroyAll()` + `showAds()` when `ids` is omitted). Fires nothing on first
  render and never calls `newPage()` itself, coalescing with the bundle's
  built-in navigation monitor. README adds React Router, Next.js, and
  infinite-scroll recipes. `setIsSinglePageApplication` is also exported as a
  standalone passthrough.
- Zero-config placements: `<EzoicAd location="under_first_paragraph" />` resolves
  a semantic location name to a reserved 900-range id via
  `ezstandalone.GetGeneratedIdAsync` when the bundle is loaded, falling back to
  the documented static id→location map when it is not. Supports every documented
  location name and its aliases. `EzoicAd` now takes either `id` or `location`
  (mutually exclusive). New exports: `resolveGeneratedId`,
  `resolveLocationIdFromMap`, `isKnownLocation`, `ID_TO_LOCATION`,
  `LOCATION_ALIASES`, and the `EzoicLocation` / `EzoicNamedLocation` types.
  `GetGeneratedIdAsync` added to the `EzstandaloneApi` contract.
- Consent + config passthroughs: `enableConsent()`,
  `setDisablePersonalizedStatistics(bool)`, `setDisablePersonalizedAds(bool)`,
  and the `useEzoicConsent()` hook exposing live IAB TCF v2.2 consent state
  (`cmpPresent`, `tcfReady`, `tcString`, `gdprApplies`, `eventStatus`,
  `cmpStatus`) via `window.__tcfapi` — SSR-safe and a no-op when no CMP is
  present.
- Typed, write-only `config(options)` accepting the verified key set
  (`anchorAdPosition`, `anchorAdExpansion`, `disableVideo`,
  `disableInterstitial`, `disableLeftSideRail`, `disableRightSideRail`,
  `disableSidebarFloating`, `reservePlaceholderSpace`, `limitCookies`,
  `vignetteDesktop` / `vignetteMobile` / `vignetteTablet`); unknown keys are
  dropped with a warning. Exposed write-only because the bundle's public
  `config` wrapper does not return the stored config. `CONFIG_KEYS` is exported.
- Format toggles: `setEzoicAnchorAd(bool)`, `hasAnchorAdBeenClosed()`,
  `setInterstitialAllowed(bool, opts?)`, `isInterstitialAllowed()`,
  `setOutstreamAllowed(bool, opts?)` (returns a promise), and
  `isOutstreamAllowed()`. The `is*` / `has*` getters return `boolean |
undefined` (undefined until `sa.min.js` loads). Added `EzoicConfig`, `TcfData`,
  and `TcfApi` type exports and the corresponding `EzstandaloneApi` methods.
- Rewarded ads: `useEzoicRewarded({ loaderUrl? })` wraps the separate rewarded
  bundle (`window.ezRewardedAds`, its own `cmd` queue) with promise-based
  methods — `request` → `{ status, msg, adInfo? }`; `show` / `requestAndShow` /
  `requestWithOverlay` → `{ status, reward, msg, adInfo?, userInfo? }` — plus
  `contentLocker`, `register`, and `initRewardedAds` (site-wide format setup via
  `ezstandalone.initRewardedAds`; every format defaults to enabled and only an
  explicit `false` disables one). The hook injects the site-specific loader
  (`{host}/porpoiseant/ezadloadrewarded.js`) idempotently and surfaces the
  `ezRewardedInitiated` / `ezRewardedDisplayed` / `ezRewardedClosed` window events
  as `{ ready, initiated, displayed, closed, lastEvent }`. SSR-safe: the wrappers
  reject with a browser-only error on the server and calls queue when the loader
  has not loaded. Standalone exports: `requestRewarded`, `showRewarded`,
  `requestAndShowRewarded`, `requestRewardedWithOverlay`, `rewardedContentLocker`,
  `registerRewarded`, `initRewardedAds`, `ensureRewardedScript`,
  `pushToRewardedCmd`, `REWARDED_EVENTS`, and the `EzRewardedAdsApi` /
  `EzoicRewarded*` / `EzoicContentLocker*` type contracts. `initRewardedAds` added
  to the `EzstandaloneApi` contract and `ezRewardedAds` to `EzoicWindow`.
- Video (Ezoic path): `<EzoicVideo divId className? style?>` renders a
  publisher-chosen video container div and loads it via a batched
  `displayMoreVideo`, which both registers the placeholder and requests its ad
  code. Same-tick mounts coalesce into one `displayMoreVideo(...divIds)` call;
  the bundle appends to its video registry without clobbering, so later mounts
  add ids safely. The slot is torn down with `destroyVideoPlaceholders(divId)`
  on unmount. Unlike `<EzoicAd>`, the video container may be styled. Standalone
  passthroughs `defineVideo`, `displayMoreVideo`, `destroyVideoPlaceholders`
  (queued on `ezstandalone.cmd`) and the `EzoicVideoDefineEntry` type;
  `defineVideo` / `displayMoreVideo` / `destroyVideoPlaceholders` added to the
  `EzstandaloneApi` contract.
- Video (Open Video path): `<EzoicVideoEmbed videoId float? scriptUrl? id?
className? style?>` embeds an open.video player independent of `sa.min.js` (no
  provider required). It injects `https://open.video/video.js` once (idempotent
  by marker and by path) and pushes an `{ target, videoID, float }` entry onto
  `window.openVideoPlayers`. The global is only ever guard-initialized
  (`window.openVideoPlayers = window.openVideoPlayers || []`) and NEVER reset, so
  the live handler open.video installs after load is preserved. Mount-once
  semantics (change `videoId` via a new React `key`); the container may be styled.
  Standalone helpers `ensureOpenVideoScript`, `pushOpenVideoPlayer`, the
  `OPEN_VIDEO_SCRIPT_URL` constant, and the `OpenVideoPlayerEntry` /
  `OpenVideoPlayersQueue` types; `openVideoPlayers` added to `EzoicWindow`.
- `examples/` Vite demo app exercising every SDK feature — provider setup,
  display ads, zero-config locations, dynamic `showAds`, SPA routing, consent,
  rewarded, and video — with an on-page event log.
- README Quickstart and Examples sections, plus a guide for migrating from raw
  hand-written Ezoic snippets to the SDK.
- GitHub issue templates (bug report, feature request) and template config.

[Unreleased]: https://github.com/ezoic/ezoic-react-sdk/commits/master
