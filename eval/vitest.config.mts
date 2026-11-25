// Runner for `pnpm eval` only (real API calls). The normal `pnpm test` never includes eval/run.eval.ts.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(new URL("../src/test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    // .env.local comes from `node --env-file` in the package.json script, when a person runs it.
    include: ["eval/run.eval.ts"],
  },
});
