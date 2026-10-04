# alp — Build Spec

A private link shortener at `https://alp.pknspace.com`. **Only I can create and manage links.
Anyone can open a short link**, e.g. `alp.pknspace.com/cv` redirects to the long URL.

Sister project of `../yaad-dila` and `../scratch` (Expo + Convex). **Copy their structure, scripts and
conventions** wherever this spec doesn't say otherwise. Read yaad-dila's README, `convex/auth.ts`,
`convex/lib/allowlist.ts`, `convex/lib/access.ts`, `scripts/` and `src/components/cmp/`, and
`../scratch/SPEC.md`, before starting.

## Product

- **Redirects are public.** `GET /<slug>` returns a `302` to the target URL. An unknown or disabled
  slug returns a plain `404` page. No sign-in, no interstitial page, no JavaScript.
- **Managing links is private.** The app at `/` (after sign-in) lists my links and lets me:
  - create a link: target URL plus an optional custom slug. If no slug is given, generate a random
    6-character one from `[a-z0-9]` (retry on collision).
  - edit the target, enable or disable a link, and delete a link (with a confirm dialog).
  - copy the short URL with one tap.
  - search by slug or target. Show newest first.
- **Click counting:** each redirect increments `clicks` and sets `lastClickedAt`. No IPs, user agents,
  referrers or other analytics.
- **Slugs:**
  - 1–64 chars, `[A-Za-z0-9_-]`, matched **case-sensitively**, unique across the whole app.
  - Reserved slugs are refused because they collide with app routes or static files: `sign-in`,
    `sign-up`, `settings`, `index`, `_expo`, `assets`, `favicon.ico`, `r`, `api`, plus anything that
    is an exported route or a top-level file in `dist/`. Keep the list in one place in `convex/lib/`.
- **Targets:** must parse as an absolute `http:` or `https:` URL, max 2048 chars. Refuse targets on
  `alp.pknspace.com` itself (no redirect loops).
- **Not in v1:** expiry dates, QR codes, link passwords, tags, bulk import, detailed analytics,
  multiple domains.

## Access control (most important part)

Same as scratch:

- Convex Auth with the **Password** provider (email + password).
- **`ALLOWED_EMAILS`**, a Convex env var: a comma-separated list, case-insensitive, trimmed.
  - Checked in the Password provider's `profile()`, which runs for **both sign-up and sign-in,
    before anything is stored**.
  - Checked **again on every query and mutation** in `requireUserId`, so removing an email ends
    that user's sessions.
  - **Fails closed:** if it's unset or empty, nobody can sign in.
  - Generic `ConvexError("notAllowed")`, shown as "This account isn't allowed to use this app."
  - Copy `isAllowedEmail` from `../yaad-dila/convex/lib/allowlist.ts`, unchanged.
- Set it on **every** deployment (local and prod): `npx convex env set ALLOWED_EMAILS <email>`.
  **Ask me which email to use; don't put it in the repo.**
- **Links are owned per user** (`userId`), and management queries only return the caller's own
  links. Slugs are still globally unique, because they share one domain.
- **The redirect HTTP action is the only public endpoint.** It must only read by slug and increment
  the counter, through an `internalQuery`/`internalMutation`. No public query that lists links.
- Never trust a client-supplied user id. Look up and check ownership of every link id passed in.

## Data model

```ts
links: defineTable({
  userId: v.id("users"),
  slug: v.string(),
  target: v.string(),
  enabled: v.boolean(),
  clicks: v.number(),
  lastClickedAt: v.optional(v.number()),   // UTC ms
  updatedAt: v.number(),                   // UTC ms
})
  .index("by_slug", ["slug"])
  .index("by_user", ["userId"])
```
- Use `_id` and `_creationTime`. Index every query; no table scans.
- List with `by_user`, ordered `desc`, paginated (`usePaginatedQuery`).
- Search can filter the user's page client-side in v1. Use a search index only if it's simple.

## Convex API

- `links.list({ paginationOpts })` query: the caller's links, newest first.
- `links.create({ target, slug? })` mutation → `{ _id, slug }`.
- `links.update({ id, target?, enabled? })` mutation. The slug can't be changed; delete and recreate instead.
- `links.remove({ id })` mutation.
- `users.me()` query → `{ email }`.
- Internal: `links.resolve({ slug })` internalQuery, and `links.recordClick({ id })` internalMutation.
- `convex/http.ts`: Convex Auth routes, plus `GET /r/{slug}` (use `pathPrefix: "/r/"`):
  - It looks up the slug. If the link exists and is enabled, it records the click and returns `302` with `Location: target` and `Cache-Control: no-store`, so clicks are counted.
  - Otherwise it returns a `404` with a tiny HTML body.
- Error codes are plain-string `ConvexError`s (`notAuthenticated`, `notAllowed`, `linkNotFound`,
  `invalidUrl`, `targetTooLong`, `invalidSlug`, `slugReserved`, `slugTaken`). The client translates them like yaad-dila's `src/lib/errors.ts`.
- **Read `convex/_generated/ai/guidelines.md` before writing Convex code.**

## Screens (Expo Router)

