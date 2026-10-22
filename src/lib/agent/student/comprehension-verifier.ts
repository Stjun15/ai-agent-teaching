/**
 * 理解验证器 —— 验证有视力的学生是否"真懂了"
 *
 * 为什么不是现有 API 评分
 * ---------------------
 * `run.ts` 的 validate/practice 评分走的是 Schma 校验 + Rubric 打分，
 * 那是文本管道的事。视觉管道里学生是在浏览器里看的，他"看到"的
 * 内容和"说出"的内容之间的差距，才是理解的真实信号。
 *
 * 三条验证线索
 * ----------
 * 1. 行为信号 —— 注意力、犹豫、操作序列
 *    学生盯着关键段落看了多久？打字前犹豫多久？反复删改了几次？
 * 2. 提问相关性 —— 学生的问题和屏幕内容对得上吗？
 *    看完函数定义就问"什么是参数"，说明看进去了；
 *    看完函数定义就问"怎么装 Node.js"，说明跑偏了。
 * 3. 理解探针 —— 定期"听写抽查"
 *    基于当前屏幕内容生成一个事实性问题，把学生的回答和屏幕原文
 *    做语义交叉验证。
 *
 * 输出
 * ----
 * 每条线索产出一个 0~1 的分数 + 证据片段。
 * 三条线索加权汇总为 ComprehensionReport。
 *
 * 视觉模型调用
 * ----------
 * 线索 2、3 需要 VLM 做语义判断（「学生说的是不是屏幕上教的内容」），
 * 与 `vision-review.ts` 同一套调用模式——OpenAI 兼容协议，不 import SDK。
 */

import type {
  ScreenDescriberOptions,
  ScreenState,
  StudentAction,
} from "./types";

const VLM_TIMEOUT_MS = 90000;

async function vlmFetch(
  url: string,
  body: unknown,
  apiKey: string,
  retries = 1,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await Promise.race([
        fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        }),
        new Promise<Response>((_, reject) =>
          setTimeout(() => reject(new Error("VLM_TIMEOUT")), VLM_TIMEOUT_MS),
        ),
      ]);
      return res;
    } catch {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }
  return null;
}

// ---- 类型 ----

/** 一条验证线索的结果。 */
export interface ComprehensionClue {
  /** 线索名称。 */
  name: string;
  /** 0~1 分数。 */
  score: number;
  /** 判据（为什么给这个分）。 */
  evidence: string;
}

/** 完整理解报告。 */
export interface ComprehensionReport {
  /** 综合分 0~1。 */
  overallScore: number;
  /** 各线索详情。 */
  clues: ComprehensionClue[];
  /** 生成时间。 */
  timestamp: string;
}

/** 一条理解探针。 */
export interface ComprehensionProbe {
  /** 探针类型。 */
  type: "recall" | "paraphrase" | "apply" | "connect";
  /** 基于屏幕内容生成的问题。 */
  question: string;
  /** 屏幕中的标准答案片段（用于交叉验证）。 */
  groundTruth: string;
  /** 难度 0~1。 */
  difficulty: number;
}

// ---- 线索 1：行为信号 ----

/**
 * 分析学生操作序列中的行为信号。
 *
 * 判据（不靠模型，纯规则）：
 * - 看完消息后的停顿时间（长 = 在阅读）
 * - 打字速度（太慢 = 不熟练/在思考，太快 = 可能没看就瞎写）
 * - 是否有回删修正（有 = 在检查自己写的东西）
 * - 是否关注到关键 UI 区域
 */
