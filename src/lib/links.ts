import { SHORT_BASE_URL, SHORT_DOMAIN } from "@convex/lib/slugs";

export const shortUrl = (slug: string) => SHORT_BASE_URL + slug;

// Without the scheme, for display.
export const shortLabel = (slug: string) => `${SHORT_DOMAIN}/${slug}`;
