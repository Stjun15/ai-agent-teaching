/**
 * 「看到什么」的文本快照 —— 服务层模拟的 See 阶段
 *
 * 与 `screen-describer.ts` 的关系
 * -----------------------------
 * 那个文件用 Playwright 打开真实页面、解析 DOM 产出 `ScreenState`，是**离线工具**；
 * 本文件不启浏览器，而是把「产品里学生此刻屏幕上的内容」按同一语义拼成文本：
 * 页面标题、当前步骤、讲稿节选、对话记录。
 *
 * 为什么敢不用浏览器
 * ----------------
 * 教师端模拟要回答的问题是「这条讲解路线对零基础学生是否讲得通」，
 * 而这个问题**只取决于内容**（讲稿怎么分段、导师怎么回答），不取决于像素。
 * 用真实浏览器反而引入两个不可控量：页面是否已水合、SSE 时序 —— 一次模拟
 * 就变成一次端到端测试，失败原因分不清是内容问题还是环境问题。
 * 代价是**无法模拟「按钮点不动」这类交互缺陷**，这一层刻意不假装能测。
 *
 * 纯函数：不读文件、不查库、不调模型，可直接断言输出。
 */

import type { StepType } from "@/lib/db/types";

/** 步骤的中文名 —— 模拟学生看到的导航文案。 */
export const STEP_LABELS: Record<StepType, string> = {
  explain: "概念讲解",
  observe: "观察示范",
  imitate: "动手模仿",
  validate: "提交点评",
  visualize: "可视化",
  practice: "练习",
  mastery: "复习检测",
};

/** 快照里每段的截断长度（字符）。 */
export const DIGEST_LIMITS = {
  /** 讲稿节选。讲稿动辄数千字，全量塞进快照只会让模拟学生「读了答案」再提问。 */
  lecture: 1200,
  /** 对话记录的总额度，从最新往回保留整条。 */
  history: 2400,
  /** 单条历史消息的截断长度（防止某一条导师长文吃光整个额度）。 */
  perTurn: 400,
} as const;

export interface DigestTranscriptEntry {
  speaker: "student" | "mentor";
  content: string;
}

export interface ScreenDigestInput {
  moduleId: string;
  moduleName: string;
  step: StepType;
  /** 当前步骤的讲稿/教学脚本（调用方已按步骤裁好段落）。 */
  lectureText: string;
  /** 本次运行之前的对话，按时间升序。 */
  transcript: readonly DigestTranscriptEntry[];
}

/**
 * 截断到 `max` 字符，超出时保留尾部并加标记。
 *
 * 为什么保留尾部：对话最关键的永远是「刚说的那句」。讲稿不同（学生是从头读到
 * 卡住的位置），但讲稿本身是静态文档，截断哪一端都只是节选 —— 统一保留尾部
 * 在对话场景是对的，讲稿场景也不至于丢掉末尾的动手任务。
 */
export function truncateTail(text: string, max: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `…（前略）\n${trimmed.slice(trimmed.length - max)}`;
}

/** 历史记录按「最新优先、整条保留」取到额度上限。 */
export function keepRecentTranscript(
  transcript: readonly DigestTranscriptEntry[],
  budget: number = DIGEST_LIMITS.history,
): DigestTranscriptEntry[] {
  const kept: DigestTranscriptEntry[] = [];
  let used = 0;

  for (let i = transcript.length - 1; i >= 0; i -= 1) {
    const entry = transcript[i];
    const length = Math.min(entry.content.trim().length, DIGEST_LIMITS.perTurn);
    // 最新一条无条件保留（它就是「刚才在说什么」），其余按额度整条丢弃。
    if (kept.length > 0 && used + length > budget) break;
    kept.unshift(entry);
    used += length;
  }

  return kept;
}

/**
 * 组装文本快照。
 *
 * 结构刻意模仿「学生视线扫过页面」的顺序：先知道在哪一页、哪一步，
 * 再读到屏幕上的讲稿，最后是对话记录。字段名（页面/步骤/讲稿/对话）
 * 都是学生界面上的真实措辞，不出现 DOM 术语 —— 模拟学生的提示词里
 * 不该出现「selector」「data-slot」这类只有开发者懂的东西。
 */
export function buildScreenDigest(input: ScreenDigestInput): string {
  const { moduleId, moduleName, step, lectureText } = input;
  const transcript = keepRecentTranscript(input.transcript);

  const lines: string[] = [
    "【屏幕快照 · 文本版】",
    `页面：/learn/${moduleId} · ${moduleName}`,
    `当前步骤：${STEP_LABELS[step]}（${step}）`,
    "",
    "屏幕上显示的教学内容（节选）：",
    truncateTail(lectureText, DIGEST_LIMITS.lecture) || "（这一页暂时没有教学内容）",
    "",
    "对话记录：",
  ];

  if (transcript.length === 0) {
    lines.push("（还没有任何对话）");
  } else {
    for (const entry of transcript) {
      const label = entry.speaker === "student" ? "我" : "导师";
      lines.push(`${label}：${truncateTail(entry.content, DIGEST_LIMITS.perTurn)}`);
    }
  }

  return lines.join("\n");
}
