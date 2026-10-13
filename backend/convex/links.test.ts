import { describe, expect, test, vi } from "vitest";
import { api } from "./_generated/api";
import { MAX_TARGET_LENGTH, RESERVED_SLUGS } from "./lib/slugs";
import { newTest, signedInUser, type TestConvex } from "./test.helpers";

const page = { paginationOpts: { numItems: 50, cursor: null } };

async function listSlugs(as: Awaited<ReturnType<typeof signedInUser>>["as"]) {
  return (await as.query(api.links.list, page)).page.map((l) => l.slug);
}

async function getLink(t: TestConvex, slug: string) {
  return await t.run((ctx) =>
    ctx.db
      .query("links")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique(),
  );
}

describe("allowlist", () => {
  test("a non-allowlisted email can't sign up or sign in", async () => {
    const t = newTest();
    for (const flow of ["signUp", "signIn"] as const) {
      await expect(
        t.action(api.auth.signIn, {
          provider: "password",
          params: { email: "mallory@example.com", password: "password123", flow },
        }),
      ).rejects.toThrow("notAllowed");
    }
    // Rejected before anything is stored.
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users).toEqual([]);
  });

  test("an allowlisted email can sign up, case-insensitively", async () => {
    const t = newTest();
    // Token minting needs JWT_PRIVATE_KEY, which tests don't set; the account
    // is stored before that step.
    await t
      .action(api.auth.signIn, {
        provider: "password",
        params: { email: " BOB@example.com ", password: "password123", flow: "signUp" },
      })
      .catch(() => {});
    const users = await t.run((ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.email)).toEqual(["bob@example.com"]);
  });

  test("an unset list allows nobody", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    vi.stubEnv("ALLOWED_EMAILS", "");
    await expect(alice.as.query(api.links.list, page)).rejects.toThrow("notAllowed");
  });

  test("a signed-in user whose email isn't allowed is refused", async () => {
    const t = newTest();
    const mallory = await signedInUser(t, "mallory@example.com");
    await expect(mallory.as.query(api.links.list, page)).rejects.toThrow("notAllowed");
    await expect(
      mallory.as.mutation(api.links.create, { target: "https://example.com" }),
    ).rejects.toThrow("notAllowed");
    await expect(mallory.as.query(api.users.me, {})).rejects.toThrow("notAllowed");
  });

  test("removing an email cuts off an existing session", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { _id } = await alice.as.mutation(api.links.create, { target: "https://example.com" });
    vi.stubEnv("ALLOWED_EMAILS", "bob@example.com");
    await expect(alice.as.query(api.links.list, page)).rejects.toThrow("notAllowed");
    await expect(alice.as.mutation(api.links.remove, { id: _id })).rejects.toThrow("notAllowed");
  });

  test("anonymous callers are refused", async () => {
    const t = newTest();
    await expect(t.query(api.links.list, page)).rejects.toThrow("notAuthenticated");
    await expect(t.mutation(api.links.create, { target: "https://example.com" })).rejects.toThrow(
      "notAuthenticated",
    );
  });
});

describe("ownership", () => {
  test("user A can't list, read, edit or delete user B's links", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const bob = await signedInUser(t, "bob@example.com");
    const { _id } = await bob.as.mutation(api.links.create, {
      target: "https://bob.example.com",
      slug: "bob",
    });

    expect(await listSlugs(alice.as)).toEqual([]);
    expect(await alice.as.query(api.links.get, { id: _id })).toBeNull();
    await expect(
      alice.as.mutation(api.links.update, { id: _id, target: "https://evil.example.com" }),
    ).rejects.toThrow("linkNotFound");
    await expect(alice.as.mutation(api.links.update, { id: _id, enabled: false })).rejects.toThrow(
      "linkNotFound",
    );
    await expect(alice.as.mutation(api.links.remove, { id: _id })).rejects.toThrow("linkNotFound");

    expect(await getLink(t, "bob")).toMatchObject({
      target: "https://bob.example.com",
      enabled: true,
    });
    expect(await listSlugs(bob.as)).toEqual(["bob"]);
  });

  test("lists newest first; owners can edit, disable and delete", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const a = await alice.as.mutation(api.links.create, { target: "https://a.example", slug: "a" });
    await alice.as.mutation(api.links.create, { target: "https://b.example", slug: "b" });
    expect(await listSlugs(alice.as)).toEqual(["b", "a"]);

    await alice.as.mutation(api.links.update, {
      id: a._id,
      target: "https://a2.example",
      enabled: false,
    });
    expect(await alice.as.query(api.links.get, { id: a._id })).toMatchObject({
      slug: "a",
      target: "https://a2.example",
      enabled: false,
    });

    await alice.as.mutation(api.links.remove, { id: a._id });
    expect(await listSlugs(alice.as)).toEqual(["b"]);
    await expect(alice.as.mutation(api.links.remove, { id: a._id })).rejects.toThrow(
      "linkNotFound",
    );
  });
});

