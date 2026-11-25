// Copies the assets Next.js standalone mode does not include by default
// (public/ and .next/static) next to .next/standalone/server.js, and makes
// sure the uploads/ folder exists. Runs automatically in `npm run build:bonto`.
import { cpSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const standalone = path.join(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.log("[prepare-standalone] .next/standalone not found — skipping (not a standalone build).");
  process.exit(0);
}

const copies = [
  [path.join(root, "public"), path.join(standalone, "public")],
  [path.join(root, ".next", "static"), path.join(standalone, ".next", "static")],
];

for (const [from, to] of copies) {
  if (existsSync(from)) {
    cpSync(from, to, { recursive: true });
    console.log(`[prepare-standalone] copied ${path.relative(root, from)} → ${path.relative(root, to)}`);
  }
}

for (const dir of [path.join(root, "uploads"), path.join(standalone, "uploads")]) {
  mkdirSync(dir, { recursive: true });
}

console.log("[prepare-standalone] done. Start with: node .next/standalone/server.js");
