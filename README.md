# alp

A private link shortener at <https://alp.pknspace.com>. Only allowlisted emails can create and
manage links; anyone can open a short link, e.g. `alp.pknspace.com/cv` redirects to the long URL.

Platforms: web (a Vite SPA in `web/`, on the VPS) and Android (Expo in `mobile/`, sideloaded APK).
The Convex backend in `backend/` serves both. There is no root `package.json`: `cd` into a part to run its scripts.

## Features

- **Public redirects.** `GET /<slug>` returns a `302` to the target, with `Cache-Control: no-store` so every visit is counted. Unknown or disabled slugs get a plain `404` page. No sign-in, interstitial or JavaScript.
- **Private management** after sign-in: create (custom slug or a random 6-character one), edit the target, enable or disable, delete (with a confirmation), copy the short URL with one tap.
- Links list, newest first, and a Search tab that searches all links by slug or target on the server.
- Click count and last-click time per link. No IPs, user agents, referrers or other analytics.
- Slugs: 1–64 of `[A-Za-z0-9_-]`, case-sensitive, unique across the app. App routes and static files are reserved.
- Targets: absolute `http:`/`https:` URLs up to 2048 characters, never on `alp.pknspace.com` itself.
- Android: share a URL from any app into alp, and New link opens with it filled in.
- Light, dark or system theme.

## Stack

Android: Expo (SDK 57) · Expo Router · NativeWind + React Native Reusables ·
Web: React 19 · Vite · Tailwind CSS v4 · shadcn/ui (Base UI) ·
TypeScript · Convex (database, auth, HTTP redirect) · Convex Auth (password).

## Development

Requires Node 22.18+ (`.nvmrc` pins 22).

### 1. Install and run Convex locally

```sh
(cd mobile && npm install)   # each part has its own node_modules
(cd web && npm install)
cd backend && npm install    # backend: convex, tests
printf 'EXPO_PUBLIC_CONVEX_URL=\nEXPO_PUBLIC_CONVEX_SITE_URL=\n' > .env.local   # first time only
npm run dev                  # first run: choose a local deployment (no account needed)
```

