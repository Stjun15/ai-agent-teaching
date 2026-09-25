/**
 * TSX hooks —— 让 Node 跑 React 组件测试。
 *
 * Node 22+ 的 --experimental-strip-types 只去类型注解，不处理 JSX 
 * 也不认 .tsx 扩展名。这里补两刀：
 *   1. resolve：把 .tsx/.jsx 的格式标为 "module"（否则 Node 直接报
 *      ERR_UNKNOWN_FILE_EXTENSION，连 load 都到不了）；
 *   2. load：esbuild 转译 JSX → 纯 JS。
 *
 * 路径别名解析仍由 ts-resolver.mjs 负责，互不干扰。
 */

import { fileURLToPath } from "node:url";
import { transformSync } from "esbuild";

const TSX_RE = /\.tsx$/;
const JSX_RE = /\.jsx$/;

export async function resolve(specifier, context, nextResolve) {
  const result = await nextResolve(specifier, context);

  if (TSX_RE.test(result.url) || JSX_RE.test(result.url)) {
    return { ...result, format: "module" };
  }

  return result;
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context);

  if (!TSX_RE.test(url) && !JSX_RE.test(url)) {
    return result;
  }

  const source = result.source instanceof Uint8Array
    ? new TextDecoder().decode(result.source)
    : String(result.source ?? "");

  try {
    const transformed = transformSync(source, {
      loader: "tsx",
      format: "esm",
      jsx: "automatic",
      sourcefile: fileURLToPath(url),
    });

    return {
      format: "module",
      source: transformed.code,
    };
  } catch (_err) {
    return result;
  }
}