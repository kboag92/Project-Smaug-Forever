import { cpSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanConfig } from "../config.js";
import { buildArbitrage, buildCycles, buildEnchant, buildPortfolio, buildSuggest } from "./bundle-cycles.js";
import { configSource } from "./site-config.js";

// Files GitHub Pages serves. The TypeScript sources and the service-role key stay out.
const pages = [
  "index.html",
  "cycles.html",
  "arbitrage.html",
  "enchant.html",
  "portfolio.html",
  "arbitrage.js",
  "enchant.js",
  "portfolio.js",
  "portfolio-holdings.js",
  "portfolio-table.js",
  "alerts.js",
  "alert-list.js",
  "cycles.js",
  "data.js",
  "graph.js",
  "recent.js",
  "suggest.js",
  "coin-gold.svg",
  "coin-silver.svg",
  "coin-copper.svg",
];

const webDir = dirname(fileURLToPath(import.meta.url));
const outDir = join(webDir, "..", "..", "dist-site");
const url = process.env.SUPABASE_URL ?? "";
const anonKey = process.env.SUPABASE_ANON_KEY ?? "";

if (!url || !anonKey) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY are required. Use the publishable key, not the service role.");
}

await buildCycles(webDir);
await buildArbitrage(webDir);
await buildEnchant(webDir);
await buildSuggest(webDir);
await buildPortfolio(webDir);
mkdirSync(outDir, { recursive: true });
for (const file of pages) cpSync(join(webDir, file), join(outDir, file));
cpSync(join(webDir, "cycles-score.js"), join(outDir, "cycles-score.js"));
cpSync(join(webDir, "arbitrage-score.js"), join(outDir, "arbitrage-score.js"));
cpSync(join(webDir, "enchant-score.js"), join(outDir, "enchant-score.js"));
cpSync(join(webDir, "suggest-rank.js"), join(outDir, "suggest-rank.js"));
cpSync(join(webDir, "portfolio-score.js"), join(outDir, "portfolio-score.js"));
writeFileSync(join(outDir, "config.js"), configSource(url, anonKey, {
  region: scanConfig.region,
  rulesetId: scanConfig.rulesetId,
  allianceHouseId: scanConfig.houseId,
  neutralHouseId: scanConfig.neutralHouseId,
}));
console.log("Static site written to dist-site");