function analyzeBehaviorSignals(
  action: StudentAction,
  previousActions: StudentAction[],
): ComprehensionClue {
  let score = 0.5;
  const evidence: string[] = [];

  // 停顿时间分析
  if (action.hesitationMs > 3000) {
    score += 0.15;
    evidence.push(
      `动作前犹豫 ${(action.hesitationMs / 1000).toFixed(1)}s——学生在思考`,
    );
  } else if (action.hesitationMs < 500) {
    score -= 0.1;
    evidence.push("动作几乎不假思索——可能没在认真读");
  }

  // 认知状态
  if (action.cognitiveState === "confused") {
    score += 0.1;
    evidence.push("学生处于困惑状态——承认不理解是理解的前兆");
  } else if (action.cognitiveState === "overconfident") {
    score -= 0.15;
    evidence.push("过度自信——可能以为自己懂了但其实没懂");
  }

  // 提问行为是正面信号
  if (action.type === "ask" && action.question && action.question.length > 10) {
    score += 0.1;
    evidence.push(`主动提问（${action.question.length} 字）`);
  }

  // 重复问同一类问题 → 第一次没懂
  if (previousActions.length > 0) {
    const lastAsk = [...previousActions]
      .reverse()
      .find((a) => a.type === "ask");
    if (lastAsk?.question && action.question) {
      const overlap = wordOverlap(lastAsk.question, action.question);
      if (overlap > 0.5) {
        score -= 0.1;
        evidence.push(
          `前后提问高度重叠（${(overlap * 100).toFixed(0)}%）——第一次没理解`,
        );
      } else if (overlap < 0.2) {
        score += 0.05;
        evidence.push("提问方向有变化——学生在跟进不同知识点");
      }
    }
  }

  // 是否有放弃信号
  if (action.type === "give_up") {
    score -= 0.3;
    evidence.push("学生放弃了当前任务");
  }

  return {
    name: "行为信号",
    score: Math.max(0, Math.min(1, score)),
    evidence: evidence.join("；"),
  };
}

// ---- 线索 2：提问相关性 ----

/**
 * 用 VLM 判断学生提问是否和屏幕内容相关。
 *
 * 不相关 = 学生看了半天看的不是要点，或者根本没看进去。
 */
