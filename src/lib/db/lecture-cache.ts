/**
 * 讲稿缓存（lecture_cache 表）的数据访问
 *
 * 这张表是什么（2026-09-19 新增）
 * ---------------------------
 * 「概念讲解 / 观察示范」两步开场讲稿的**预生成缓存**。起因是学生反馈：
 * 「概念讲解不是提前准备好的吗？为什么点开要等模型响应？」——此前每次
 * 进入这两步都由 `LectureLauncher` 现场发起一次真实模型调用（实测 35~42
 * 秒），且对话状态只在内存里，刷新即重来、token 重复烧。
 *
 * 预生成 vs 学生追问的边界
 * ---------------------
 * 只有「每讲内容固定、全体学生共用的开场讲稿」进这张表（9 模块 × 2 步）；
 * 学生的追问、点评、出题仍走实时模型 —— 个性化回答不可缓存。
 *
 * 写入者只有 `scripts/generate-lecture-cache.mjs`（预生成脚本）。应用运行期
 * 只读：GET 端点与前端都不写 —— 与「兜底输出一律不写」同类纪律：缓存内容
 * 必须全部来自**审核过的生成流程**，不允许某条请求路径悄悄写进一份没把过
 * 关的讲稿。
 *
 * 缓存失效：不做 TTL。讲稿不是会过期的数据；提示词 / 模型升级后由维护者
 * 用 `--force` 重跑脚本整表重建（见迁移文件头）。
 *
 * 所有方法都是 async 的，尽管 node:sqlite 是同步 API —— 见 students.ts 的说明。
 */

import { getDb } from "./sqlite";
import { asNumber, asString, nowIso, type Row } from "./helpers";

/** 可缓存讲稿的步骤。与 lecture_cache 表的 CHECK 约束保持一致。 */
export type LectureCacheStep = "explain" | "observe";

export interface LectureCacheEntry {
  moduleId: string;
  step: LectureCacheStep;
  /** 讲稿正文（Markdown，与对话流里助手消息同形态）。 */
  content: string;
  /** 生成时用的模型 id —— 排查「为什么这份讲稿风格不一样」时用。 */
  model: string;
  inputTokens: number;
  outputTokens: number;
  createdAt: string;
}

function mapEntry(row: Row): LectureCacheEntry {
  return {
    moduleId: asString(row.module_id),
    step: asString(row.step) as LectureCacheStep,
    content: asString(row.content),
    model: asString(row.model),
    inputTokens: asNumber(row.input_tokens),
    outputTokens: asNumber(row.output_tokens),
    createdAt: asString(row.created_at),
  };
}

export const lectureCacheDb = {
  /** 取某模块某步骤的缓存讲稿；无缓存返回 null（调用方据此回退实时生成）。 */
  async get(
    moduleId: string,
    step: LectureCacheStep,
  ): Promise<LectureCacheEntry | null> {
    const row = getDb()
      .prepare(
        "SELECT * FROM lecture_cache WHERE module_id = ? AND step = ? LIMIT 1",
      )
      .get(moduleId, step);
    return row ? mapEntry(row as Row) : null;
  },

  /** 写入 / 覆盖一份讲稿（upsert，主键 (module_id, step)）。仅预生成脚本调用。 */
  async upsert(entry: {
    moduleId: string;
    step: LectureCacheStep;
    content: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
  }): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO lecture_cache
           (module_id, step, content, model, input_tokens, output_tokens, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (module_id, step) DO UPDATE SET
           content = excluded.content,
           model = excluded.model,
           input_tokens = excluded.input_tokens,
           output_tokens = excluded.output_tokens,
           created_at = excluded.created_at`,
      )
      .run(
        entry.moduleId,
        entry.step,
        entry.content,
        entry.model,
        entry.inputTokens,
        entry.outputTokens,
        nowIso(),
      );
  },

  /** 缓存了多少份讲稿（健康检查 / 脚本汇总用）。 */
  async count(): Promise<number> {
    const row = getDb()
      .prepare("SELECT COUNT(*) AS n FROM lecture_cache")
      .get() as { n: number };
    return asNumber(row.n);
  },
};
