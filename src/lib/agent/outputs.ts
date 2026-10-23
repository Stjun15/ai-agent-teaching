/**
 * 4 个 Agent 输出的 Zod Schema
 *
 * 设计依据
 * --------
 * - `agent-prompts-lib.md`「五、Zod Schema 定义」给出了 4 个 schema 的原文。
 *   本文件在其基础上收紧了三处，理由见各 schema 上方注释。
 * - `02-agent-system.md` 异常处理表首行：「Agent 输出格式错误 → Zod 校验失败
 *   → 附带错误重试 → 兜底」。所以这里的 schema 就是重试循环的判据 ——
 *   **判据不准，重试就白试**。
 * - `06-execution-plan.md` Phase 4 验收标准：「所有输出通过 Zod 校验」。
 *
 * 为什么放在 `src/lib/agent/` 而不是 `src/schemas/`
 * ---------------------------------------------
 * `src/schemas/index.ts` 头部的约定是：它只服务 Route Handler 与前端，
 * Agent 内核不 import 它。这 4 个 schema 是 **Agent 之间的内部契约**
 * （编排层 → Agent → 编排层），不是 HTTP 契约，放那儿会让「内核不碰 HTTP 契约」
 * 这条边界失效。真要与前端通信时，由编排层的调用方把结果映射成 SSE 事件。
 */

import { z } from "zod";

import type { Expect } from "@/lib/type-assert";

import { isSceneId, SCENE_IDS } from "./scene-ids";
import type { AgentId } from "./types";

/**
 * 维度权重之和的容差。
 *
 * 模型输出的 `weight` 是浮点（0.25 / 0.3 / 0.2），相加会有浮点误差，
 * 也见过模型输出 0.33。取 0.02 既能容忍这些，又能拦住「漏了一个维度」
 * 或「把 25 当成 0.25 之外又写错」这类真错误。
 */
const WEIGHT_SUM_TOLERANCE = 0.02;

/**
 * 场景 ID 校验失败时的错误消息。
 *
 * 为什么要把 9 个合法值列全
 * -----------------------
 * 这条消息不只是给人看的：`runtime.ts` 会把它原文回喂给模型重试
 * （重试消息里的「错误：Zod 校验失败：visualize_scene …」就是它）。
 * 只写「不是已注册的可视化场景 ID」，模型拿不到正确答案，三次重试全是瞎猜 ——
 * 回归测试因此偶发失败（同一用例重跑又过）。列出候选值，重试才有意义。
 *
 * 为什么模型一开始会编造场景 ID
 * --------------------------
 * 讲解 Agent 的 System Prompt 里只写了 `"visualize_scene": "场景 ID"`，
 * 9 个场景的映射表在 `trigger-visualization` 技能里；而讲解 Agent 跑的是
 * `explain-concept` 技能，看不到那张表。这是提示词层面的缺口（源头在
 * `agent-prompts-lib.md`），消息表是运行时这一侧能补上的一半。
 *
 * 用 `SCENE_IDS` 拼而不是写死字符串：口径已经有三处（设计文档 / 技能表 /
 * 前端映射），错误消息不该成为第四处。
 */
export const SCENE_ID_MESSAGE = `不是已注册的可视化场景 ID；可选：${SCENE_IDS.join("、")}`;

/**
 * 校验评分维度权重之和。
 *
 * 单独导出是为了能脱离模型直接断言 —— 它是纯函数，喂一组维度进去即可。
 */
export function checkDimensionWeights(
  dimensions: readonly { weight: number }[],
): { ok: boolean; sum: number } {
  const sum = dimensions.reduce((acc, d) => acc + d.weight, 0);
  return { ok: Math.abs(sum - 1) <= WEIGHT_SUM_TOLERANCE, sum };
}

// ---------------------------------------------------------------------------
// 讲解 Agent
// ---------------------------------------------------------------------------

/**
 * 讲解 Agent 的输出。
 *
 * 相对文档原文收紧一处：`visualize_scene` 用 `isSceneId` 守卫 ——
 * 文档里它是普通 `string`，但一个前端不认识的场景 ID 会让可视化区域
 * **静默空白且不报错**（见 `scene-ids.ts` 文件头）。宁可让 Zod 拦下走重试，
 * 也不要把无效值一路传到界面。
 */
