import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ...authTables,

  // Owned per user; slugs are unique across the whole app (one shared domain).
  links: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    target: v.string(),
    enabled: v.boolean(),
    clicks: v.number(),
    lastClickedAt: v.optional(v.number()), // UTC ms
    updatedAt: v.number(), // UTC ms
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"]),
});
