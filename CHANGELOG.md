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

[Unreleased]: https://github.com/ezoic/ezoic-react-sdk/commits/master
