import { defineConfig } from "vitest/config";
import { resolve } from "path";
import { existsSync } from "fs";

// Load local test secrets (.env.test.local) without requiring dotenv.
// process.loadEnvFile is available in Node 20.12+.
const envTestLocal = resolve(__dirname, ".env.test.local");
if (existsSync(envTestLocal)) {
  process.loadEnvFile(envTestLocal);
}

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
