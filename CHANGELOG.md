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

[Unreleased]: https://github.com/ezoic/ezoic-react-sdk/commits/master
