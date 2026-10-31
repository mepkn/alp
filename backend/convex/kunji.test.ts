/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import schema from "./schema";
import type { Doc, Id } from "./_generated/dataModel";
import { checkInput, secretMatches } from "./lib/kunji";
import { searchWords } from "./links";

const modules = import.meta.glob("./**/*.ts");
const SECRET = "kjs_test-secret";
const ME = "me@example.com";
const NOW = Date.UTC(2026, 9, 31, 9, 0);

beforeEach(() => {
  vi.stubEnv("KUNJI_SECRET", SECRET);
  vi.stubEnv("ALLOWED_EMAILS", `${ME},stranger@example.com`);
});
afterEach(() => vi.unstubAllEnvs());

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 });
    // An unverified sign-up with someone else's email must never count.
    await ctx.db.insert("users", { email: "other@example.com" });
    const strangerId = await ctx.db.insert("users", { email: "stranger@example.com", emailVerificationTime: 1 });
    const link = (userId: Id<"users">, slug: string, target: string, extra: Partial<Doc<"links">> = {}) =>
      ctx.db.insert("links", {
        userId, slug, target, enabled: true, clicks: 0, updatedAt: NOW,
        searchText: searchWords(`${slug} ${target}`), ...extra,
      });
    await link(strangerId, "secret", "https://github.com/stranger/secret");
    await link(userId, "gh", "https://github.com/mepkn", { clicks: 7, lastClickedAt: NOW });
    await link(userId, "cv", "https://example.com/cv.pdf", { enabled: false });
    await link(userId, "docs", "https://docs.example.com/start");
    return { userId, strangerId };
  });
  return { t, ...ids };
}

const post = (body: unknown, secret = SECRET) => ({
  method: "POST",
  headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

type T = Awaited<ReturnType<typeof setup>>["t"];
async function call(t: T, tool: string, input: unknown = {}, userEmail = ME) {
  const res = await t.fetch("/kunji/call", post({ tool, input, userEmail }));
  expect(res.status).toBe(200);
  return await res.json();
}

describe("secret check", () => {
  it("compares exactly", async () => {
    expect(await secretMatches(SECRET, SECRET)).toBe(true);
    expect(await secretMatches(SECRET + "x", SECRET)).toBe(false);
    expect(await secretMatches("", "")).toBe(false);
  });

  it.each([
    ["GET", "/kunji/tools"],
    ["POST", "/kunji/access"],
    ["POST", "/kunji/call"],
  ])("%s %s refuses a wrong or missing secret", async (method, path) => {
    const { t } = await setup();
    const body = method === "POST" ? JSON.stringify({ userEmail: ME, tool: "list_links" }) : undefined;
    expect((await t.fetch(path, { method, headers: { Authorization: "Bearer nope" }, body })).status).toBe(401);
    expect((await t.fetch(path, { method, body })).status).toBe(401);
  });

  it("refuses everything when KUNJI_SECRET is unset", async () => {
    vi.stubEnv("KUNJI_SECRET", "");
    const { t } = await setup();
    expect((await t.fetch("/kunji/tools", { headers: { Authorization: "Bearer " } })).status).toBe(401);
  });
});

describe("checkInput", () => {
  it("checks required keys, types and unknown fields", () => {
    const schema = {
      type: "object" as const,
      properties: { q: { type: "string" as const }, n: { type: "integer" as const } },
      required: ["q"],
      additionalProperties: false as const,
    };
    expect(checkInput(schema, { q: "x", n: 2 })).toBeNull();
    expect(checkInput(schema, {})).toBe('Missing "q".');
    expect(checkInput(schema, { q: "x", n: 1.5 })).toBe('"n" must be an integer.');
    expect(checkInput(schema, { q: "x", z: 1 })).toBe('Unknown field "z".');
    expect(checkInput(schema, [])).toBe("Input must be a JSON object.");
  });
});

describe("GET /kunji/tools", () => {
  it("lists the tools with their schemas", async () => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/tools", { headers: { Authorization: `Bearer ${SECRET}` } });
    const tools = (await res.json()) as { name: string; inputSchema: { type: string } }[];
    expect(tools.map((x) => x.name)).toEqual(["list_links", "shorten_url", "set_link_enabled"]);
    expect(tools.every((x) => x.inputSchema.type === "object" && /^[a-z][a-z0-9_]{0,63}$/.test(x.name))).toBe(true);
  });
});

describe("POST /kunji/access", () => {
  it.each([
    [ME, "ok"],
    ["ME@Example.com ", "ok"],
    ["nobody@example.com", "no_account"],
    ["other@example.com", "no_account"], // unverified
  ])("%s → %s", async (userEmail, status) => {
    const { t } = await setup();
    const res = await t.fetch("/kunji/access", post({ userEmail }));
    expect(await res.json()).toEqual({ status });
  });

  it("is not_allowed once the email leaves ALLOWED_EMAILS", async () => {
    const { t } = await setup();
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "not_allowed" });
  });

  it("is no_account when two verified rows share the email", async () => {
    const { t } = await setup();
    await t.run(async (ctx) => void (await ctx.db.insert("users", { email: ME, emailVerificationTime: 1 })));
    expect(await (await t.fetch("/kunji/access", post({ userEmail: ME }))).json()).toEqual({ status: "no_account" });
  });

  it("needs userEmail", async () => {
    const { t } = await setup();
    expect((await t.fetch("/kunji/access", post({}))).status).toBe(400);
  });
});

