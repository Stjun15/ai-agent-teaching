/**
 * 站点级常量。
 * 放在 src/lib 下是为了验证 `@/*` 路径别名可用（见 tsconfig.json 的 paths）。
 */
export const siteConfig = {
  name: "AI Native 编程教学助手",
  description: "用 Agent 教 Agent —— 训练 AI 协作能力的编程教学平台",
  locale: "zh-CN",
} as const;