export const TeacherOutputSchema = z.object({
  type: z.enum(["explain", "question", "visualize", "review"]),
  content: z.string(),
  concept_id: z.string(),
  visualize_scene: z
    .string()
    .refine(isSceneId, { message: SCENE_ID_MESSAGE })
    .optional(),
  check_question: z
    .object({
      question: z.string(),
      expected_keywords: z.array(z.string()),
      hint_levels: z.array(z.string()),
    })
    .optional(),
  next_action: z.enum(["continue", "practice", "review_prerequisite"]),
});

/** 讲解 Agent 输出的类型。 */
export type TeacherOutput = z.infer<typeof TeacherOutputSchema>;

// ---------------------------------------------------------------------------
// 点评 Agent
// ---------------------------------------------------------------------------

/**
 * 扣分归一化：接受带符号的写法，一律存成**正数**。
 *
 * 为什么不写成 `min(0)` 要求模型给正数
 * ---------------------------------
 * 原本就是 `min(0)`，模型写 -10 会被 Zod 拒掉。但点评 Agent 的 System Prompt
 * 里的输出示例写着 `"deduction": -10`（那是 `agent-prompts-lib.md` 的原文，
 * 本项目对提示词一律照搬不改）—— 于是**提示词与校验规则互相矛盾**：
 * 模型照着自己的提示词写，必然被拒；而重试也救不了，因为提示词没变，
 * 下一次它还会写 -10。实测点评回归测试约 1/5 的概率红在这一条上
 * （只有模型真的给出 `issues` 时才触发，所以是间歇性的）。
 *
 * 改提示词是另一条路，但那会让代码与「原文照搬」的文档产生分歧 ——
 * `prompts/reviewer.ts` 头部明确警告过这种分歧的代价（排查时无法判断哪边权威）。
 *
 * 归一化不是妥协，是**无损**的：扣分的符号本身是冗余信息，-10 与 10 都只表示
 * 「扣 10 分」，不存在需要区分二者的场景。归一之后内部仍然只有一种口径，
 * `issues` 与 `suggestions` 的原文描述一字不动。
 */
const deductionSchema = z.number().transform((value) => Math.abs(value));

/**
 * 点评 Agent 的输出。
 *
 * 相对文档原文收紧两处：
 * 1. `deduction` 一律存成**正数**（见下方 `deductionSchema`）。文档示例是
 *    -10（负数表示扣分），归一化之后「总分怎么算出来的」才可复核，同时
 *    `suggestions` 之外仍保留 `issues` 的原文描述。
 * 2. 维度权重之和必须 ≈1（见 `checkDimensionWeights`）。模型漏报一个维度时，
 *    总分实际上是按残缺的评分标准算的 —— 这种错误不拦，学生会看到一个
 *    看似合理却不可复核的分数。
 */
export const ReviewerOutputSchema = z
  .object({
    total_score: z.number().min(0).max(100),
    level: z.enum(["优秀", "良好", "及格", "不及格"]),
    is_correct: z.boolean(),
    dimensions: z
      .array(
        z.object({
          name: z.string(),
          score: z.number().min(0).max(100),
          weight: z.number().min(0).max(1),
          comment: z.string(),
        }),
      )
      .min(1),
    issues: z.array(
      z.object({
        type: z.enum(["严重错误", "优化建议"]),
        detail: z.string(),
        deduction: deductionSchema,
        related_dimension: z.string(),
        related_anti_pattern: z.string().nullable(),
      }),
    ),
    suggestions: z.array(
      z.object({
        priority: z.enum(["高", "中", "低"]),
        action: z.string(),
        example: z.string(),
      }),
    ),
    progress_note: z.string().optional(),
    next_action: z.enum(["retry", "pass", "lower_difficulty"]),
    /**
     * Skill 个性通过条件的判定结果。
     *
     * 此前 `isPassing` 只守得分 >= 75、is_correct、无严重错误三条共性。
     * 四个 Skill 各自有一条额外的通过线（如 validate-prompt 要求
     * 「角色定义维度 >= 60% 权重分」），但这些条件的维度名依赖模型措辞
     * （"角色定义""角色设定"变体），代码直接匹配脆弱且不可复现。
     *
     * 因此把判定权交还给模型（它读的就是那份评分标准，最清楚自己给
     * 每个维度的分数），此处只要求它显式声明结果 —— 代码守卫从
     *"匹配维度名"降级为"检查模型是否做了这个判断"。
     */
    skill_condition_check: z
      .object({
        met: z.boolean(),
        detail: z.string(),
      })
      .optional(),
  })
  .refine(
    (v) => {
      const { ok } = checkDimensionWeights(v.dimensions);
      return ok;
    },
    { message: "dimensions 的 weight 之和必须约等于 1（当前评分标准残缺）" },
  );

