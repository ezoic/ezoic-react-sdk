# Ezoic React SDK Example

A Vite + React + TypeScript demo that exercises every feature of `@ezoic/react-sdk`:
display ads (numeric ids and zero-config locations), dynamic ad units, SPA page
views, consent/config passthroughs, the imperative `useEzoic` API, rewarded ads,
and Ezoic/Open Video embeds. A shared in-page Event Log records every SDK action.

The example depends on the library via `file:..`, so build the library first.

## Run

From the repository root, build the library once:

```bash
npm install
npm run build
```

Then, from this `examples/` directory:

```bash
npm install
npm run build   # tsc --noEmit && vite build
npm run dev     # local dev server
```

On localhost the Ezoic scripts are absent, so all SDK calls queue as no-ops and
no ads render — every control still logs to the Event Log panel. To see live ads,
serve the built app from an Ezoic-integrated domain.
