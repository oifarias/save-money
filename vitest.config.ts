import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Arquivos de teste rodam sequencialmente para evitar contenção no banco compartilhado
    fileParallelism: false,
    globals: true,
    environment: "node",
    setupFiles: ["src/test-setup.ts"],
  },
});
