/**
 * 学生代码语言 —— 值域全站唯一一处
 *
 * 本文件是叶子：不 import 任何模块，Route Handler、Agent 内核、客户端
 * store、Node 脚本都能引用。
 */

/** 支持的学生代码语言。当前平台只教 TypeScript。 */
export const CODE_LANGUAGES = ["typescript"] as const;

/** 学生代码语言的联合类型，从常量数组推出（不是手写的第二份）。 */
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];