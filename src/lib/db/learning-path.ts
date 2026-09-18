/**
 * 学习路径的数据访问
 *
 * 接口签名来自 agent-prompts/references/data-models.md「四、数据访问层设计」。
 *
 * 关于 modules / adjustments 两个 JSON 列：
 * 文档把它们建模为 LearningPath 内嵌的数组（而非独立表），因此这里采用
 * 「读出 → 改数组 → 写回」的方式。读改写不是原子操作，但本层所有写入都在
 * 单进程内、且 SQLite 连接是进程内单例，Phase 1~6 的单机开发形态下没有并发问题。
 * 切到 PostgreSQL 且出现多实例部署时，这里需要改成行级锁或乐观版本号。
 *
 * 一处基于字段语义的推断（文档未规定，需要时容易改回）：
 * `updateModule` 在改 status 的同时维护 startedAt / completedAt ——
 * 这两个字段若不随 status 联动，就没有任何写入路径，等于死字段。
 * 具体规则：进入 in_progress 时补 startedAt（已有则不覆盖）；
 * 进入 completed 时补 startedAt 与 completedAt。
 * 若文档后续给出别的规则，只需改这一个函数。
 */

import { getDb } from "./sqlite";
import {
  asNullableString,
  asNumber,
  asString,
  nowIso,
  parseJson,
  toJson,
  type Row,
} from "./helpers";
import type { LearningPath, LearningPathModule, PathAdjustment } from "./types";

function mapModule(raw: unknown): LearningPathModule | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  return {
    order: asNumber(item.order),
    moduleId: asString(item.moduleId),
    status: asString(item.status) as LearningPathModule["status"],
    startedAt: asNullableString(item.startedAt),
    completedAt: asNullableString(item.completedAt),
    mastery: asNumber(item.mastery),
  };
}

function mapAdjustment(raw: unknown): PathAdjustment | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;
  return {
    date: asString(item.date),
    reason: asString(item.reason),
    action: asString(item.action),
  };
}

function mapLearningPath(row: Row): LearningPath {
  const modules = parseJson<unknown[]>(row.modules, []);
  const adjustments = parseJson<unknown[]>(row.adjustments, []);

  return {
    studentId: asString(row.student_id),
    currentModule: asString(row.current_module),
    nextModule: asNullableString(row.next_module),
    modules: modules
      .map(mapModule)
      .filter((m): m is LearningPathModule => m !== null),
    adjustments: adjustments
      .map(mapAdjustment)
      .filter((a): a is PathAdjustment => a !== null),
    updatedAt: asString(row.updated_at),
  };
}

/** 读取原始行；路径不存在时抛错，避免调用方在 null 上做无意义的兜底 */
function loadRow(studentId: string): Row {
  const row = getDb()
    .prepare("SELECT * FROM learning_paths WHERE student_id = ?")
    .get(studentId);

  if (!row) {
    throw new Error(
      `learningPath: 学生 ${studentId} 尚无学习路径记录，无法更新`,
    );
  }
  return row as Row;
}

export const learningPathDb = {
  /** 取某学生的学习路径；不存在返回 null */
  async get(studentId: string): Promise<LearningPath | null> {
    const row = getDb()
      .prepare("SELECT * FROM learning_paths WHERE student_id = ?")
      .get(studentId);
    return row ? mapLearningPath(row as Row) : null;
  },

  /**
   * 新建（或重置）某学生的学习路径。
   *
   * 这是 `updateModule` / `addAdjustment` 的前置：那两个方法要求路径行已存在，
   * 否则会抛「尚无学习路径记录」。此前系统内**没有任何代码**创建这行
   * （种子脚本只建 students / student_profiles / mastery，GET 端点无路径时返回
   * null），导致 learning_paths 表永远 0 行、updateModule 永远抛错。
   * 本方法补齐这个写入入口，使学习路径真正可被持久化。
   *
   * 用 upsert：重复调用幂等，不会因「已存在」而静默失败；重置 adjustments
   * 让「重建路径」语义干净。正常业务不会在已有路径上反复 create。
   */
  async create(
    studentId: string,
    seed: {
      currentModule: string;
      nextModule?: string | null;
      modules: LearningPathModule[];
    },
  ): Promise<void> {
    getDb()
      .prepare(
        `INSERT INTO learning_paths (
           student_id, current_module, next_module, modules, adjustments, updated_at
         ) VALUES (?, ?, ?, ?, '[]', ?)
         ON CONFLICT(student_id) DO UPDATE SET
           current_module = excluded.current_module,
           next_module = excluded.next_module,
           modules = excluded.modules,
           adjustments = '[]',
           updated_at = excluded.updated_at`,
      )
      .run(
        studentId,
        seed.currentModule,
        seed.nextModule ?? null,
        toJson(seed.modules),
        nowIso(),
      );
  },

  /**
   * 更新某个模块的状态（见文件头的时间戳规则说明）。
   *
   * 模块 id 不在路径内时抛错：这通常意味着调用了错的 moduleId，
   * 静默无操作会让问题延后暴露到更难排查的地方。
   */
  async updateModule(
    studentId: string,
    moduleId: string,
    status: LearningPathModule["status"],
  ): Promise<void> {
    const row = loadRow(studentId);
    const modules = parseJson<unknown[]>(row.modules, [])
      .map(mapModule)
      .filter((m): m is LearningPathModule => m !== null);

    const target = modules.find((m) => m.moduleId === moduleId);
    if (!target) {
      throw new Error(
        `updateModule: 学生 ${studentId} 的学习路径中不存在模块 ${moduleId}`,
      );
    }

    const now = nowIso();
    target.status = status;

    if (status === "in_progress" || status === "completed") {
      target.startedAt ??= now;
    }
    if (status === "completed") {
      target.completedAt = now;
    }

    getDb()
      .prepare(
        "UPDATE learning_paths SET modules = ?, updated_at = ? WHERE student_id = ?",
      )
      .run(toJson(modules), now, studentId);
  },

  /** 追加一条路径调整记录 */
  async addAdjustment(
    studentId: string,
    adjustment: PathAdjustment,
  ): Promise<void> {
    const row = loadRow(studentId);
    const adjustments = parseJson<unknown[]>(row.adjustments, [])
      .map(mapAdjustment)
      .filter((a): a is PathAdjustment => a !== null);

    adjustments.push(adjustment);

    getDb()
      .prepare(
        "UPDATE learning_paths SET adjustments = ?, updated_at = ? WHERE student_id = ?",
      )
      .run(toJson(adjustments), nowIso(), studentId);
  },
};
