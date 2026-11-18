import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scanConfig } from "../config.js";
import { loadLocalEnv } from "../env.js";
import { buildArbitrage, buildCycles, buildEnchant } from "./bundle-cycles.js";
import { configSource } from "./site-config.js";

// Local pages only. Prices are read in the browser with the publishable key.
// This process does not load the service-role key.

loadLocalEnv();
const webDir = dirname(fileURLToPath(import.meta.url));

const pages: Record<string, string> = {
  "/": "index.html",
  "/index.html": "index.html",
  "/alerts.js": "alerts.js",
  "/alert-list.js": "alert-list.js",
  "/data.js": "data.js",
  "/graph.js": "graph.js",
  "/recent.js": "recent.js",
  "/cycles": "cycles.html",
  "/cycles.html": "cycles.html",
  "/cycles.js": "cycles.js",
  "/arbitrage": "arbitrage.html",
  "/arbitrage.html": "arbitrage.html",
  "/arbitrage.js": "arbitrage.js",
  "/arbitrage-score.js": "arbitrage-score.js",
  "/cycles-score.js": "cycles-score.js",
  "/enchant": "enchant.html",
  "/enchant.html": "enchant.html",
  "/enchant.js": "enchant.js",
  "/enchant-score.js": "enchant-score.js",
  "/coin-gold.svg": "coin-gold.svg",
  "/coin-silver.svg": "coin-silver.svg",
  "/coin-copper.svg": "coin-copper.svg",
};

await buildCycles(webDir);
await buildArbitrage(webDir);
await buildEnchant(webDir);

const port = 4173;
createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/config.js") {
    const script = configSource(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "", {
      region: scanConfig.region,
      rulesetId: scanConfig.rulesetId,
      allianceHouseId: scanConfig.houseId,
      neutralHouseId: scanConfig.neutralHouseId,
    });
    response.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
    response.end(script);
    return;
  }
  const file = pages[url.pathname];
  if (request.method !== "GET" || !file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found.");
    return;
  }
  const type = file.endsWith(".js")
    ? "text/javascript"
    : file.endsWith(".svg")
      ? "image/svg+xml"
      : "text/html";
  response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
  response.end(readFileSync(join(webDir, file)));
}).listen(port, "127.0.0.1", () => {
  console.log(`Item graph ready at http://127.0.0.1:${port}`);
});
