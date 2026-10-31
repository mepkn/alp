import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { findKunjiUser, type KunjiTool } from "./lib/kunji";
import { SHORT_BASE_URL } from "./lib/slugs";
import { searchWords } from "./links";

// Alp's tools for kunji (kunji SPEC.md → App contract). Each runs as the user
// kunji named and only ever sees that user's links.

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const iso = (ms: number | undefined) => (ms === undefined ? null : new Date(ms).toISOString());

function summary(link: Doc<"links">) {
  return {
    slug: link.slug,
    shortUrl: SHORT_BASE_URL + link.slug,
    target: link.target,
    enabled: link.enabled,
    clicks: link.clicks,
    lastClickedAt: iso(link.lastClickedAt),
    createdAt: iso(link._creationTime),
  };
}

export const access = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, { email }) => await findKunjiUser(ctx, email),
});

export const listLinks = internalQuery({
  args: { userId: v.id("users"), query: v.optional(v.string()), limit: v.number() },
  handler: async (ctx, { userId, query, limit }) => {
    const n = Math.min(Math.max(Math.trunc(limit), 1), MAX_LIMIT);
    const words = searchWords(query ?? "");
    const rows = words
      ? await ctx.db
          .query("links")
          .withSearchIndex("search_text", (q) => q.search("searchText", words).eq("userId", userId))
          .take(n + 1)
      : await ctx.db
          .query("links")
          .withIndex("by_user", (q) => q.eq("userId", userId))
          .order("desc")
          .take(n + 1);
    return { links: rows.slice(0, n).map(summary), more: rows.length > n };
  },
});

export const tools: KunjiTool[] = [
  {
    name: "list_links",
    description:
      `List the user's Alp short links (${SHORT_BASE_URL}<slug> redirects to the target URL). ` +
      "Without a query: newest first. With a query: links whose slug or target URL contain those words " +
      "(the last word matches as a prefix), best match first. Each link has its slug, short URL, target, " +
      "whether it is enabled (a disabled link doesn't redirect), click count, last click and creation time. " +
      "`more` is true when there are more links than returned.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to find in the slug or target URL, e.g. \"github\"." },
        limit: { type: "integer", description: `How many links to return, 1–${MAX_LIMIT} (default ${DEFAULT_LIMIT}).` },
      },
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runQuery(internal.kunji.listLinks, {
        userId,
        query: input.query as string | undefined,
        limit: (input.limit as number | undefined) ?? DEFAULT_LIMIT,
      }),
  },
];
