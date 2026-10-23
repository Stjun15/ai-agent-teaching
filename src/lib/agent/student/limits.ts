/**
 * 学生模拟的成本边界 —— 纯数字与纯判定，不碰数据库、不碰模型
 *
 * 为什么单独一个文件
 * ----------------
 * 这几条阈值是**产品决策**（教师能点几次、一次跑几轮、一次最多花多少 token），
 * 把它们散在路由与模拟器里，改一次就要翻三个文件，而且没法被测试单独钉住。
 * 这里只有常量与纯函数，路由读额度、模拟器读上限、测试直接断言。
 *
 * 计费口径
 * --------
 * **只按轮次与 token 计量，不折算人民币**。理由：模型单价会变、不同模型不同价，
 * 在任何一处写死「1 token = X 分」都会在换模型那天变成错误信息。教师看到的是
 * 可核对的原始量（几轮、多少 token），换算留给人。
 */

import type { SimulationStopReason } from "@/lib/db/types";

/** 一次运行的成本上限。取值依据见各字段注释。 */
export const SIMULATION_LIMITS = {
  /**
   * 单次运行最多几轮（一轮 = 模拟学生问 + 导师答，共两次模型调用）。
   *
   * 取 4：真实学生卡住时通常在 2~3 轮内暴露问题；到第 4 轮还没有新信息，
   * 多半是导师回答与模拟学生提问都在重复。上限压在 4 轮 = 最坏 8 次调用。
   */
  maxTurnsPerRun: 4,
  /** 同一教师 24 小时内最多发起几次运行（滚动窗口，不是自然日）。 */
  maxTeacherRunsPerDay: 10,
  /**
   * 单次运行的 token 总预算（输入 + 输出合计）。
   *
   * 取 20000：一轮典型对话（讲稿节选 + 历史 + 回答）约 3~5k token，
   * 4 轮最坏接近 2 万。到线即停，而不是让一次误触烧掉一整天的额度。
   */
  maxRunTokens: 20_000,
  /**
   * 单轮 token 上限。超过说明这一轮**本身**失控（讲稿未被截断、历史过长、
   * 模型跑飞），继续跑下一轮只会放大损失 —— 所以直接停整个运行。
   */
  maxTurnTokens: 6_000,
} as const;

/** 运行预算的判定结果。 */
export type RunBudgetVerdict =
  | { allowed: true; maxTurns: number }
  | {
      allowed: false;
      code: "DAILY_RUN_CAP" | "INVALID_TURNS";
      message: string;
    };

/**
 * 发起运行前的预算判定。
 *
 * `runsToday` 由数据层按 `startedAt >= now - 24h` 数出来（见 simulationDb），
 * 不是内存窗口 —— 进程重启后额度不能清零，否则「每日额度」只是装饰。
 */
export function checkRunBudget(input: {
  runsToday: number;
  requestedTurns: number;
}): RunBudgetVerdict {
  const { runsToday, requestedTurns } = input;

  if (runsToday >= SIMULATION_LIMITS.maxTeacherRunsPerDay) {
    return {
      allowed: false,
      code: "DAILY_RUN_CAP",
      message: `过去 24 小时内已发起 ${runsToday} 次模拟，达到上限 ${SIMULATION_LIMITS.maxTeacherRunsPerDay} 次。请稍后再试。`,
    };
  }

  if (
    !Number.isInteger(requestedTurns) ||
    requestedTurns < 1 ||
    requestedTurns > SIMULATION_LIMITS.maxTurnsPerRun
  ) {
    return {
      allowed: false,
      code: "INVALID_TURNS",
      message: `轮次上限必须是 1~${SIMULATION_LIMITS.maxTurnsPerRun} 之间的整数。`,
    };
  }

  return { allowed: true, maxTurns: requestedTurns };
}

/** 单轮 token 判定结果。 */
export type TurnBudgetVerdict =
  | { allowed: true }
  | { allowed: false; reason: "TURN_TOKENS" | "RUN_TOKENS"; message: string };

/**
 * 每轮结束后的成本判定。
 *
 * 两个判据分开给理由：单轮超限说明这一轮输入/输出本身有问题，
 * 累计超限说明整体太贵 —— 教师看到的文案不同，处理动作也不同。
 */
export function checkTurnBudget(input: {
  tokensSoFar: number;
  turnTokens: number;
}): TurnBudgetVerdict {
  const { tokensSoFar, turnTokens } = input;

  if (turnTokens > SIMULATION_LIMITS.maxTurnTokens) {
    return {
      allowed: false,
      reason: "TURN_TOKENS",
      message: `单轮消耗 ${turnTokens} token，超过上限 ${SIMULATION_LIMITS.maxTurnTokens}。运行已停止，避免继续放大成本。`,
    };
  }

  if (tokensSoFar + turnTokens > SIMULATION_LIMITS.maxRunTokens) {
    return {
      allowed: false,
      reason: "RUN_TOKENS",
      message: `累计消耗 ${tokensSoFar + turnTokens} token，超过单次运行预算 ${SIMULATION_LIMITS.maxRunTokens}。运行已停止。`,
    };
  }

  return { allowed: true };
}

/**
 * 把「超预算」的判定折叠成运行的收尾结果。
 *
 * 为什么状态是 `completed` 而不是 `failed`：预算到线是**设计内的正常结束**，
 * 不是故障。若记成 failed，教师控制台会把一次受控停止读成系统出错，
 * 下次就不敢再点 —— 真正要避免的是「悄悄截断」，不是「明确停止」。
 * 具体的停因（单轮/累计、超了多少）放在 `error` 字段里如实回显。
 */
export function budgetToStop(message: string): {
  status: "completed";
  stopReason: SimulationStopReason;
  error: string;
} {
  return { status: "completed", stopReason: "token-budget", error: message };
}
