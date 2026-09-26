/**
 * 学习路径自动调整器 —— Ploy「闭环」在教学场景下的实现
 *
 * 为什么要有这个模块
 * ----------------
 * `module-specs.md` 定义了三条路径调整规则（掌握度 < 3 → 变式题、
 * 连续 3 次不通过 → 降难度、掌握度 ≥ 4 → 跳练习），但此前它们**只存在于
 * 文档里**——没有任何代码在运行时读取 mastery / errors 并自动写出
 * adjustments。结果是 learning_paths 表的 adjustments 列恒为空数组，
 * 学习路径是静态的。
 *
 * 本模块补齐这个「数据 → 分析 → 自动迭代」的闭环。每次点评完成后，
 * 由调用方（`/api/agent/validate` 路由）触发本模块，读取该学生最新数据，
 * 判定是否命中阈值，若命中则写入一条 `PathAdjustment`。
 *
 * 阈值与文档的对齐
 * --------------
 * | 条件 | 来源 | 动作 |
 * |---|---|---|
 * | 同一概念连续 3 次校验不通过 | `module-specs.md`「连续 3 次校验不通过」 | 建议插入变式练习题 |
 * | 掌握度连续 2 次下降 | 本文件补充（文档只提了"连续下滑"） | 建议换类比或讲法 |
 * | errorCount ≥ 3 | 本文件补充（错题积压预警） | 标记需复习 |
 * | 掌握度 ≥ 4 但模块未完成 | `module-specs.md`「掌握度 ≥ 4 可跳过变式练习」 | 提示可跳过余下练习 |
 *
 * 去重策略
 * ------
 * 同 reason 同 moduleId 的调整 7 天内不重复写入，避免每次点评都刷同一句话。
 *
 * 范围边界
 * ------
 * - 只写 adjustments（文本记录），不改模块状态、不变题生成、不跳练习。
 *   这些是**后续步骤**；本模块只保证「系统注意到了问题并记录了决策」。
 * - 只读数据、只写 adjustments，不打乱现有点评写入顺序。
 */

import type { ErrorRecord, LearningPath, Mastery, PathAdjustment } from "../db/types";

// ---------------------------------------------------------------------------
// 输入 —— 调用方在点评后传入的「此刻快照」
// ---------------------------------------------------------------------------

