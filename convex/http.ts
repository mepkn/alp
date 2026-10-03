import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";
import { SLUG_PATTERN } from "./lib/slugs";

const http = httpRouter();

auth.addHttpRoutes(http);

const NOT_FOUND_HTML =
  '<!doctype html><meta charset="utf-8"><title>Not found</title><p>This link doesn\'t exist.</p>';

function notFound() {
  return new Response(NOT_FOUND_HTML, {
    status: 404,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// The only public endpoint. Caddy proxies every path that isn't a file in the
// web export to /r/<path>.
http.route({
  pathPrefix: "/r/",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const slug = new URL(req.url).pathname.slice("/r/".length);
    if (!SLUG_PATTERN.test(slug)) return notFound();
    const link = await ctx.runQuery(internal.links.resolve, { slug });
    if (link === null) return notFound();
    await ctx.runMutation(internal.links.recordClick, { id: link.id });
    // no-store: every visit reaches us, so every click is counted.
    return new Response(null, {
      status: 302,
      headers: { Location: link.target, "Cache-Control": "no-store" },
    });
  }),
});

export default http;
