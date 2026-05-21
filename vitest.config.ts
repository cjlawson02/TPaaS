import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig, defineProject } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      defineProject({
        test: {
          name: "unit",
          include: ["test/**/*.test.ts"],
          exclude: ["test/integration/**"],
        },
      }),
      defineProject({
        plugins: [
          cloudflareTest({
            wrangler: { configPath: "./wrangler.integration.jsonc" },
          }),
        ],
        test: {
          name: "integration",
          include: ["test/integration/**/*.test.ts"],
        },
      }),
    ],
  },
});
