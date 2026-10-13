import { SHORT_BASE_URL, SHORT_DOMAIN } from "@convex/lib/slugs";

export const shortUrl = (slug: string) => SHORT_BASE_URL + slug;

// Without the scheme, for display.
export const shortLabel = (slug: string) => `${SHORT_DOMAIN}/${slug}`;

// Links fetched per scroll step, on the Links and Search tabs alike.
export const PAGE_SIZE = 30;