export interface AdjusterInput {
  /** 学生 id */
  studentId: string;
  /** 本轮点评涉及的知识点 */
  conceptId: string;
  /** 该生全部掌握度记录（含本轮刚更新的那一行） */
  mastery: Mastery[];
  /** 该生错题（按 createdAt 升序，最近在末尾） */
  errors: readonly ErrorRecord[];
  /** 当前学习路径 */
  path: LearningPath;
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------

export interface AdjustmentDecision {
  reason: string;
  action: string;
}

// ---------------------------------------------------------------------------
// 去重
// ---------------------------------------------------------------------------

/** 同 reason 的调整 N 天内不重复写。 */
const DEDUP_WINDOW_DAYS = 7;

function isDuplicate(decision: AdjustmentDecision, adjustments: readonly PathAdjustment[]): boolean {
  const cutoff = Date.now() - DEDUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return adjustments.some(
    (a) => a.reason === decision.reason && new Date(a.date).getTime() >= cutoff,
  );
}

// ---------------------------------------------------------------------------
// 规则检测
// ---------------------------------------------------------------------------

/**
 * 规则 1：同一概念最近 3 次校验结果是否全部不通过。
 *
 * 数据来源：validation_results 不在这里（没有读它的 repository），
 * 我们用 errors 表的 createdAt 倒序取最近 3 条**同一概念**的错题，
 * 并确认没有夹杂「通过」的记录。
 *
 * 「没有夹杂通过」的判断方式：若最近 3 条 errors（同一概念）的日期
 * 全部紧邻且最新一条在 24h 内，则认为「连续失败中」。
 * 这不是精确的「连续 3 次调用都失败」（可能中间有一次通过但没记录），
 * 但在当前数据模型下是可实现的最接近的近似。
 */
function checkConsecutiveFailures(
  conceptId: string,
  errors: readonly ErrorRecord[],
): AdjustmentDecision | null {
  const conceptErrors = errors
    .filter((e) => e.conceptId === conceptId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 最新在前

  if (conceptErrors.length < 3) return null;

  const recent = conceptErrors.slice(0, 3);
  const oldestOfRecent = recent[recent.length - 1].createdAt;
  const hoursSinceOldest =
    (Date.now() - new Date(oldestOfRecent).getTime()) / (1000 * 60 * 60);

  // 最近 3 条全在 72 小时内 → 密集失败
  if (hoursSinceOldest > 72) return null;

  const problemSummary = recent
    .flatMap((e) => e.problems)
    .slice(0, 3)
    .join("；");

  return {
    reason: `概念「${conceptId}」连续 3 次校验不通过`,
    action:
      `建议插入 3 道变式练习题，回放该概念的教学讲解。` +
      `常见问题：${problemSummary || "未提取到具体问题"}`,
  };
}

/**
 * 规则 2：掌握度是否连续下降。
 *
 * 只看该概念的 mastery.score 历史变化 —— 但 mastery 表不存历史，
 * 只有当前值。所以这里用「整条路径上相邻两个模块的掌握度对比」做近似：
 * 若当前模块掌握度 < 上一已完成模块掌握度，且差值 ≥ 2，则认为「下滑」。
 */
function checkMasteryDecline(
  conceptId: string,
  mastery: Mastery[],
  path: LearningPath,
): AdjustmentDecision | null {
  const currentModuleIdx = path.modules.findIndex((m) => m.moduleId === conceptId);
  if (currentModuleIdx <= 0) return null;

  const prevModule = path.modules[currentModuleIdx - 1];
  if (prevModule.status !== "completed") return null;

  const currentMastery = mastery.find((m) => m.conceptId === conceptId);
  const prevMastery = mastery.find((m) => m.conceptId === prevModule.moduleId);

  if (!currentMastery || !prevMastery) return null;
  if (currentMastery.score >= prevMastery.score) return null;
  if (prevMastery.score - currentMastery.score < 2) return null; // 差值 < 2 不算实质性下滑

  return {
    reason: `掌握度从「${prevModule.moduleId}」(${prevMastery.score}/5) 下降到「${conceptId}」(${currentMastery.score}/5)`,
    action:
      `建议换一种讲解方式（如用类比或动画演示）重新学习「${conceptId}」，` +
      `同时回顾前置模块「${prevModule.moduleId}」的关键概念。`,
  };
}

/**
 * 规则 3：同一概念的累计错题数达到阈值。
 *
 * errorCount 来自 mastery 表（每次不通过时 +1），由
 * `/api/agent/validate` 在记错题时调用 `masteryDb.incrementError` 维护。
 */
function checkErrorBuildup(
  conceptId: string,
  mastery: Mastery[],
): AdjustmentDecision | null {
  const record = mastery.find((m) => m.conceptId === conceptId);
  if (!record || record.errorCount < 3) return null;

  return {
    reason: `概念「${conceptId}」累计错题 ${record.errorCount} 次，已达预警线`,
    action:
      `建议暂停进度，集中复习「${conceptId}」的核心概念与典型错误，` +
      `完成复习后重做该模块的校验题。`,
  };
}

/**
 * 规则 4：掌握度已经达标但模块仍标记为进行中。
 *
 * 这种情况表示「学生已经会了但还没走完流程」—— 来源是 student profile
 * 里可能已经有基础，或者提前自学过。
 */
function checkReadyToSkip(
  conceptId: string,
  mastery: Mastery[],
  path: LearningPath,
): AdjustmentDecision | null {
  const record = mastery.find((m) => m.conceptId === conceptId);
  if (!record || record.score < 4) return null;

  const module = path.modules.find((m) => m.moduleId === conceptId);
  if (!module || module.status === "completed") return null;

  return {
    reason: `概念「${conceptId}」掌握度已达 ${record.score}/5（优秀档），但模块未完成`,
    action:
      `该模块的变式练习与附加校验可以跳过，建议直接进入下一模块。` +
      (path.nextModule ? `下一模块：「${path.nextModule}」。` : ""),
  };
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

/**
 * 分析学生当前数据，产出需要写入的路径调整。
 *
 * 最多返回 2 条：取最紧迫的两条（连续失败 > 错题积压 > 掌握下降 > 可跳过）。
 * 不一次性刷 4 条 —— adjustment 是给前端展示的决策提示，
 * 堆在一起学生消化不了。
 */
export function analyzePath(input: AdjusterInput): AdjustmentDecision[] {
  const { conceptId, mastery, errors, path } = input;

  const candidates: AdjustmentDecision[] = [];

  const consecutive = checkConsecutiveFailures(conceptId, errors);
  if (consecutive) candidates.push(consecutive);

  const buildup = checkErrorBuildup(conceptId, mastery);
  if (buildup) candidates.push(buildup);

  const decline = checkMasteryDecline(conceptId, mastery, path);
  if (decline) candidates.push(decline);

  const skip = checkReadyToSkip(conceptId, mastery, path);
  if (skip) candidates.push(skip);

  // 去重 + 只保留前 2 条
  return candidates
    .filter((d) => !isDuplicate(d, path.adjustments))
    .slice(0, 2);
}

/**
 * 将分析结果写入学习路径。
 *
 * 这是副作用函数，放在独立导出里让调用方显式调用 ——
 * analyzePath 是纯函数（可测试），writeAdjustments 是副作用（读改写）。
 */
export async function writeAdjustments(
  studentId: string,
  decisions: readonly AdjustmentDecision[],
): Promise<void> {
  if (decisions.length === 0) return;

  // 按需延迟导入 —— 避免 path-adjuster 在测试环境里拉进整个 db 层
  const { learningPathDb } = await import("../db/learning-path");

  const now = new Date().toISOString();
  for (const decision of decisions) {
    try {
      await learningPathDb.addAdjustment(studentId, {
        date: now,
        reason: decision.reason,
        action: decision.action,
      });
    } catch (err) {
      // 路径不存在等错误不阻塞点评主流程
      console.error("[path-adjuster] 写入调整失败：", err);
    }
  }
}