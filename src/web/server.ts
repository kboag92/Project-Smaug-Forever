import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../env.js";
import { buildCycles } from "./bundle-cycles.js";
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
  "/cycles-score.js": "cycles-score.js",
};

await buildCycles(webDir);

const port = 4173;
createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (request.method === "GET" && url.pathname === "/config.js") {
    const script = configSource(process.env.SUPABASE_URL ?? "", process.env.SUPABASE_ANON_KEY ?? "");
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
  const type = file.endsWith(".js") ? "text/javascript" : "text/html";
  response.writeHead(200, { "Content-Type": `${type}; charset=utf-8` });
  response.end(readFileSync(join(webDir, file)));
}).listen(port, "127.0.0.1", () => {
  console.log(`Item graph ready at http://127.0.0.1:${port}`);
});