/** 点评 Agent 输出的类型。 */
export type ReviewerOutput = z.infer<typeof ReviewerOutputSchema>;

// ---------------------------------------------------------------------------
// 出题 Agent
// ---------------------------------------------------------------------------

/** 出题 Agent 的输出。与文档原文一致。 */
export const ExaminerOutputSchema = z.object({
  questions: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["选择题", "填空题", "简答题", "实战题"]),
        concept_id: z.string(),
        difficulty: z.number().min(1).max(5),
        scenario: z.string(),
        question: z.string(),
        options: z.array(z.string()).optional(),
        correct_answer: z.string(),
        explanation: z.string(),
        hint_levels: z.array(z.string()),
        related_anti_pattern: z.string().nullable(),
      }),
    )
    .min(1),
  total_count: z.number(),
  estimated_time: z.string(),
});

/** 出题 Agent 输出的类型。 */
export type ExaminerOutput = z.infer<typeof ExaminerOutputSchema>;

// ---------------------------------------------------------------------------
// 答疑 Agent
// ---------------------------------------------------------------------------

/** 答疑 Agent 的输出。与文档原文一致。 */
export const AssistantOutputSchema = z.object({
  type: z.enum(["answer", "counter_question", "hint", "redirect"]),
  content: z.string(),
  related_concepts: z.array(z.string()),
  hint_level: z.enum(["L1", "L2", "L3"]).nullable(),
  should_log: z.boolean(),
  log_category: z.enum(["高频问题", "概念困惑", "环境问题", "跑偏"]),
});

/** 答疑 Agent 输出的类型。 */
export type AssistantOutput = z.infer<typeof AssistantOutputSchema>;

// ---------------------------------------------------------------------------
// 触发可视化（trigger-visualization 技能的输出格式）
// ---------------------------------------------------------------------------

/**
 * 可视化触发的输出。格式由 `skills/trigger-visualization.ts` 定义。
 *
 * `initial_params` 用 `z.record(z.string(), z.unknown())` 而不是 `z.object({})`：
 * 每个场景需要的参数不同（天气查询要城市、工具链要工具列表），在这里定死
 * 会让「加一个新场景」变成改 schema。参数的具体校验留给场景自己。
 */
export const VisualizationOutputSchema = z.object({
  scene_id: z.string().refine(isSceneId, {
    message: SCENE_ID_MESSAGE,
  }),
  initial_params: z.record(z.string(), z.unknown()).optional(),
});

/** 可视化触发输出的类型。 */
export type VisualizationOutput = z.infer<typeof VisualizationOutputSchema>;

// ---------------------------------------------------------------------------
// Agent → 输出 Schema 的映射
// ---------------------------------------------------------------------------

/**
 * 每个 Agent 的输出 schema。
 *
 * 用 `satisfies` 而不是 `Record<AgentId, ZodType>`：后者会把每个 schema 的
 * 具体类型 erase 成 `ZodType`，`z.infer` 就拿不到精确结构了。
 */
export const AGENT_OUTPUT_SCHEMAS = {
  teacher: TeacherOutputSchema,
  reviewer: ReviewerOutputSchema,
  examiner: ExaminerOutputSchema,
  assistant: AssistantOutputSchema,
} as const;

// 「4 个 Agent 都有输出 schema」必须编译期成立：新增 Agent 时若忘了给 schema，
// 运行时会在第一次调用时才炸，且错误信息是「schema 是 undefined」这种难查的形态。
export type __AssertSchemasCoverAgents = Expect<
  keyof typeof AGENT_OUTPUT_SCHEMAS extends AgentId ? true : false
>;
export type __AssertAgentsCoveredBySchemas = Expect<
  AgentId extends keyof typeof AGENT_OUTPUT_SCHEMAS ? true : false
>;