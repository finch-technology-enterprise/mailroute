import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/*.worker.test.ts", "admin/**", "e2e/**", "node_modules/**"],
  },
});
