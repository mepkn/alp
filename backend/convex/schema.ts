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
    // slug and target split into words, kept in step by create/update for the search index.
    searchText: v.string(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"])
    .searchIndex("search_text", { searchField: "searchText", filterFields: ["userId"] }),
});