describe("POST /kunji/call", () => {
  it("refuses no_account, not_allowed, unknown tools and bad input", async () => {
    const { t } = await setup();
    expect(await call(t, "list_links", {}, "nobody@example.com")).toMatchObject({ ok: false, error: { code: "no_account" } });
    expect(await call(t, "delete_everything")).toMatchObject({ ok: false, error: { code: "unknown_tool" } });
    expect(await call(t, "list_links", { x: 1 })).toMatchObject({ ok: false, error: { code: "bad_input", message: 'Unknown field "x".' } });
    vi.stubEnv("ALLOWED_EMAILS", "someone@else.com");
    expect(await call(t, "list_links")).toMatchObject({ ok: false, error: { code: "not_allowed" } });
  });

  it("list_links lists only the user's links, newest first", async () => {
    const { t } = await setup();
    const { ok, result } = await call(t, "list_links");
    expect(ok).toBe(true);
    expect(result.more).toBe(false);
    expect(result.links.map((l: { slug: string }) => l.slug)).toEqual(["docs", "cv", "gh"]);
    expect(result.links[2]).toEqual({
      slug: "gh",
      shortUrl: "https://alp.pknspace.com/gh",
      target: "https://github.com/mepkn",
      enabled: true,
      clicks: 7,
      lastClickedAt: new Date(NOW).toISOString(),
      createdAt: expect.any(String),
    });
    expect(result.links[1]).toMatchObject({ slug: "cv", enabled: false, lastClickedAt: null });
  });

  it("list_links searches slug and target words and honours limit", async () => {
    const { t } = await setup();
    const slugs = async (input: object) =>
      ((await call(t, "list_links", input)).result.links as { slug: string }[]).map((l) => l.slug);
    expect(await slugs({ query: "github" })).toEqual(["gh"]); // not the stranger's
    expect(await slugs({ query: "exam" })).toEqual(expect.arrayContaining(["cv", "docs"]));
    expect(await slugs({ query: "  " })).toHaveLength(3);
    const limited = await call(t, "list_links", { limit: 2 });
    expect(limited.result.links).toHaveLength(2);
    expect(limited.result.more).toBe(true);
    expect(await call(t, "list_links", { limit: "2" })).toMatchObject({ ok: false, error: { code: "bad_input" } });
  });

  it("shorten_url creates a link with the given or a random slug", async () => {
    const { t, userId } = await setup();
    expect(await call(t, "shorten_url", { url: " https://example.org/a ", slug: "ex" })).toEqual({
      ok: true,
      result: { slug: "ex", shortUrl: "https://alp.pknspace.com/ex", target: "https://example.org/a" },
    });
    const random = (await call(t, "shorten_url", { url: "https://example.org/b" })).result;
    expect(random.slug).toMatch(/^[A-Za-z0-9_-]{6}$/);
    const mine = await t.run((ctx) => ctx.db.query("links").withIndex("by_user", (q) => q.eq("userId", userId)).collect());
    expect(mine.find((l) => l.slug === "ex")).toMatchObject({ enabled: true, clicks: 0, target: "https://example.org/a" });
    // Found by list_links search like links made in the app.
    expect((await call(t, "list_links", { query: "org" })).result.links.map((l: { slug: string }) => l.slug)).toContain("ex");
  });

  it("shorten_url refuses taken, reserved and bad slugs and bad URLs as sentences", async () => {
    const { t } = await setup();
    const err = async (input: object) => (await call(t, "shorten_url", input)).error;
    expect(await err({ url: "https://x.com", slug: "secret" })).toEqual({ code: "tool_error", message: expect.stringMatching(/already taken/) });
    expect(await err({ url: "https://x.com", slug: "api" })).toMatchObject({ message: expect.stringMatching(/reserved/) });
    expect(await err({ url: "https://x.com", slug: "a b" })).toMatchObject({ message: expect.stringMatching(/letters, digits/) });
    expect(await err({ url: "ftp://x.com" })).toMatchObject({ message: expect.stringMatching(/http/) });
    expect(await err({ url: "https://alp.pknspace.com/gh" })).toMatchObject({ message: expect.stringMatching(/alp link/) });
  });

  it("set_link_enabled turns only the user's own link on and off", async () => {
    const { t } = await setup();
    expect(await call(t, "set_link_enabled", { slug: "gh", enabled: false })).toEqual({
      ok: true,
      result: { slug: "gh", shortUrl: "https://alp.pknspace.com/gh", enabled: false, changed: true },
    });
    expect((await call(t, "set_link_enabled", { slug: "gh", enabled: false })).result.changed).toBe(false);
    const gh = await t.run((ctx) => ctx.db.query("links").withIndex("by_slug", (q) => q.eq("slug", "gh")).unique());
    expect(gh).toMatchObject({ enabled: false, clicks: 7, target: "https://github.com/mepkn" });
    expect((await call(t, "set_link_enabled", { slug: "cv", enabled: true })).result.enabled).toBe(true);
    for (const slug of ["secret", "GH", "nope"]) {
      expect(await call(t, "set_link_enabled", { slug, enabled: false })).toMatchObject({ ok: false, error: { code: "tool_error" } });
    }
    const secret = await t.run((ctx) => ctx.db.query("links").withIndex("by_slug", (q) => q.eq("slug", "secret")).unique());
    expect(secret?.enabled).toBe(true);
  });
});
