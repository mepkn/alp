// Slug and target rules, shared by the server (enforcement) and the app (hints).

// The public short-link domain. Targets on it are refused (redirect loops).
export const SHORT_DOMAIN = "alp.pknspace.com";
export const SHORT_BASE_URL = `https://${SHORT_DOMAIN}/`;

export const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const RANDOM_SLUG_LENGTH = 6;
export const MAX_TARGET_LENGTH = 2048;

// The one list of slugs that collide with app routes or files in the web
// export: Caddy serves a file when one exists, so these never reach the
// redirect. scripts/check-reserved.mts checks it against dist/web on deploy.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  // routes
  "index",
  "sign-in",
  "sign-up",
  "settings",
  "link",
  "_sitemap",
  // static files and folders
  "_expo",
  "assets",
  "favicon.ico",
  // the Convex HTTP action prefix, and room for an API
  "r",
  "api",
]);

export type SlugError = "invalidSlug" | "slugReserved";
export type TargetError = "invalidUrl" | "targetTooLong";

// Slugs match case-sensitively, so "CV" and "cv" are different links.
export function slugError(slug: string): SlugError | null {
  if (!SLUG_PATTERN.test(slug)) return "invalidSlug";
  if (RESERVED_SLUGS.has(slug)) return "slugReserved";
  return null;
}

export function targetError(target: string): TargetError | null {
  if (target.length > MAX_TARGET_LENGTH) return "targetTooLong";
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return "invalidUrl";
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return "invalidUrl";
  if (url.hostname.replace(/\.$/, "") === SHORT_DOMAIN) return "invalidUrl";
  return null;
}

const RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function randomSlug(): string {
  let slug = "";
  for (let i = 0; i < RANDOM_SLUG_LENGTH; i++) {
    slug += RANDOM_ALPHABET[Math.floor(Math.random() * RANDOM_ALPHABET.length)];
  }
  return slug;
}