This writes `EXPO_PUBLIC_CONVEX_URL` to `backend/.env.local` (the empty line tells it the name;
there's no Expo in `backend/`, so it would otherwise write `CONVEX_URL`). Both apps read this one
file. Keep it running; it redeploys whenever `backend/convex/` changes. The other env files are
described in `backend/.env.example` and `web/.env.example`.

> **Phone vs. local backend:** `127.0.0.1` on a phone is the phone itself.
> - **Android emulator:** set `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`.
> - **USB device:** run `adb reverse tcp:3210 tcp:3210` and `adb reverse tcp:3211 tcp:3211`.
> - **Device on the same Wi-Fi:** use your computer's LAN IP.
>
> Restart Metro after changing `backend/.env.local`.

### 2. Configure Convex Auth (once per deployment)

```sh
cd backend
npx @convex-dev/auth      # interactive: generates JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL http://localhost:5173
npx convex env set ALLOWED_EMAILS you@example.com   # comma-separated; nobody else can sign up or sign in
```

`ALLOWED_EMAILS` fails closed: if it's unset, every sign-up, sign-in and API call is refused.

### 3. Run the app

```sh
cd web && npm run dev            # web app on http://localhost:5173
cd mobile && npm run android     # build and install a development build on a USB phone
cd mobile && npm start           # Metro for the development build
```

## Scripts

| Command | What it does |
|---|---|
| `backend/`: `npm run dev` | Local Convex backend with hot reload |
| `backend/`: `npm run typecheck` | `convex/` typecheck |
| `backend/`: `npm run lint` | ESLint for `convex/` |
| `backend/`: `npm test` | convex-test: allowlist, ownership, slug and URL rules, redirect |
| `backend/`: `npm run check` | Typecheck, lint and tests |
| `mobile/`: `npm start` | Metro for the development build, with `backend/.env.local` |
| `mobile/`: `npm run android` | Build and install the development build on a USB phone |
| `mobile/`: `npm run icons` | Regenerate the app icon and splash images in `mobile/assets/images` |
| `web/`: `npm run dev` | Vite dev server for the web app |
| `scripts/check.sh` | `npm run check` in `backend/`, `mobile/` and `web/` |
| `scripts/deploy-backend.sh` | Checks, then deploys `backend/convex/` to production (`DRY_RUN=1` previews) |
| `scripts/deploy-web.sh` | Checks, builds `web/`, checks reserved slugs, rsyncs `web/dist/` to the VPS |
| `DRY_RUN=1 scripts/deploy-web.sh` | The same, but rsync only shows what would change |
| `scripts/build-android.sh preview cloud` | Installable APK, built on EAS cloud |
| `scripts/build-android.sh preview local` | The same APK, built on this Mac into `mobile/dist/` |
| `scripts/build-android.sh production cloud` | Play Store AAB on EAS cloud |
| `scripts/build-android.sh production local` | The same AAB, built locally into `mobile/dist/` |
| `scripts/eas.sh <args>` | Any other `eas` command as the personal account |

## Deployment

Three parts: the Convex production deployment (project `alp`), the static web app on the VPS,
and the Android app built with EAS.

### One-time setup

- `backend/.env.prod.local` (git-ignored) holds `CONVEX_DEPLOY_KEY`; `web/.env.prod.local` holds
  the production `VITE_CONVEX_URL` and `DEPLOY_HOST` / `DEPLOY_PORT` / `DEPLOY_DIR`. See the
  `.env.example` next to each. The scripts read them line by line as literal `KEY=VALUE`; they
  are never sourced. Deploy key, run in `backend/`:
  `npx convex deployment token create alp-deploy --deployment praveen-nirmalkar:alp:production --save-env .env.prod.local`.
- `mobile/.eas-token` (git-ignored) holds `export EXPO_TOKEN=...` for the personal Expo account. The scripts read it, so the global `eas` login is never used or changed.
- On the production Convex deployment: `JWT_PRIVATE_KEY`, `JWKS` (`npx @convex-dev/auth --prod`),
  `SITE_URL=https://alp.pknspace.com` and `ALLOWED_EMAILS`.
- The EAS environments `preview` and `production` have `EXPO_PUBLIC_CONVEX_URL` set to the production URL.
- VPS: `DEPLOY_DIR=/var/www/alp`, owned by the deploy user. System Caddy block, with `<prod>`
  replaced by the production deployment name:

  ```caddy
  http://alp.pknspace.com:8080 {
        root * /var/www/alp
        encode gzip

        @static file {path} {path}/index.html
        handle @static {
              try_files {path} {path}/index.html
              file_server
        }

        handle {
              rewrite * /r{path}
              reverse_proxy https://<prod>.convex.site {
                    header_up Host {upstream_hostport}
              }
        }
  }
  ```

  A file in the build wins (`/`, `/assets/…`, `/favicon.svg`); the web app is a single page with
  no client-side routes, so every other path goes to the Convex redirect at `/r/<slug>` and
  Convex's custom-domain feature isn't needed.
  A cloudflared Public Hostname maps `alp.pknspace.com` → `http://localhost:8080`.

### Backend

```sh
scripts/deploy-backend.sh    # checks, then npx convex deploy to production
```

### Web

```sh
DRY_RUN=1 scripts/deploy-web.sh   # see what would change
scripts/deploy-web.sh             # checks, vite build, reserved-slug check, rsync --delete
```

After a deploy, check both halves of the domain:

```sh
curl -sI https://alp.pknspace.com/ | head -1                 # 200, the app
curl -sI https://alp.pknspace.com/<a-slug> | grep -i -e ^HTTP -e ^location   # 302
curl -sI https://alp.pknspace.com/no-such-slug | head -1     # 404
```

### Android

```sh
scripts/build-android.sh preview local
adb install -r mobile/dist/alp-preview-*.apk
```

## How it works

- **The web app** (`web/`) is a separate Vite + React + shadcn/ui app with its own `package.json`: one page with the links list, server search, and create/edit in a dialog. It imports the backend from `../backend/convex` through the `@convex` alias (`web/vite.config.ts` dedupes `convex` and `react` so the backend uses the web copies). In dev it reads `EXPO_PUBLIC_CONVEX_URL` from `backend/.env.local`; `scripts/deploy-web.sh` passes the production URL as `VITE_CONVEX_URL`.
- **The Android app** (`mobile/`, own `package.json`) uses Expo Router, NativeWind and React Native Reusables. The RNR primitives live in `mobile/src/components/ui/`, and screens only use the app's own wrappers in `mobile/src/components/cmp/cmp-*.tsx`. All strings are in `mobile/src/lib/strings.ts`. It imports the backend through the `@convex` alias; `mobile/metro.config.js` watches `../backend/convex` and resolves its packages from `mobile/node_modules`, so EAS builds need only the `mobile/` install. Its scripts load `backend/.env.local` with `node --env-file-if-exists`.
  - `(app)/(tabs)`: Links and Search tabs (a labelled left sidebar from 768px wide).
  - `(app)/(tabs)/index`: the paginated list (`usePaginatedQuery`), loading more on scroll.
  - `(app)/(tabs)/search`: debounced, paginated server search (`links.search`, search index `search_text`).
  - `(app)/link/new` (accepts `?target=`) and `(app)/link/[id]`: the shared `LinkForm`.
- **Convex** (`backend/convex/`) is the entire backend.
  - `schema.ts`: `links` (`by_slug`, `by_user`), plus the Convex Auth tables.
  - `auth.ts`: Convex Auth with the Password provider. `profile()` runs for sign-up and sign-in before anything is stored and refuses emails not in `ALLOWED_EMAILS` with a generic `notAllowed`. `lib/access.ts` `requireUserId` re-checks the list on every call, so removing an email also ends that user's sessions.
  - `links.ts`: `list`, `get`, `create`, `update`, `remove` for the signed-in owner; every id passed in is loaded and its `userId` checked (`linkNotFound` otherwise). `resolve` (internalQuery) and `recordClick` (internalMutation) serve the redirect only.
  - `lib/slugs.ts`: the slug pattern, the one reserved-slug list, target validation and the random slug. `scripts/check-reserved.mts` fails the web deploy if a new top-level file in `web/dist` isn't reserved. The old Expo route names stay reserved so existing links are unaffected.
  - `http.ts`: the Convex Auth routes and `GET /r/{slug}`, the only public endpoint.
  - `users.ts`: `me`, for the email in Settings.
- **Share target** (Android): `expo-share-intent` registers a `SEND text/*` intent filter. The root layout takes the first `http(s)` URL from the shared text (`mobile/src/lib/share.ts`) and opens `/link/new?target=…`; a share that arrives signed out waits until sign-in. `+native-intent.tsx` keeps the share deep link from hitting not-found.
- **Auth tokens** are kept in `expo-secure-store` on Android and `localStorage` in the web app.