describe("slugs", () => {
  test("pattern: 1–64 chars of [A-Za-z0-9_-]", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const create = (slug: string) =>
      alice.as.mutation(api.links.create, { target: "https://example.com", slug });
    for (const bad of ["a/b", "a.b", "a b", "ü", "x".repeat(65), "a?b", "%41"]) {
      await expect(create(bad)).rejects.toThrow("invalidSlug");
    }
    for (const good of ["x", "My_Link-1", "y".repeat(64)]) {
      await expect(create(good)).resolves.toMatchObject({ slug: good });
    }
  });

  test("reserved slugs are refused", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    for (const slug of ["sign-in", "settings", "_expo", "assets", "r", "api", "link", "index"]) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
      await expect(
        alice.as.mutation(api.links.create, { target: "https://example.com", slug }),
      ).rejects.toThrow("slugReserved");
    }
  });

  test("slugs are unique across users and case-sensitive", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const bob = await signedInUser(t, "bob@example.com");
    await alice.as.mutation(api.links.create, { target: "https://a.example", slug: "cv" });
    await expect(
      bob.as.mutation(api.links.create, { target: "https://b.example", slug: "cv" }),
    ).rejects.toThrow("slugTaken");
    await expect(
      bob.as.mutation(api.links.create, { target: "https://b.example", slug: "CV" }),
    ).resolves.toMatchObject({ slug: "CV" });
  });

  test("a random 6-character slug is generated when omitted", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { slug } = await alice.as.mutation(api.links.create, { target: "https://e.example" });
      expect(slug).toMatch(/^[a-z0-9]{6}$/);
      seen.add(slug);
    }
    expect(seen.size).toBe(5);
    // A blank slug counts as omitted.
    const { slug } = await alice.as.mutation(api.links.create, {
      target: "https://e.example",
      slug: "  ",
    });
    expect(slug).toMatch(/^[a-z0-9]{6}$/);
  });
});

describe("targets", () => {
  test("must be an absolute http(s) URL, not on the short domain, within the size cap", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const create = (target: string) => alice.as.mutation(api.links.create, { target });
    for (const bad of [
      "example.com",
      "/relative",
      "ftp://example.com",
      "javascript:alert(1)",
      "mailto:a@example.com",
      "https://alp.pknspace.com/cv",
      "https://ALP.pknspace.com./x",
      "http://alp.pknspace.com",
    ]) {
      await expect(create(bad)).rejects.toThrow("invalidUrl");
    }
    const long = "https://example.com/" + "a".repeat(MAX_TARGET_LENGTH);
    await expect(create(long)).rejects.toThrow("targetTooLong");
    await expect(create("https://example.com/" + "a".repeat(MAX_TARGET_LENGTH - 20))).resolves
      .toBeDefined();
    await expect(create("http://sub.alp.pknspace.com.example.org/")).resolves.toBeDefined();
  });

  test("updates are validated too", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { _id } = await alice.as.mutation(api.links.create, { target: "https://e.example" });
    await expect(
      alice.as.mutation(api.links.update, { id: _id, target: "https://alp.pknspace.com/x" }),
    ).rejects.toThrow("invalidUrl");
  });
});

describe("redirect", () => {
  test("an enabled link redirects with 302 and counts the click", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    await alice.as.mutation(api.links.create, { target: "https://example.com/cv.pdf", slug: "cv" });

    const res = await t.fetch("/r/cv", { redirect: "manual" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("https://example.com/cv.pdf");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await t.fetch("/r/cv", { redirect: "manual" });

    const link = await getLink(t, "cv");
    expect(link?.clicks).toBe(2);
    expect(link?.lastClickedAt).toBeTypeOf("number");
  });

  test("disabled, unknown, wrong-case and malformed slugs return 404", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { _id } = await alice.as.mutation(api.links.create, {
      target: "https://example.com",
      slug: "off",
    });
    await alice.as.mutation(api.links.update, { id: _id, enabled: false });

    for (const path of ["/r/off", "/r/nope", "/r/OFF", "/r/a/b"]) {
      const res = await t.fetch(path, { redirect: "manual" });
      expect(res.status, path).toBe(404);
      expect(res.headers.get("Content-Type"), path).toContain("text/html");
    }
    // These never reach the route (empty, or normalized away): the router's own 404.
    for (const path of ["/r/", "/r/%2e%2e"]) {
      expect((await t.fetch(path, { redirect: "manual" })).status, path).toBe(404);
    }
    expect((await getLink(t, "off"))?.clicks).toBe(0);
  });
});

describe("search", () => {
  async function searchSlugs(as: Awaited<ReturnType<typeof signedInUser>>["as"], query: string) {
    return (await as.query(api.links.search, { query, ...page })).page.map((l) => l.slug).sort();
  }

  test("matches slug and target words across all the caller's links, prefix on the last word", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const bob = await signedInUser(t, "bob@example.com");
    await alice.as.mutation(api.links.create, { target: "https://example.com/recipes", slug: "dinner" });
    await alice.as.mutation(api.links.create, { target: "https://docs.example.org/guide", slug: "docs" });
    await bob.as.mutation(api.links.create, { target: "https://example.com/recipes", slug: "bobs" });

    expect(await searchSlugs(alice.as, "recipes")).toEqual(["dinner"]);
    expect(await searchSlugs(alice.as, "dinn")).toEqual(["dinner"]);
    expect(await searchSlugs(alice.as, "example")).toEqual(["dinner", "docs"]);
    // Any matching word counts; the best match comes first.
    const ranked = await alice.as.query(api.links.search, { query: "example.com/rec", ...page });
    expect(ranked.page[0].slug).toBe("dinner");
    expect(await searchSlugs(alice.as, " / ")).toEqual([]);
  });

  test("follows target edits", async () => {
    const t = newTest();
    const alice = await signedInUser(t, "alice@example.com");
    const { _id } = await alice.as.mutation(api.links.create, {
      target: "https://example.com/old",
      slug: "moved",
    });
    await alice.as.mutation(api.links.update, { id: _id, target: "https://example.com/fresh" });
    expect(await searchSlugs(alice.as, "old")).toEqual([]);
    expect(await searchSlugs(alice.as, "fresh")).toEqual(["moved"]);
  });
});
