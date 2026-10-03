// Fails if a top-level file or folder in the web export could also be a valid
// slug: Caddy serves files first, so such a slug would never redirect.
// Add the name to RESERVED_SLUGS in convex/lib/slugs.ts.
//   node scripts/check-reserved.mts [dist/web]
import { readdirSync } from "node:fs";
import { slugError } from "../convex/lib/slugs.ts";

const dir = process.argv[2] ?? "dist/web";
const clashes = readdirSync(dir)
  .flatMap((name) => [name, name.replace(/\.html$/, "")])
  .filter((name) => slugError(name) === null);

if (clashes.length > 0) {
  console.error(`Not reserved in convex/lib/slugs.ts: ${[...new Set(clashes)].join(", ")}`);
  process.exit(1);
}
console.log(`Reserved slugs cover every top-level entry in ${dir}.`);
