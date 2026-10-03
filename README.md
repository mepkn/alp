# alp

A private link shortener at <https://alp.pknspace.com>. Only allowlisted emails can create and
manage links; anyone can open a short link, e.g. `alp.pknspace.com/cv` redirects to the long URL.

Platforms: web (static export on the VPS) and Android (sideloaded APK).

## Features

- **Public redirects.** `GET /<slug>` returns a `302` to the target, with `Cache-Control: no-store` so every visit is counted. Unknown or disabled slugs get a plain `404` page. No sign-in, interstitial or JavaScript.
- **Private management** after sign-in: create (custom slug or a random 6-character one), edit the target, enable or disable, delete (with a confirmation), copy the short URL with one tap.
- Search by slug or target; newest first.
- Click count and last-click time per link. No IPs, user agents, referrers or other analytics.
- Slugs: 1–64 of `[A-Za-z0-9_-]`, case-sensitive, unique across the app. App routes and static files are reserved.
- Targets: absolute `http:`/`https:` URLs up to 2048 characters, never on `alp.pknspace.com` itself.
- Light, dark or system theme.

## Stack

Expo (SDK 57) · Expo Router · TypeScript · NativeWind + React Native Reusables ·
Convex (database, auth, HTTP redirect) · Convex Auth (password).

## Development

Requires Node 22.18+ (`.nvmrc` pins 22).

### 1. Install and run Convex locally

```sh
npm install
npx convex dev            # first run: choose a local deployment (no account needed)
```

This writes `EXPO_PUBLIC_CONVEX_URL` to `.env.local`. Keep it running; it redeploys whenever `convex/` changes.

> **Phone vs. local backend:** `127.0.0.1` on a phone is the phone itself.
> - **Android emulator:** set `EXPO_PUBLIC_CONVEX_URL=http://10.0.2.2:3210`.
> - **USB device:** run `adb reverse tcp:3210 tcp:3210` and `adb reverse tcp:3211 tcp:3211`.
> - **Device on the same Wi-Fi:** use your computer's LAN IP.
>
> Restart Metro after changing `.env.local`.

### 2. Configure Convex Auth (once per deployment)

```sh
npx @convex-dev/auth      # interactive: generates JWT_PRIVATE_KEY + JWKS
npx convex env set SITE_URL http://localhost:8081
npx convex env set ALLOWED_EMAILS you@example.com   # comma-separated; nobody else can sign up or sign in
```

`ALLOWED_EMAILS` fails closed: if it's unset, every sign-up, sign-in and API call is refused.

### 3. Run the app

```sh
npm run web                      # browser
npm run android                  # build and install a development build on a USB phone
npx expo start --dev-client      # Metro for the development build
```

## Scripts

| Command | What it does |
|---|---|
| `npx convex dev` | Local Convex backend with hot reload |
| `npm run web` | Metro for the browser |
| `npm run android` | Build and install the development build on a USB phone |
| `npm run typecheck` | App and `convex/` typecheck |
| `npm run lint` | ESLint (Expo config) |
| `npm test` | convex-test: allowlist, ownership, slug and URL rules, redirect |
| `npm run check` | Typecheck, lint and tests |
| `npm run icons` | Regenerate the app icon and splash images |
| `npm run build:web` | Static web export into `dist/web/` |
| `npm run deploy:backend` | Checks, then deploys `convex/` to production |
| `npm run deploy:web` | Checks, exports the web app, checks reserved slugs, rsyncs `dist/web/` to the VPS |
| `npm run deploy:web:dry` | The same, but rsync only shows what would change |
| `npm run build:android:preview` | Installable APK, built on EAS cloud |
| `npm run build:android:preview:local` | The same APK, built on this Mac into `dist/` |
| `npm run build:android:production` | Play Store AAB on EAS cloud |
| `npm run build:android:production:local` | The same AAB, built locally into `dist/` |
| `npm run eas -- <args>` | Any other `eas` command as the personal account |

## Deployment

Three parts: the Convex production deployment (project `alp`), the static web app on the VPS,
and the Android app built with EAS.

### One-time setup

