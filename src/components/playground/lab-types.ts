/**
 * 沙箱实验的字段契约
 *
 * 把「一个实验由哪些输入组成」这层定义单独放，是因为它有**两个消费方**：
 *   1. 实验清单（`lab-experiments.ts`）—— 声明每个端点要哪些字段；
 *   2. 运行器（`playground-lab.tsx`）—— 按 `kind` 决定渲染成什么输入控件、
 *      以及把字符串转成什么类型。
 * 两边共享同一份类型定义，才不会出现「清单里声明是数字、运行器按字符串发出去」。
 *
 * 本文件不 import 任何模块 —— 纯类型与守恒常量，Node 里可直接引用。
 */

/** 输入框类型。`textarea` 用于要写一段 Prompt 的地方。 */
export type LabFieldKind = "text" | "textarea" | "select" | "number";

export interface LabField {
  /** 请求体里的键名（与 `schemas/api.ts` 对应 schema 逐字一致）。 */
  key: string;
  label: string;
  kind: LabFieldKind;
  placeholder?: string;
  /** `select` 的可选项。 */
  options?: readonly { value: string; label: string }[];
  min?: number;
  max?: number;
  /**
   * 取值来自**模块列表**而不是写死的枚举。
   *
   * 模块 id 的权威来源是 wiki 概念页 frontmatter（`lib/modules.ts` 现读），
   * 在这里抄一份 9 个 id 会立刻产生第二份口径 —— 加一个概念页就得记得改两处。
   */
  source?: "modules";
  /** 一句话说明这个字段在教什么。沙箱的意义是看懂，不是填完。 */
  help?: string;
}

/** 已按 `kind` 转换过类型的字段值；留空的可选字段是 `undefined`。 */
export type LabValues = Record<string, string | number | undefined>;

export interface LabContext {
  studentId: string;
  /** 运行前自动创建的会话 id；`needsSession` 为 false 的端点拿不到它。 */
  sessionId: string | null;
}

export interface LabExperiment {
  id: string;
  /** 标签页上的名字。 */
  label: string;
  endpoint: string;
  /** 这个端点背后是哪个 Agent（`04-frontend.md` 的四个 Agent）。 */
  agentLabel: string;
  description: string;
  fields: readonly LabField[];
  /** 运行前是否需要先建会话（`validate` / `explain` / `answer` 要 sessionId）。 */
  needsSession: boolean;
  /**
   * 运行是否真的调用模型。知识库检索是本地加权关键词检索（不出网、
   * 毫秒级返回），页脚的「消耗 token」提示对它就是假话 —— 按能力声明，
   * 不准确的全局文案比没有文案更糟。
   */
  usesModel?: boolean;
  /**
   * 已转好类型的值 → 请求体。
   *
   * 服务端一律用 Zod 校验（铁律：路由里不许直接读 `req.json()` 的字段），
   * 所以这里**不做**任何类型兜底 —— 少给字段就让服务端报 `INVALID_INPUT`，
   * 那 400 的原文本身就是沙箱要展示的东西。
   */
  build: (values: LabValues, context: LabContext) => unknown;
}

/**
 * 把输入框里的原始字符串按字段类型转换。
 *
 * 空字符串一律转成 `undefined`（而不是 `0` 或 `""`）：可选字段「留空」的语义是
 * **不发送这个字段**，让服务端的 `.default()` 生效。把空串硬转成 0 会让
 * `difficulty: 0` 撞上 `min(1)` 报 400，而学生只是没填而已。
 *
 * 数字字段填了非数字时**原样保留字符串**：服务端会给出「期望数字、收到字符串」
 * 的原文报错，这比在这里悄悄变成 `NaN` 更说明问题（`NaN` 序列化成 `null`，
 * 报错会变成一句令人费解的「期望数字、收到 null」）。
 */
export function coerceValue(
  field: LabField,
  raw: string,
): string | number | undefined {
  const trimmed = raw.trim();
  if (trimmed === "") return undefined;
  if (field.kind !== "number") return trimmed;

  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? trimmed : parsed;
}

/**
 * 沙箱里模块下拉的一个选项。
 *
 * 只带 `id` / `name` 两项：模块的摘要、标签、前置依赖都在服务端算好了，
 * 整套模块对象打进客户端包是不必要的水。
 */
export interface PlaygroundModule {
  id: string;
  name: string;
}

/**
 * 一次运行的结果。
 *
 * 成功与失败**都保留实际发出的请求体**：沙箱要说清楚的是「你填的东西变成了
 * 什么样的请求」，失败时这一点同样成立 —— 甚至更重要，因为报错就是由它引起的。
 */
export type LabOutcome =
  | { ok: true; request: unknown; data: unknown; ms: number }
  | {
      ok: false;
      request: unknown;
      code: string;
      message: string;
      recoverable: boolean;
      ms: number;
    };
