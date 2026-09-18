/**
 * ESM resolve 钩子：补扩展名 + 解析 `@/*` 别名。
 *
 * 被 `ts-loader.mjs` 注册，不要直接引用。
 *
 * 两个补丁都只在**默认解析失败时**才介入：能正常解析的（node_modules 里的包、
 * `node:` 内置模块）一律不动，避免把第三方包的行为也改了。
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as resolvePath } from "node:path";

/** 仓库 src 目录的绝对路径。本文件在 `scripts/` 下，src 是其同级。 */
const SRC_DIR = resolvePath(dirname(fileURLToPath(import.meta.url)), "../src");

/** 尝试的扩展名顺序。`.ts` 优先于 `.tsx`（本项目无 tsx，留着以防万一）。 */
const EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".js",
  ".mjs",
  "/index.ts",
  "/index.tsx",
];

/**
 * 把 `@/foo/bar` 解析成 `src/foo/bar` 的绝对 URL。非别名返回 null。
 */
function resolveAlias(specifier) {
  if (specifier === "@") return pathToFileURL(join(SRC_DIR, "index.ts")).href;
  if (!specifier.startsWith("@/")) return null;
  return pathToFileURL(join(SRC_DIR, specifier.slice(2))).href;
}

/** 给无扩展名的说明符补一个存在的文件。 */
function withExtension(baseUrl) {
  for (const extension of EXTENSIONS) {
    const candidate = baseUrl + extension;
    // 去掉 file:// 前缀再判断文件是否存在
    if (existsSync(fileURLToPath(candidate))) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // 1) 先让默认解析试一次：node_modules / node: 内置 / 已带扩展名的都能过
  try {
    return await nextResolve(specifier, context);
  } catch {
    // 落到下面两个补丁
  }

  // 2) 路径别名 `@/*`
  const aliased = resolveAlias(specifier);
  if (aliased) {
    // 不指定 format：让 Node 按扩展名自行判定（.ts → 走类型剥离）。
    // 写死 "module" 会跳过剥离，把 TS 语法直接喂给 ESM 解析器。
    const resolved = withExtension(aliased) ?? aliased;
    return { url: resolved, shortCircuit: true };
  }

  // 3) 无扩展名的相对导入
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
  if (isRelative && !hasExtension && context.parentURL) {
    const base = new URL(specifier, context.parentURL);
    const resolved = withExtension(base.href);
    if (resolved) {
      // 不指定 format：让 Node 按扩展名自行判定（.ts → 走类型剥离），
      // 写死 "module" 会跳过剥离，直接把 TS 语法喂给 ESM 解析器。
      return { url: resolved, shortCircuit: true };
    }
  }

  // 4) 都不行：重新抛出默认解析的错误，保留原始错误信息
  return nextResolve(specifier, context);
}
