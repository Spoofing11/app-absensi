import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./tests/integration/server-only.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.js"],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
