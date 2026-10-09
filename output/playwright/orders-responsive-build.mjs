import { build } from "../../node_modules/.pnpm/esbuild@0.28.0/node_modules/esbuild/lib/main.js";
import { resolve } from "node:path";

await build({
  entryPoints: [resolve("output/playwright/orders-responsive-client.tsx")],
  outfile: resolve("output/playwright/orders-responsive-client.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  tsconfig: resolve("tsconfig.json"),
  plugins: [{
    name: "fixture-actions",
    setup(build) {
      build.onResolve({ filter: /^@\/lib\/actions\/orders$/ }, () => ({ path: resolve("output/playwright/orders-responsive-actions.ts") }));
    },
  }],
});
