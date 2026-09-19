/**
 * 学生代码语言 —— 值域全站唯一一处
 *
 * 为什么必须收敛
 * ------------
 * `typescript` / `python` 这个联合此前散在四处（`lib/agent/loop.ts` 的
 * `AgentCodeLanguage`、`lib/db/types.ts` 的两处内联、`stores/code.ts` 的
 * `CodeLanguage`）加三处 `z.enum(["typescript", "python"])`。加第三种语言
 * 时漏改任何一处，症状都是「某一层静默丢掉新值」—— 类型层的分叉编译器
 * 查不出来，因为每一处自身都是自洽的。
 *
 * 改语言值域要同时动的文档：`00-MASTER.md`「TS 和 Python 两个版本」、
 * `data-models.md` 的 `Message.language` 与 `StudentProfile.preferredLanguage`。
 * 它是数据库列语义 + 教学材料的约定，不是前端能单方面决定的事。
 *
 * 本文件是叶子：不 import 任何模块，Route Handler、Agent 内核、客户端
 * store、Node 脚本都能引用。
 */

/** 支持的学生代码语言，同时是 monaco 的语言 id（与内置 id 同名）。 */
export const CODE_LANGUAGES = ["typescript", "python"] as const;

/** 学生代码语言的联合类型，从常量数组推出（不是手写的第二份）。 */
export type CodeLanguage = (typeof CODE_LANGUAGES)[number];
