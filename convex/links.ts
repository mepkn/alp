import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type QueryCtx,
} from "./_generated/server";
import { requireUserId } from "./lib/access";
import { randomSlug, slugError, targetError } from "./lib/slugs";
import schema from "./schema";

const linkDoc = schema.doc("links");

// Never trusts the id alone: a link that isn't the caller's is "not found".
async function requireOwnLink(ctx: QueryCtx, userId: Id<"users">, id: Id<"links">) {
  const link = await ctx.db.get("links", id);
  if (link === null || link.userId !== userId) throw new ConvexError("linkNotFound");
  return link;
}

function findBySlug(ctx: QueryCtx, slug: string) {
  return ctx.db
    .query("links")
    .withIndex("by_slug", (q) => q.eq("slug", slug))
    .unique();
}

function checkTarget(target: string) {
  const error = targetError(target);
  if (error) throw new ConvexError(error);
}

// The caller's links, newest first.
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(linkDoc),
  handler: async (ctx, { paginationOpts }) => {
    const userId = await requireUserId(ctx);
    return await ctx.db
      .query("links")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .paginate(paginationOpts);
  },
});

// One of the caller's links, or null if it's gone or someone else's.
export const get = query({
  args: { id: v.id("links") },
  returns: v.union(v.null(), linkDoc),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    const link = await ctx.db.get("links", id);
    return link !== null && link.userId === userId ? link : null;
  },
});

const RANDOM_SLUG_ATTEMPTS = 10;

export const create = mutation({
  args: { target: v.string(), slug: v.optional(v.string()) },
  returns: v.object({ _id: v.id("links"), slug: v.string() }),
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const target = args.target.trim();
    checkTarget(target);

    let slug: string;
    const requested = args.slug?.trim();
    if (requested) {
      const error = slugError(requested);
      if (error) throw new ConvexError(error);
      if ((await findBySlug(ctx, requested)) !== null) throw new ConvexError("slugTaken");
      slug = requested;
    } else {
      let found: string | undefined;
      for (let i = 0; i < RANDOM_SLUG_ATTEMPTS && found === undefined; i++) {
        const candidate = randomSlug();
        if (slugError(candidate) === null && (await findBySlug(ctx, candidate)) === null) {
          found = candidate;
        }
      }
      if (found === undefined) throw new ConvexError("slugTaken");
      slug = found;
    }

    const _id = await ctx.db.insert("links", {
      userId,
      slug,
      target,
      enabled: true,
      clicks: 0,
      updatedAt: Date.now(),
    });
    return { _id, slug };
  },
});

// The slug can't change: delete and recreate instead.
export const update = mutation({
  args: { id: v.id("links"), target: v.optional(v.string()), enabled: v.optional(v.boolean()) },
  returns: v.null(),
  handler: async (ctx, { id, target, enabled }) => {
    const userId = await requireUserId(ctx);
    await requireOwnLink(ctx, userId, id);
    const patch: { target?: string; enabled?: boolean; updatedAt: number } = {
      updatedAt: Date.now(),
    };
    if (target !== undefined) {
      patch.target = target.trim();
      checkTarget(patch.target);
    }
    if (enabled !== undefined) patch.enabled = enabled;
    await ctx.db.patch("links", id, patch);
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("links") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const userId = await requireUserId(ctx);
    await requireOwnLink(ctx, userId, id);
    await ctx.db.delete("links", id);
    return null;
  },
});

// Used only by the public redirect in http.ts: reads by slug, nothing else.
export const resolve = internalQuery({
  args: { slug: v.string() },
  returns: v.union(v.null(), v.object({ id: v.id("links"), target: v.string() })),
  handler: async (ctx, { slug }) => {
    const link = await findBySlug(ctx, slug);
    if (link === null || !link.enabled) return null;
    return { id: link._id, target: link.target };
  },
});

export const recordClick = internalMutation({
  args: { id: v.id("links") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const link = await ctx.db.get("links", id);
    if (link === null) return null;
    await ctx.db.patch("links", id, { clicks: link.clicks + 1, lastClickedAt: Date.now() });
    return null;
  },
});
