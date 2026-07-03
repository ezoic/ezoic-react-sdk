# Contributing

Thanks for helping improve `@ezoic/react-sdk`.

## Prerequisites

- Node.js 20 or newer (CI runs on Node 20 and 22)
- npm (the repo ships a `package-lock.json`; use `npm ci` for reproducible installs)

## Setup

```sh
npm ci
```

## Scripts

| Script                  | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `npm run build`         | Build dual ESM/CJS output + types with tsup. |
| `npm test`              | Run the Vitest suite once.                   |
| `npm run test:watch`    | Run Vitest in watch mode.                    |
| `npm run test:coverage` | Run tests with a coverage report.            |
| `npm run lint`          | Lint with ESLint (warnings fail).            |
| `npm run typecheck`     | Type-check with `tsc --noEmit`.              |
| `npm run format`        | Format the repo with Prettier.               |
| `npm run format:check`  | Verify formatting (used in CI).              |

## Before opening a pull request

Run the same checks CI runs and make sure they all pass:

```sh
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

## Running the example app

```sh
cd examples
npm install
npm run dev
```

The example links the local package via `file:..`, so build the root package
(`npm run build`) first if you changed SDK source.

## Guidelines

- Use TypeScript. Public exports must be typed and documented with TSDoc.
- Keep the placeholder `<div>` unstyled — Ezoic manages placeholder dimensions.
- Add tests for new behavior, including edge and error cases.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) for commit
  messages (`feat:`, `fix:`, `docs:`, `chore:`, ...).
- CI must be green before a pull request is merged.

## Publishing

Publishing to npm is handled by the Ezoic team and is not part of the normal
contribution flow. The package is kept publish-ready (`npm pack` is clean) at all
times.