async function evaluateQueryRelevance(
  question: string,
  screenContent: string,
  options: ScreenDescriberOptions,
): Promise<ComprehensionClue> {
  if (!question || question.length < 5 || !screenContent) {
    return {
      name: "提问相关性",
      score: 0,
      evidence: "无可分析内容",
    };
  }

  try {
    const response = await vlmFetch(
      `${options.visionBaseUrl}/chat/completions`,
      {
        model: options.visionModel,
        messages: [
          {
            role: "system",
            content: [
              "你是教学平台的理解评估器。你的任务是判断学生的提问是否与教学内容相关。",
              "",
              "评分规则（0-100）：",
              "- 90-100：提问精准命中了教学内容中的核心概念或关键细节",
              "- 70-89：提问与教学内容相关，但比较宽泛或不够聚焦",
              "- 50-69：提问和教学内容勉强沾边，但方向偏了",
              "- 30-49：提问与教学内容几乎无关，像是在问别的东西",
              "- 0-29：提问完全无关，学生可能没有阅读教学内容",
              "",
              '严格只返回 JSON：{"score": <0-100数字>, "reason": "<一句话判据>"}',
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              "教学内容：",
              screenContent.slice(0, 2000),
              "",
              "学生提问：",
              question,
            ].join("\n"),
          },
        ],
        max_tokens: 200,
        temperature: 0,
      },
      options.visionApiKey,
    );

    if (!response || !response.ok) {
      return {
        name: "提问相关性",
        score: 0.5,
        evidence: "VLM 调用失败，取默认中位值",
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = /\{[\s\S]*\}/.exec(raw);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as { score?: number; reason?: string })
      : {};

    return {
      name: "提问相关性",
      score: (parsed.score ?? 50) / 100,
      evidence: parsed.reason ?? "VLM 解析失败",
    };
  } catch {
    return {
      name: "提问相关性",
      score: 0.5,
      evidence: "评估请求异常",
    };
  }
}

// ---- 线索 3：理解探针 ----

/**
 * 基于屏幕内容生成一条理解探针。
 *
 * 难度层级：
 * - recall：直接问刚才看到的内容（最低层）
 * - paraphrase：让学生用自己的话说一遍（中层）
 * - apply：给一个新情境看学生能不能套用（高层）
 * - connect：和之前学过的概念建立联系（最高层）
 */
export async function generateProbe(
  state: ScreenState,
  previousProbes: ComprehensionProbe[],
  options: ScreenDescriberOptions,
): Promise<ComprehensionProbe> {
  // 难度递进：前瞻探过 → 升级难度
  const probeCount = previousProbes.length;
  const difficultyLevels: ComprehensionProbe["type"][] = [
    "recall",
    "paraphrase",
    "apply",
    "connect",
  ];
  const type =
    difficultyLevels[Math.min(probeCount, difficultyLevels.length - 1)];

  const chatContent =
    state.regions
      .find((r) => r.type === "chat-messages")
      ?.content.slice(0, 3000) ?? "";
  const codeContent =
    state.regions
      .find((r) => r.type === "code-editor")
      ?.content.slice(0, 1500) ?? "";

  const screenContent = [chatContent, codeContent]
    .filter(Boolean)
    .join("\n---\n");

  if (!screenContent) {
    return {
      type: "recall",
      question: "你刚才看到了什么内容？",
      groundTruth: "",
      difficulty: 0.2,
    };
  }

  try {
    const typeLabels: Record<string, string> = {
      recall: "回忆型（直接问屏幕上的内容）",
      paraphrase: "转述型（让学生用自己的话说一遍）",
      apply: "应用型（给一个新情境看能不能用）",
      connect: "联结型（和之前学过的概念建立联系）",
    };

    const response = await vlmFetch(
      `${options.visionBaseUrl}/chat/completions`,
      {
        model: options.visionModel,
        messages: [
          {
            role: "system",
            content: [
              "你是教学平台的理解探针生成器。基于教学内容生成一个理解检测问题。",
              "",
              "严格只返回 JSON：",
              '{"question": "<问题正文>", "groundTruth": "<屏幕中可作为标准答案的关键原文>", "difficulty": <0.0-1.0数字>}',
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `请生成一个**${typeLabels[type]}**的理解检测问题。`,
              "",
              "教学内容（屏幕上学生看到的）：",
              screenContent,
            ].join("\n"),
          },
        ],
        max_tokens: 400,
        temperature: 0.3,
      },
      options.visionApiKey,
    );

    if (!response || !response.ok) {
      return {
        type,
        question: "请用你自己的话概括刚才学到的内容。",
        groundTruth: screenContent.slice(0, 500),
        difficulty: 0.5,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = /\{[\s\S]*\}/.exec(raw);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as {
          question?: string;
          groundTruth?: string;
          difficulty?: number;
        })
      : {};

    return {
      type,
      question: parsed.question ?? "请用你自己的话概括刚才学到的内容。",
      groundTruth: parsed.groundTruth ?? "",
      difficulty: parsed.difficulty ?? 0.5,
    };
  } catch {
    return {
      type,
      question: "请用你自己的话概括刚才学到的内容。",
      groundTruth: screenContent.slice(0, 500),
      difficulty: 0.5,
    };
  }
}

/**
 * 评估学生对探针的回答质量。
 *
 * 把回答和 groundTruth 做语义交叉验证——不是简单比对字符串，
 * 而是用 VLM 判断「学生的回答是否体现了对原文关键点的理解」。
 */
export async function evaluateProbeAnswer(
  probe: ComprehensionProbe,
  studentAnswer: string,
  options: ScreenDescriberOptions,
): Promise<ComprehensionClue> {
  if (!studentAnswer || studentAnswer.length < 3) {
    return {
      name: "理解探针",
      score: 0,
      evidence: "学生未作答或答案过短",
    };
  }

  try {
    const response = await vlmFetch(
      `${options.visionBaseUrl}/chat/completions`,
      {
        model: options.visionModel,
        messages: [
          {
            role: "system",
            content: [
              "你是教学平台的理解评分器。评估学生的回答是否体现了对教学内容的真正理解。",
              "",
              "评分规则（0-100）：",
              "- 90-100：回答完全正确，抓住了关键概念，用词准确",
              "- 70-89：回答基本正确，但遗漏了一些细节或用词不够精确",
              "- 50-69：回答方向对但内容模糊，像是在猜而不是理解",
              "- 30-49：回答有较大偏差，核心概念搞混了",
              "- 0-29：回答完全错误或答非所问",
              "",
              "关键判据：",
              "- 不是比对字面相似度，而是判断学生对**核心概念**的把握",
              "- 学生用自己的话正确转述 = 高分（比复制粘贴原文更高）",
              "- 学生说「好像是」、「大概就是」这类模糊词 = 扣分",
              "",
              '严格只返回 JSON：{"score": <0-100数字>, "reason": "<一句话判据>"}',
            ].join("\n"),
          },
          {
            role: "user",
            content: [
              `问题：${probe.question}`,
              "",
              `标准答案参考（教学内容原文）：`,
              probe.groundTruth.slice(0, 1500),
              "",
              `学生回答：`,
              studentAnswer,
            ].join("\n"),
          },
        ],
        max_tokens: 200,
        temperature: 0,
      },
      options.visionApiKey,
    );

    if (!response || !response.ok) {
      const statusCode = response?.status ?? "TIMEOUT";
      let errBody = "";
      if (response && !response.ok) {
        errBody = await response.text().catch(() => "");
        console.error(
          `     [VLM ERROR] status=${statusCode} body=${errBody.slice(0, 200)}`,
        );
      } else {
        console.error("     [VLM ERROR] timeout or network error");
      }
      return {
        name: "理解探针",
        score: 0.5,
        evidence: `VLM 评分调用失败 (${statusCode})，取默认中位值`,
      };
    }

    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const raw = body.choices?.[0]?.message?.content ?? "{}";
    const jsonMatch = /\{[\s\S]*\}/.exec(raw);
    const parsed = jsonMatch
      ? (JSON.parse(jsonMatch[0]) as { score?: number; reason?: string })
      : {};

    const vlmScore = parsed.score ?? 50;
    const vlmReason = parsed.reason ?? "评分解析失败";

    // 兜底启发式：VLM 有时会给有内容重叠的答案判 0 分。
    // 当 VLM 分数 < 30 但答案和标准答案有显著重合时，用字面重叠率校准。
    let finalScore = vlmScore;
    let finalEvidence = vlmReason;

    if (vlmScore < 30) {
      const overlap = wordOverlap(studentAnswer, probe.groundTruth);
      if (overlap > 0.4) {
        finalScore = Math.round(Math.max(vlmScore, overlap * 80));
        finalEvidence = `VLM 判 ${vlmScore} 分，但答案和原文重叠率 ${(overlap * 100).toFixed(0)}%，校准至 ${finalScore} 分 — ${vlmReason}`;
      }
    }

    return {
      name: "理解探针",
      score: finalScore / 100,
      evidence: `难度${probe.difficulty.toFixed(1)} | ${finalEvidence}`,
    };
  } catch {
    return {
      name: "理解探针",
      score: 0.5,
      evidence: "评分请求异常",
    };
  }
}

// ---- 汇总 ----

/** 三条线索加权汇总。 */
export function summarizeComprehension(
  clues: ComprehensionClue[],
): ComprehensionReport {
  const weights: Record<string, number> = {
    行为信号: 0.25,
    提问相关性: 0.35,
    理解探针: 0.4,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const clue of clues) {
    const w = weights[clue.name] ?? 0.2;
    weightedSum += clue.score * w;
    totalWeight += w;
  }

  const overallScore = totalWeight > 0 ? weightedSum / totalWeight : 0.5;

  return {
    overallScore,
    clues,
    timestamp: new Date().toISOString(),
  };
}

/** 对一条学生动作做完整的理解验证（线索 1 + 线索 2，线索 3 需要探针先行）。 */
export async function verifyComprehension(
  state: ScreenState,
  action: StudentAction,
  previousActions: StudentAction[],
  options: ScreenDescriberOptions,
): Promise<ComprehensionReport> {
  const clues: ComprehensionClue[] = [];

  // 线索 1：行为信号（纯规则，不调模型）
  clues.push(analyzeBehaviorSignals(action, previousActions));

  // 线索 2：提问相关性（调 VLM）
  if (action.type === "ask" && action.question) {
    const chatContent =
      state.regions
        .find((r) => r.type === "chat-messages")
        ?.content.slice(0, 2000) ?? "";
    const clue = await evaluateQueryRelevance(
      action.question,
      chatContent,
      options,
    );
    clues.push(clue);
  }

  return summarizeComprehension(clues);
}

// ---- 工具 ----

/** 两个字符串的词语重叠率（0~1）。简易分词：按 2-gram 统计。 */
function wordOverlap(a: string, b: string): number {
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      set.add(s.slice(i, i + 2));
    }
    return set;
  };
  const setA = bigrams(a);
  const setB = bigrams(b);
  if (setA.size === 0 || setB.size === 0) return 0;
  let overlap = 0;
  for (const gram of setA) {
    if (setB.has(gram)) overlap++;
  }
  return overlap / Math.max(setA.size, setB.size);
}