- `.env.prod.local` (git-ignored) holds `CONVEX_DEPLOY_KEY`, the production `EXPO_PUBLIC_CONVEX_URL`
  and `DEPLOY_HOST` / `DEPLOY_PORT` / `DEPLOY_DIR`. See `.env.example`. The scripts read it
  line by line as literal `KEY=VALUE`; it is never sourced.
- `.eas-token` (git-ignored) holds `export EXPO_TOKEN=...` for the personal Expo account. The scripts read it, so the global `eas` login is never used or changed.
- On the production Convex deployment: `JWT_PRIVATE_KEY`, `JWKS` (`npx @convex-dev/auth --prod`),
  `SITE_URL=https://alp.pknspace.com` and `ALLOWED_EMAILS`.
- The EAS environments `preview` and `production` have `EXPO_PUBLIC_CONVEX_URL` set to the production URL.
- VPS: `DEPLOY_DIR=/var/www/alp`, owned by the deploy user. System Caddy block, with `<prod>`
  replaced by the production deployment name:

  ```caddy
  http://alp.pknspace.com:8080 {
        root * /var/www/alp
        encode gzip

        @static file {path} {path}.html {path}/index.html
        handle @static {
              try_files {path} {path}.html {path}/index.html
              file_server
        }

        # The edit screen is one exported page for every id.
        @edit path_regexp ^/link/[^/]+$
        handle @edit {
              rewrite * /link/[id].html
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

  A file in the export wins (`{path}.html` because Expo writes routes as `sign-in.html` etc.);
  every other path goes to the Convex redirect at `/r/<slug>`, so Convex's custom-domain feature
  isn't needed. Slugs can't contain `/`, so `/link/<id>` never shadows one.
  A cloudflared Public Hostname maps `alp.pknspace.com` → `http://localhost:8080`.

### Backend

```sh
npm run deploy:backend    # checks, then npx convex deploy to production
```

### Web

```sh
npm run deploy:web:dry    # see what would change
npm run deploy:web        # checks, export, reserved-slug check, rsync --delete
```

After a deploy, check both halves of the domain:

```sh
curl -sI https://alp.pknspace.com/sign-in | head -1          # 200, the app
curl -sI https://alp.pknspace.com/link/abc | head -1         # 200, the edit page
curl -sI https://alp.pknspace.com/<a-slug> | grep -i -e ^HTTP -e ^location   # 302
curl -sI https://alp.pknspace.com/no-such-slug | head -1     # 404
```

### Android

```sh
npm run build:android:preview:local
adb install -r dist/alp-preview-*.apk
```

## How it works

- **The app** (`src/`) uses Expo Router, NativeWind and React Native Reusables. The RNR primitives live in `src/components/ui/`, and screens only use the app's own wrappers in `src/components/cmp/cmp-*.tsx`. All strings are in `src/lib/strings.ts`.
  - `(app)/index`: the paginated list (`usePaginatedQuery`) with a client-side search over the loaded pages.
  - `(app)/link/new` (accepts `?target=`) and `(app)/link/[id]`: the shared `LinkForm`.
- **Convex** (`convex/`) is the entire backend.
  - `schema.ts`: `links` (`by_slug`, `by_user`), plus the Convex Auth tables.
  - `auth.ts`: Convex Auth with the Password provider. `profile()` runs for sign-up and sign-in before anything is stored and refuses emails not in `ALLOWED_EMAILS` with a generic `notAllowed`. `lib/access.ts` `requireUserId` re-checks the list on every call, so removing an email also ends that user's sessions.
  - `links.ts`: `list`, `get`, `create`, `update`, `remove` for the signed-in owner; every id passed in is loaded and its `userId` checked (`linkNotFound` otherwise). `resolve` (internalQuery) and `recordClick` (internalMutation) serve the redirect only.
  - `lib/slugs.ts`: the slug pattern, the one reserved-slug list, target validation and the random slug. `scripts/check-reserved.mts` fails the web deploy if a new top-level route or file isn't reserved.
  - `http.ts`: the Convex Auth routes and `GET /r/{slug}`, the only public endpoint.
  - `users.ts`: `me`, for the email in Settings.
- **Auth tokens** are kept in `expo-secure-store` on Android and `localStorage` on web.
