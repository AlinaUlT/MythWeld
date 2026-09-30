# ADR 001 — The platform: an installable web app on GitHub Pages

**Status:** accepted · **Date:** 2026-09-28 · **Decided by:** The owner (SPEC D1; the host on
2026-09-28)

## Context

SPEC D1 chose a PWA (a web app that installs to the home screen and works offline) built with
Vite, React and TypeScript, with a Capacitor wrapper for Android later. SPEC §12 stage 0 asks for
this record. Phase 0 built the platform and measured it; this ADR records what was built and why.

## Decision

1. **A PWA.** Vite 8, React 19, TypeScript in strict mode. The app installs to the home screen and
   opens offline after the first visit: `vite-plugin-pwa` writes the manifest and a Workbox
   service worker that keeps a copy of every built file (SETUP-07).
2. **Data stays on the device**, in IndexedDB through Dexie, with persistent storage requested
   (SETUP-06; SPEC D5).
3. **Hosted on GitHub Pages**, at `https://alinault.github.io/MythWeld/` (SETUP-08).
   - It costs nothing for a public repository, and needs no account beyond GitHub.
   - It publishes only a build that passed the checks.
   - The owner chose it on 2026-09-28: "as free as possible".
4. **The app's path is one setting**, `APP_BASE_PATH`. The build, the router, the manifest, the
   service worker and the tests all follow it.

## Alternatives, and what they would cost

- **Cloudflare Pages.** Serves at the root of its own address and has its own fallback to
  `index.html`; it also works with a private repository. It needs a Cloudflare account and two
  keys stored in GitHub. Moving there: `APP_BASE_PATH = '/'` and a new deploy job
  (`docs/RUNNING.md`).
- **A native app (Expo / React Native, Flutter).** Rejected in SPEC D1: harder to test in the
  cloud, and the engine could not be reused in Foundry.
- **An Android package** comes later through Capacitor, around the same web app (SPEC D1, stage 7).

## What this ADR does not decide

- The engine's shape: ADR 004 (core and system modules).
- Packs and the owner's content rights: ADR 003.
- A custom domain: not planned; it would cost money.

## Consequences

- If the repository becomes private, GitHub Pages stops being free, and the move to Cloudflare
  Pages above is the way out.
- A deep link opened for the first time gets HTTP status 404 from GitHub Pages together with the
  app (`404.html`); a person sees the app. After the first visit the service worker answers.
