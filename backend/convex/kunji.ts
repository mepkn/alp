import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { findKunjiUser, type KunjiTool } from "./lib/kunji";
import { MAX_TARGET_LENGTH, SHORT_BASE_URL } from "./lib/slugs";
import { findBySlug, insertLink, searchWords } from "./links";

// Alp's tools for kunji (kunji SPEC.md → App contract). Each runs as the user
// kunji named and only ever sees that user's links. Writes: shorten_url
// (same code as the app's New link) and set_link_enabled; nothing edits a
// target or deletes a link.

// The app's error codes, as sentences for the model.
const MESSAGES: Record<string, string> = {
  invalidUrl: "The URL must be a full http:// or https:// URL that isn't an alp link.",
  targetTooLong: `The URL is over ${MAX_TARGET_LENGTH} characters.`,
  invalidSlug: "A slug is 1–64 letters, digits, - or _.",
  slugReserved: "That slug is reserved by the app; pick another.",
  slugTaken: "That slug is already taken; pick another or leave it out for a random one.",
};

async function asSentence<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ConvexError && typeof err.data === "string" && MESSAGES[err.data]) {
      throw new ConvexError(MESSAGES[err.data]);
    }
    throw err;
  }
}

async function ownLinkBySlug(ctx: MutationCtx, userId: Doc<"users">["_id"], slug: string) {
  const link = await findBySlug(ctx, slug.trim());
  if (link === null || link.userId !== userId) {
    throw new ConvexError(`You have no link with the slug "${slug.trim()}" (slugs are case-sensitive).`);
  }
  return link;
}

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

export const shortenUrl = internalMutation({
  args: { userId: v.id("users"), url: v.string(), slug: v.optional(v.string()) },
  handler: async (ctx, { userId, url, slug }) =>
    await asSentence(async () => {
      const link = await insertLink(ctx, userId, url, slug);
      return { slug: link.slug, shortUrl: SHORT_BASE_URL + link.slug, target: link.target };
    }),
});

export const setLinkEnabled = internalMutation({
  args: { userId: v.id("users"), slug: v.string(), enabled: v.boolean() },
  handler: async (ctx, { userId, slug, enabled }) => {
    const link = await ownLinkBySlug(ctx, userId, slug);
    if (link.enabled !== enabled) await ctx.db.patch("links", link._id, { enabled, updatedAt: Date.now() });
    return { slug: link.slug, shortUrl: SHORT_BASE_URL + link.slug, enabled, changed: link.enabled !== enabled };
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
  {
    name: "shorten_url",
    description:
      `Create an Alp short link (${SHORT_BASE_URL}<slug>) that redirects to a URL. Give a slug ` +
      "(1–64 letters, digits, - or _; case-sensitive) or leave it out for a random 6-character one. " +
      "Refused if the slug is taken or reserved, or the URL isn't a full http(s) URL. The same URL may be " +
      "shortened more than once. Returns the slug, short URL and target.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The full http:// or https:// URL to redirect to." },
        slug: { type: "string", description: "Optional custom slug, e.g. \"cv\"." },
      },
      required: ["url"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runMutation(internal.kunji.shortenUrl, {
        userId,
        url: input.url as string,
        slug: input.slug as string | undefined,
      }),
  },
  {
    name: "set_link_enabled",
    description:
      "Turn one of the user's Alp short links on or off by its slug (case-sensitive). A disabled link " +
      "stops redirecting (visitors get a not-found page) but keeps its slug, target and clicks, and can be " +
      "turned back on. Returns the slug, short URL, the new state and whether it changed.",
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "The link's slug, as list_links shows it." },
        enabled: { type: "boolean", description: "true to turn the link on, false to turn it off." },
      },
      required: ["slug", "enabled"],
      additionalProperties: false,
    },
    handler: async (ctx, userId, input) =>
      await ctx.runMutation(internal.kunji.setLinkEnabled, {
        userId,
        slug: input.slug as string,
        enabled: input.enabled as boolean,
      }),
  },
];