- `(auth)/sign-in`, `(auth)/sign-up`: the same form component as yaad-dila.
- `(app)/index`: the link list, with the search box and a "New link" button.
  - Each row shows the short URL, the target (truncated), clicks, enabled state and a copy button.
- `(app)/link/new` and `(app)/link/[id]`: the form (target, slug on create only, enabled), with delete on edit.
  - These routes must be listed as reserved slugs (`link`).
- `(app)/settings`:
  - signed-in email
  - log out
  - theme: light / dark / system
- English only. Keep strings in `src/lib/strings.ts`.
- Android: **share a URL into alp** (Android share target) opens "New link" with the target
  filled in. It's optional, so build it last.

## Stack and conventions (match the other repos)

- Expo (latest SDK; read the versioned docs, don't trust memory), Expo Router, TypeScript strict.
  - One codebase for Android and web. Web uses `"output": "static"`.
- NativeWind (Tailwind v3) + React Native Reusables.
  - RNR primitives go in `src/components/ui/`.
  - Screens only use wrappers in `src/components/cmp/cmp-*.tsx`.
- Keyboard: `react-native-keyboard-controller`, with `KeyboardProvider` at the root.
  - Form screens use `CmpKeyboardAwareScrollView`, which scrolls the focused field above the keyboard.
  - A full-height editor with a bottom bar uses `CmpKeyboardPadding`.
  - Dialogs rise by half the keyboard height (in `components/ui/dialog.tsx`).
  - Lists with a search box at the top, and screens without inputs, need nothing.
  - No fixed offsets such as `mb-[40vh]`, no RN `KeyboardAvoidingView`, no bottom sheets.
- `@/` → `src/`, `@convex/` → `convex/`. Node 22.18+ (`.nvmrc` = 22).
- Scripts (copy from yaad-dila and scratch):
  - `typecheck`, `lint`, `test`, and `check` (all three)
  - `deploy:backend` (reads `CONVEX_DEPLOY_KEY` from `.env.prod.local` with the shared literal read loop)
  - `deploy:web` and `deploy:web:dry`
  - android build scripts
- **Tests (convex-test):**
  - non-allowlisted sign-in rejected
  - removed email loses access
  - user A can't list, edit or delete user B's links
  - slug validation: pattern, reserved, taken, case-sensitive
  - URL validation, including the self-domain loop
  - random slug generated when omitted
  - redirect: enabled → 302 and the click is counted; disabled or unknown → 404
  - Stub `ALLOWED_EMAILS` with `vi.stubEnv` in the test helper.
- Repo files:
  - README (same layout as yaad-dila)
  - `.env.example` (lists `ALLOWED_EMAILS` under the Convex-side vars and the deploy vars as placeholders)
  - AGENTS.md, CLAUDE.md, LICENSE
  - `.gitignore` covering `.env*.local` and `.eas-token`
- App id `com.pknspace.alp`, scheme `alp`.
- Git remote: `https://github.com/mepkn/alp`.

## Deployment

- **Backend:** a new Convex project `alp`.
  - Set `JWT_PRIVATE_KEY` and `JWKS` (`npx @convex-dev/auth`), `SITE_URL`, and `ALLOWED_EMAILS` on prod.
- **Web app:** deploy it the same way as scratch and akinator:
  - `npx expo export -p web` produces `dist/`.
  - `scripts/deploy-web.sh` runs check, the export, and `rsync -avz --delete dist/` over SSH to `DEPLOY_DIR`.
  - `DEPLOY_HOST`, `DEPLOY_PORT` and `DEPLOY_DIR` live in `.env.prod.local`. Never write the VPS host, IP or port into tracked files.
- **How one domain serves both the app and the redirects:**
  - The system Caddy serves a file when one exists in `/var/www/alp`.
  - Every other path is proxied to the Convex HTTP action at `/r/<slug>`.
  - Proxying through Caddy means Convex's paid custom-domain feature isn't needed.
  - One-time VPS setup (done by me; needs sudo):
    - `DEPLOY_DIR=/var/www/alp`, owned by the deploy user.
    - Replace `<prod>` with the prod deployment name and add this block to `/etc/caddy/Caddyfile`:
    ```caddy
    http://alp.pknspace.com:8080 {
          root * /var/www/alp
          encode gzip

          @static file {path} {path}.html {path}/index.html
          handle @static {
                try_files {path} {path}.html {path}/index.html
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
    - Add a cloudflared Public Hostname `alp.pknspace.com` → `http://localhost:8080`.
    - Don't try to run sudo; give me the exact one-line command to run.
  - Dynamic routes such as `link/[id]` have no file per id. Do one of these, and test it with `curl` after the first deploy:
    - make the page work as a client-side route under a fixed path, e.g. `/link?id=...`
    - add a matching `@static` rule
- **Android:** EAS under my personal Expo account. Run `source .eas-token` (git-ignored).
  **Never log out or replace the global eas login.** Prefer local builds into `dist/`.

## Rules for the agent

- No AI attribution or Co-Authored-By lines in commits or PRs.
- Never print secrets: deploy keys, tokens, `.env.prod.local` values, VPS details.
- Commit, push or deploy only when I ask.
