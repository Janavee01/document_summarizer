import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "lib/**/*.test.ts",
      "app/**/*.test.ts",
      "components/**/*.test.{ts,tsx}",
    ],
    environment: "node",
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
    },
  },
});
