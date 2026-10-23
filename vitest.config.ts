import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    // 标准框架只收 `tests/` 下的 `.test.ts`：`scripts/` 里的 `node:test`
    // 用例由 `scripts/run-tests.mjs` 编排，两者互不覆盖对方的入口。
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    // MCP 端到端用例要起子进程并等 JSON-RPC 握手。
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/lib/db/migrations/**",
        "src/lib/agent/prompts/**",
        "src/lib/agent/skills/**",
      ],
      thresholds: {
        statements: 0,
        branches: 0,
        functions: 0,
        lines: 0,
      },
    },
  },
});
