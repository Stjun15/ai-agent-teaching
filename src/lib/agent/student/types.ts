/**
 * 学生 Agent 视觉层 —— 类型定义
 *
 * 这一层为「有视力的学生」建模，把浏览器屏幕状态转成学生能"读到"的结构化描述。
 * 所有类型与现有的 persona 引擎（`scripts/student-agent/persona.ts`）的输出方向
 * 完全正交——persona 管「学生怎么说」，本文件管「学生看到了什么」。
 */

/** 屏幕上的语义区域。 */
export interface ScreenRegion {
  /** 区域类型。 */
  type: ScreenRegionType;
  /** 人可读标签（如「导师消息区」）。 */
  label: string;
  /** 提取出的文本内容（DOM 文本或 OCR 结果）。代码区域保留原始缩进。 */
  content: string;
  /** 区域在视口中的边界（像素），用于视觉显著性计算。 */
  bounds: Bounds;
  /** 区域内的交互元素（按钮、链接、输入框）列表。 */
  interactables: Interactable[];
}

/** 语义区域类型。 */
export type ScreenRegionType =
  | "chat-messages"
  | "code-editor"
  | "composer"
  | "step-nav"
  | "diagram"
  | "toast"
  | "modal"
  | "error-panel"
  | "sidebar"
  | "topbar"
  | "other";

/** 一个交互元素。 */
export interface Interactable {
  /** 元素类型。 */
  kind: "button" | "link" | "input" | "select" | "tab";
  /** 显示文本或 aria-label。 */
  label: string;
  /** 是否当前被禁用。 */
  disabled: boolean;
  /** 元素在视口中的边界。 */
  bounds: Bounds;
}

/** 视口坐标边界。 */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 一轮「看屏幕」的完整输出。 */
export interface ScreenState {
  /** 当前页面 URL。 */
  url: string;
  /** 页面标题。 */
  title: string;
  /** 当前步骤（从 URL 或导航提取）。 */
  step: string | null;
  /** 语义区域列表。 */
  regions: ScreenRegion[];
  /** 截图的 base64（可选，用于 VLM 兜底分析时回传给模型）。 */
  screenshotBase64?: string;
  /** 采集时间戳。 */
  capturedAt: string;
}

/** 学生 Agent 的认知状态。 */
export type CognitiveState =
  "normal" | "stuck" | "confused" | "overconfident" | "bored" | "giving_up";

/** 一个概念的遗忘曲线条目。 */
export interface MemoryEntry {
  /** 概念标识符。 */
  conceptId: string;
  /** 概念人可读名称。 */
  label: string;
  /** 当前记忆强度 0~1。1 = 记得很清楚。 */
  strength: number;
  /** 最近一次复习/接触的时间戳。 */
  lastReviewed: string;
  /** 半衰期（毫秒）——到达此时间后强度降至 0.5。 */
  halfLifeMs: number;
  /** 被其他概念干扰的次数。 */
  interferenceCount: number;
}

/** 学生决策模型的输出。 */
export interface StudentAction {
  /** 动作类型。 */
  type: "click" | "type" | "navigate" | "wait" | "ask" | "give_up";
  /** 目标描述（匹配 ScreenRegion.interactables 的 label 或区域 type）。 */
  target: string;
  /** 输入内容（type 动作时使用）。 */
  content?: string;
  /** 动作前的犹豫时间（毫秒）。 */
  hesitationMs: number;
  /** 学生当前认知状态。 */
  cognitiveState: CognitiveState;
  /** 如果 type=ask，这是学生要说的内容。 */
  question?: string;
}

/** 屏幕描述器的配置。 */
export interface ScreenDescriberOptions {
  /** 教学平台的基础 URL（如 http://localhost:3311）。 */
  baseUrl: string;
  /** 学生 ID（用于识别与平台交互时的身份）。 */
  studentId: string;
  /** 视觉模型 ID（用于 VLM 兜底分析代码/图表）。 */
  visionModel: string;
  /** 视觉模型 API Key。 */
  visionApiKey: string;
  /** 视觉模型 OpenAI 兼容端点。 */
  visionBaseUrl: string;
  /** 代理端点 URL。设置后优先走代理，无需 visionApiKey。 */
  proxyUrl?: string;
}