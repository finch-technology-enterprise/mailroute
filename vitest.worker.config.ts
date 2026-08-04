import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        bindings: {
          JWT_SECRET: "test-jwt-secret-not-for-production",
          CONFIG_ENCRYPTION_KEY:
            "test-config-encryption-key-not-for-production",
          RESET_TOKEN_SECRET: "test-reset-token-secret-not-for-production",
          WEBHOOK_SECRET: "test-webhook-secret-not-for-production",
        },
      },
    }),
  ],
  test: {
    include: ["src/**/*.worker.test.ts"],
  },
});
