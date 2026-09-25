/**
 * 项目内 TS 加载器 —— 让 Node 直接跑 `src/` 下的 TypeScript 源码
 *
 * 为什么需要它
 * -----------
 * 仓库的导入风格是为打包器写的，Node 原生跑不了，两处不兼容：
 *   1. **无扩展名的相对导入**（`./ark`、`../sse-server`）—— Node 要求显式扩展名；
 *   2. **路径别名 `@/*`**（见 `tsconfig.json` 的 `paths`）—— Node 不认识。
 *
 * 有了这个钩子，回归测试可以直接 `import` 真实源码，不必为了可测就去改仓库的
 * 导入风格（那种改法会把「为了跑测试」的妥协永久留在生产代码里）。
 *
 * 只用于**测试与脚本**，不参与构建：Next/Turbopack 有自己的解析与编译。
 *
 * 用法
 * ----
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs <脚本>.ts
 *   # 或 `pnpm test:agent`
 */

import { register } from "node:module";

register("./ts-resolver.mjs", import.meta.url);
// TSX hooks: esbuild 转译 JSX → 纯 JS。与 path resolver 互不干扰。
register("./tsx-loader-hook.mjs", import.meta.url);