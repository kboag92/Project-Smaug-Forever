import { build, type Plugin } from "esbuild";
import { existsSync } from "node:fs";
import { join } from "node:path";

// The sources import "./cycles.js" while the file on disk is cycles.ts.
// This tells the bundler to follow that TypeScript path.
function typeScriptImports(): Plugin {
  return {
    name: "typescript-js-imports",
    setup(result) {
      result.onResolve({ filter: /^\..+\.js$/ }, (args) => {
        const tsPath = join(args.resolveDir, args.path.replace(/\.js$/, ".ts"));
        if (!existsSync(tsPath)) return null;
        return { path: tsPath };
      });
    },
  };
}

// One browser file for a rule module, so the page does not keep a second copy.
async function buildRules(webDir: string, entry: string, outfile: string): Promise<void> {
  await build({
    entryPoints: [join(webDir, entry)],
    bundle: true,
    format: "iife",
    platform: "browser",
    outfile: join(webDir, outfile),
    plugins: [typeScriptImports()],
    logLevel: "silent",
  });
}

export function buildCycles(webDir: string): Promise<void> {
  return buildRules(webDir, "cycles-entry.ts", "cycles-score.js");
}

export function buildArbitrage(webDir: string): Promise<void> {
  return buildRules(webDir, "arbitrage-entry.ts", "arbitrage-score.js");
}
