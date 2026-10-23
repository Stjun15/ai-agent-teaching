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
      /**
       * 门槛取「当前实测值留约 1.5 个百分点余量」，只做**回退哨兵**、不做进度指标。
       *
       * 为什么不是更高：`src/lib/agent/` 里真正调模型的编排循环（loop / runtime /
       * 四个 orchestrator）按设计无法用单测覆盖 —— 它们要真模型、真 SSE、真会话，
       * 归浏览器验收与 `pnpm test` 的真模型组管。硬把这部分算进门槛，只会逼人写
       * 断言模型输出的脆弱用例。门槛的意义是「删了测试或漏了断言，CI 立刻红」。
       */
      thresholds: {
        statements: 10,
        branches: 8,
        functions: 11,
        lines: 9,
      },
    },
  },
});
