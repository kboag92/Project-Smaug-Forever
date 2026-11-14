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

// One browser file for the cycle rules, so the page does not keep a second copy.
export async function buildCycles(webDir: string): Promise<void> {
  await build({
    entryPoints: [join(webDir, "cycles-entry.ts")],
    bundle: true,
    format: "iife",
    platform: "browser",
    outfile: join(webDir, "cycles-score.js"),
    plugins: [typeScriptImports()],
    logLevel: "silent",
  });
}
