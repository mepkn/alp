import { SHORT_BASE_URL, SHORT_DOMAIN } from "@convex/lib/slugs";

export const shortUrl = (slug: string) => SHORT_BASE_URL + slug;

// Without the scheme, for display.
export const shortLabel = (slug: string) => `${SHORT_DOMAIN}/${slug}`;

// Links fetched per "Load more", in the list and in search alike.
export const PAGE_SIZE = 30;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

// "5 minutes ago", "yesterday", "just now".
export function timeAgo(ms: number, now = Date.now()): string {
  const seconds = Math.round((ms - now) / 1000);
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "just now";
}
