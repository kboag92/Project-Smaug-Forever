import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCycles } from "./bundle-cycles.js";
import { configSource } from "./site-config.js";

// Files GitHub Pages serves. The TypeScript sources and the service-role key stay out.
const pages = [
  "index.html",
  "cycles.html",
  "alerts.js",
  "alert-list.js",
  "cycles.js",
  "data.js",
];

const webDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(webDir, "..", "..", "dist-site");
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required. Use the publishable key, not the service role.");
}

await buildCycles(webDir);
mkdirSync(outDir, { recursive: true });
for (const file of pages) cpSync(join(webDir, file), join(outDir, file));
cpSync(join(webDir, "cycles-score.js"), join(outDir, "cycles-score.js"));
writeFileSync(join(outDir, "config.js"), configSource(url, anonKey));
console.log("Static site written to dist-site");
