# Running Grimoire

How to install, run, test and deploy. Every command runs from the repository root unless it says
otherwise. Written by SETUP-09; the facts below were measured on 2026-09-28.

---

## What you need

- Node 22 (`.nvmrc`).
- pnpm 10.33.0 (`packageManager` in `package.json`).

## Install

```
pnpm install --frozen-lockfile
```

## Run the app

| Command | What it does | Address |
|---|---|---|
| `pnpm --filter @grimoire/web dev` | Development server, reloads on every save. No service worker. | `http://localhost:5173/MythWeld/` |
| `pnpm build` | Builds every project; the app goes to `apps/web/dist`. | — |
| `pnpm --filter @grimoire/web preview` | Serves the built app, service worker included. | `http://localhost:4173/MythWeld/` |

The app lives under `/MythWeld/` everywhere, because GitHub Pages serves it there. The path is
written once, as `APP_BASE_PATH` in `apps/web/src/config/app.ts`.

## Test

The quality gate (`CLAUDE.md`):

```
pnpm lint && pnpm typecheck && pnpm test
```

A change to `apps/web` also runs:

```
pnpm e2e
```

- `pnpm test` runs Vitest once over every project's `test/` folder.
- `pnpm e2e` builds the app, serves it with `vite preview` under `/MythWeld/`, and runs Playwright
  on one project, `pixel-7`, at 360×800.
- Screenshots land in `apps/web/test-results/`. That folder is git-ignored; screenshots are shown
  in the chat, never committed.
- `apps/web/public/schema/5e/pack.schema.json`, the published pack JSON Schema, is written by its
  test. After a schema change `pnpm test` fails there; this rewrites the file, which is committed
  with the change:

  ```
  pnpm vitest run apps/web/test/pack-schema.test.ts --update
  ```

### Playwright's browser

- **In the cloud container** Chromium is preinstalled and downloads are blocked. Point Playwright
  at it:

  ```
  PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm e2e
  ```

  Without the variable Playwright looks for its own browser build, which is not installed there.
- **Anywhere else** Playwright uses its own browser. Its standard install command is
  `pnpm --filter @grimoire/web exec playwright install chromium`. It has not been run in the cloud
  container, which has no need for it.

### Two things the cloud container shows that are not the app

- Chromium itself tries to reach `www.google.com` and `android.clients.google.com` in the
  background, and the container's proxy refuses. The app makes no such request: the e2e test
  `SETUP-07 after the first visit the app opens offline` fails on any request to another origin.
- The container cannot reach `alinault.github.io` unless that host is added to the environment's
  allowed domains. The public site is checked from GitHub's runner instead (below).

## Deploy

- Every push to `main` runs `.github/workflows/ci.yml`:
  1. job `check`: install, lint, typecheck, test, build, then `404.html` (a copy of `index.html`)
     and the upload of `apps/web/dist`;
  2. job `deploy`, only when `check` passed: publishes to GitHub Pages, then fetches the page,
     `manifest.webmanifest`, `sw.js` and `/MythWeld/dice` from the public address.
- The public link: `https://alinault.github.io/MythWeld/`. The fifth-edition pack's JSON Schema is
  at `schema/5e/pack.schema.json` under it.
- The result is on GitHub under Actions → CI; the `deploy` job's last step prints the answers it
  got, for example `page 200, manifest 200, sw.js 200, dice 404`. The `404` for `dice` is
  expected: GitHub Pages sends `404.html`, which is the app.
- One-time setting, already made by the owner: repository Settings → Pages → Source: GitHub Actions.

### Moving to another host

Set `APP_BASE_PATH` to the new path (`'/'` at the root of a domain), and replace the `404.html`
step and the `deploy` job with the new host's own. ADR 001 says why GitHub Pages was chosen.
