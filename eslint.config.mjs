import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import prettierFlat from "eslint-config-prettier/flat";

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,

  // 关闭所有与 Prettier 冲突的格式类规则，格式统一交给 Prettier。
  prettierFlat,

  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "_backup/**",
    "_day0_test/**",
    // 走查会话的产物副本（不入库），不要让 lint 扫进去
    "walkthrough-output/**",
    // 学生 Agent / 扇出审计的证据目录（不入库）。里面的 .mjs .cjs 是
    // 子智能体当场写的探针脚本，不受本仓库的 TS 规则约束 —— 与
    // tsconfig.json 的 exclude 是同一份清单，两边必须同步改。
    "student-agent-output/**",
  ]),
]);
