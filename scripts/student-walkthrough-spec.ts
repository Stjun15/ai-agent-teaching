/**
 * 学生模拟走测 v2 —— 全流程：11 模块学习 + 教学平台复刻
 *
 * 出发点
 * -----
 * v1 只测了 9 模块的概念学习。v2 加入了：
 * - 每模块的**代码/提示词产出**（不是光聊，要动手）
 * - 最终**教学平台复刻**（从 npx create-next-app 开始搭建完整平台）
 * - 学生 Agent **降智**：v1 太聪明了，v2 模拟真正初学者的困惑和错误
 *
 * 两阶段
 * ------
 * Phase 1：11 模块（2 编程基础 + 9 AI 专题），每模块 3 轮对话 + 1 次动手产出
 *   → 产出存到 walkthrough-output/prompts/ 和 walkthrough-output/code/
 * Phase 2：教学平台复刻
 *   → 完整项目存到 walkthrough-output/replica/
 *
 * 运行
 * ----
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/student-walkthrough-spec.ts
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { SSEEventInput } from "@/schemas";
import { createSession } from "@/lib/agent/session";

// ==========================================================================
// 输出目录
// ==========================================================================

const OUT_DIR = join(import.meta.dirname ?? ".", "..", "walkthrough-output");
mkdirSync(join(OUT_DIR, "prompts"), { recursive: true });
mkdirSync(join(OUT_DIR, "code"), { recursive: true });
mkdirSync(join(OUT_DIR, "reflections"), { recursive: true });
mkdirSync(join(OUT_DIR, "replica"), { recursive: true });

// ==========================================================================
// 学生 Agent 系统提示词（对话模式）
// ==========================================================================

const STUDENT_SYSTEM_PROMPT = [
  "你是正在学 AI Agent 开发的一名普通初学者。你的真实画像：",
  "",
  "知识背景：",
  "- 会用 Python 写简单脚本（循环、if、函数），懂一点 TypeScript 语法",
  "- 听过 ChatGPT 但从来没调过 API，完全不懂 LLM/Agent/工具调用/向量/RAG 这些",
  "- 上次学的概念转眼就忘，术语经常记串（比如把 'embedding' 说成 'encoding'）",
  "- 看代码能看懂大概，自己写就各种出小错",
  "",
  "性格（重要——这才是真初学者）：",
  "- **健忘**：AI 刚讲过的东西下一轮就记不清了，需要 AI 重复或换个说法",
  "- **不求甚解**：不会追问深层原理，关心的是「这个东西能干什么」「怎么写才对」",
  "- **容易卡住**：遇到报错就慌了，会直接说「报错了怎么办」",
  "- **爱抄代码**：喜欢先抄一个能跑的版本，再在上面改",
  "- **术语混乱**：经常把专业名词说错或说得很口语（「那个向量…就是那个数字数组」）",
  "- **小成就大兴奋**：调通一个 API 会很开心，但下一分钟又忘了刚才怎么写",
  "- **怕抽象**：不喜欢「架构」「范式」这些词，喜欢具体的例子和代码",
  "- **会放弃**：卡住太久会换一个问题或者换个写法，不会死磕",
  "",
  "你的任务：",
  "根据当前情境，生成你作为学生的下一句话。",
  "",
  "对话风格：",
  "- 用口语，不用书面语（「那个」代替「该」，不要说「请」「您」）",
  "- 1-3 句话，不啰嗦",
  "- 困惑时直接说「没听懂」，不要装懂",
  "- **不要**输出任何解释或旁白，只输出你作为学生说的话",
].join("\n");

// ==========================================================================
// 学生 Agent 系统提示词（产出模式——对话人格截断，专注产出质量）
// ==========================================================================

const STUDENT_PRODUCE_SYSTEM_PROMPT = [
  "你是正在学 AI Agent 开发的一名初学者。你的知识水平：",
  "- 会用 Python 写简单脚本（循环、if、函数），懂一点 TypeScript 语法",
  "- 听过 ChatGPT 但从来没调过 API",
  "- 刚听完老师的讲解，现在要把学到的知识转化为实际产出",
  "",
  "你的任务：",
  "不再对话。根据情境产出实际的代码或提示词文档。",
  "",
  "产出规则（必须遵守）：",
  "1. 只输出代码/文档本身，不要任何解释或旁白",
  "2. 产出必须完整——不能只写骨架或一两句话应付",
  "3. 代码要能跑：import 写全、函数签名正确、变量名用英文",
  "4. 提示词要完整：分节组织、覆盖关键规则",
  "5. 基于上下文中的教学内容和代码示例来写——不要凭空编造",
].join("\n");

// ==========================================================================
// 工具
// ==========================================================================

const BASE = "http://localhost:3000";

async function studentSay(context: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let text = "";
  const handle = await createSession({
    systemPrompt: STUDENT_SYSTEM_PROMPT,
    signal: controller.signal,
    onEvent: (event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        text += event.assistantMessageEvent.delta;
      }
    },
  });
  try {
    await handle.prompt(context);
  } finally {
    clearTimeout(timeout);
    handle.dispose();
  }
  let trimmed = text.trim();

  if (trimmed.length > 200) {
    const sentences = trimmed.split(/(?<=[。！？])/);
    if (sentences.length > 3) {
      trimmed = sentences.slice(0, 3).join("").trim();
    }
  }
  return trimmed;
}

/** 让学生 Agent 产生一段代码或提示词（强制产出，非对话） */
async function studentProduce(
  context: string,
  kind: string,
): Promise<{
  text: string;
  savedPath: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  let text = "";
  const producePrompt = [
    STUDENT_PRODUCE_SYSTEM_PROMPT,
    "",
    "你当前的产出任务（" + kind + "）：",
  ].join("\n");

  const handle = await createSession({
    systemPrompt: producePrompt,
    signal: controller.signal,
    onEvent: (event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        text += event.assistantMessageEvent.delta;
      }
    },
  });
  try {
    await handle.prompt(context);
  } finally {
    clearTimeout(timeout);
    handle.dispose();
  }
  return { text: text.trim(), savedPath: null };
}

function saveOutput(
  category: "prompts" | "code" | "reflections",
  filename: string,
  content: string,
): string | null {
  if (!content.trim()) return null;
  const path = join(OUT_DIR, category, filename);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, "utf-8");
  console.log(
    `      💾 已保存：${category}/${filename} (${content.length} 字符)`,
  );
  return path;
}

async function teachingSay(
  content: string,
  moduleId: string,
  step = "explain",
): Promise<{
  fullText: string;
  tokens: { input: number; output: number } | null;
  error: string | null;
}> {
  const first = await teachingSayOnce(content, moduleId, step);
  if (!first.error) return first;
  console.log(`      🔄 重试中（${first.error.slice(0, 80)}）...`);
  await sleep(3000);
  return teachingSayOnce(content, moduleId, step);
}

async function teachingSayOnce(
  content: string,
  moduleId: string,
  step: string,
): Promise<{
  fullText: string;
  tokens: { input: number; output: number } | null;
  error: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);

  const makeRequest = async (): Promise<Response | null> => {
    try {
      return await fetch(`${BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, moduleId, step }),
        signal: controller.signal,
      });
    } catch {
      return null;
    }
  };

  let response = await makeRequest();

  if (response === null) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await sleep(3000);
      console.log(`      🔄 dev server 重连 (${attempt + 1}/3)…`);
      response = await makeRequest();
      if (response !== null) break;
    }
    if (response === null) {
      return {
        fullText: "",
        tokens: null,
        error: "dev server 无法连接（3 次重连均失败）",
      };
    }
  }

  if (!response.ok) {
    const body = await response.text();
    const statusLabel =
      response.status === 429
        ? "触发限流 (429)——Ark 平台端的并发/速率限制"
        : `HTTP ${response.status}`;
    return {
      fullText: "",
      tokens: null,
      error: `${statusLabel}: ${body.slice(0, 200)}`,
    };
  }
  if (!response.body) {
    return { fullText: "", tokens: null, error: "空响应" };
  }

  try {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let tokens: { input: number; output: number } | null = null;
    const contents: string[] = [];

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
        for (const line of frame.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6)) as SSEEventInput;
            if (event.type === "done" && event.data.tokens) {
              tokens = event.data.tokens;
            }
            if (event.type === "token") {
              contents.push(event.data.content);
            }
          } catch {
            /* skip corrupt frames */
          }
        }
      }

      process.stdout.write(".");
    }

    return { fullText: contents.join(""), tokens, error: null };
  } catch {
    return { fullText: "", tokens: null, error: "超时（180s）或网络中断" };
  } finally {
    clearTimeout(timeout);
  }
}

async function loadConceptPage(
  moduleId: string,
): Promise<{ content: string; error: string | null }> {
  const resp = await fetch(`${BASE}/api/module-content?moduleId=${moduleId}`);
  if (!resp.ok) {
    return { content: "", error: `HTTP ${resp.status}` };
  }
  return { content: await resp.text(), error: null };
}

function excerpt(text: string, length = 150): string {
  return text.replace(/\n/g, " ").slice(0, length).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================================================
// 走测记录
// ==========================================================================

interface TurnRecord {
  turn: number;
  studentSays: string;
  aiSays: string;
  aiLength: number;
  tokens?: { input: number; output: number };
  ok: boolean;
  error?: string;
}

interface ModuleWalkResult {
  moduleId: string;
  name: string;
  conceptSummary: string;
  conceptOk: boolean;
  turns: TurnRecord[];
  /** 学生动手产出（代码或提示词） */
  output: { kind: string; text: string; savedPath: string | null } | null;
  assessment: string;
}

interface PlatformReplicaResult {
  /** 产出的文件路径列表 */
  files: string[];
  /** 最终学习心得 */
  reflection: string;
  /** 整体评估 */
  assessment: string;
  ok: boolean;
}

interface QuizResult {
  /** 自由回忆说了几个关键概念（0-3） */
  recallCount: number;
  recallText: string;
  /** 选择题答对几个（0-5） */
  mcScore: number;
  mcDetails: { question: string; correct: boolean }[];
  /** 综合评级 */
  grade: "pass" | "weak" | "fail";
}

const CHECKPOINT_FILE = "walkthrough-output/.phase1-checkpoint.json";

function saveCheckpoint(results: ModuleWalkResult[]): void {
  const dir = join(import.meta.dirname ?? ".", "..");
  writeFileSync(
    join(dir, CHECKPOINT_FILE),
    JSON.stringify(results, null, 2),
    "utf-8",
  );
}

function loadCheckpoint(): ModuleWalkResult[] {
  const dir = join(import.meta.dirname ?? ".", "..");
  const path = join(dir, CHECKPOINT_FILE);
  if (!existsSync(path)) {
    console.error(`❌ 未找到 checkpoint：${CHECKPOINT_FILE}`);
    console.error("   请先完整运行一次 Phase 1（不加 --phase=2）");
    process.exit(1);
  }
  return JSON.parse(readFileSync(path, "utf-8")) as ModuleWalkResult[];
}

// ==========================================================================
// 知识验收：5 道选择题 + 3 题自由回忆
// ==========================================================================

const MC_QUESTIONS = [
  {
    id: 1,
    question:
      "在 LLM API 调用中，system、user、assistant 三种消息角色中，哪一个是用来设定 AI 整体行为规则的？",
    options: { A: "user", B: "system", C: "assistant", D: "function" },
    answer: "B",
    module: "llm-api",
  },
  {
    id: 2,
    question: "Agent Loop 的核心机制是？",
    options: {
      A: "AI 一次性输出所有结果",
      B: "AI 连续多轮调用自己，每次不记得上次",
      C: "AI 用一个循环不断调用 LLM 并根据结果决定下一步",
      D: "AI 在后台默默运行不显示过程",
    },
    answer: "C",
    module: "agent-loop",
  },
  {
    id: 3,
    question: "工具调用（Function Calling）中，AI 到底做了什么？",
    options: {
      A: "LLM 直接执行了工具函数",
      B: "LLM 输出了想调用的函数名和参数，由代码来真正执行",
      C: "工具函数在 LLM 内部运行",
      D: "LLM 通过网络调用外部 API",
    },
    answer: "B",
    module: "tool-calling",
  },
  {
    id: 4,
    question: "RAG（检索增强生成）解决了大模型的什么问题？",
    options: {
      A: "模型回答太慢",
      B: "模型不知道你私有文档里的内容",
      C: "模型太贵",
      D: "模型代码有 bug",
    },
    answer: "B",
    module: "rag",
  },
  {
    id: 5,
    question: "MCP 协议的主要目的是？",
    options: {
      A: "让 AI 写代码更快",
      B: "统一 AI 与外部工具的连接方式，避免每个工具都要手写适配代码",
      C: "替代 HTTP 协议",
      D: "提升 AI 的推理速度",
    },
    answer: "B",
    module: "mcp",
  },
];

async function adminQuiz(
  phase1Results: ModuleWalkResult[],
): Promise<QuizResult> {
  console.log(`\n${"-".repeat(55)}`);
  console.log("  📝 知识验收：先热身 3 问自由回忆 + 5 道选择题");
  console.log(`${"-".repeat(55)}`);

  // ---- 自由回忆：3 个关键概念 ----
  const recallCtx = [
    "你昨天学了 11 个模块：",
    phase1Results.map((r) => `- ${r.name}`).join("\n"),
    "",
    "现在闭上眼回忆一下——不用翻笔记——说 3 个你还记得的关键概念。",
    "每个只用 1 句话解释（不要说「我记得」「学过」这类废话）。",
    "如果某个模块完全想不起来了就说「完全忘了」，不要编。",
  ].join("\n");

  const recallResponse = await studentSay(recallCtx);

  // 统计提到几个模块关键词
  const moduleKeywords: Record<string, string[]> = {
    "python-basics": [
      "python",
      "变量",
      "函数",
      "循环",
      "dict",
      "list",
      "类型标注",
      "for",
    ],
    "ts-basics": [
      "typescript",
      "interface",
      "类型",
      "箭头函数",
      "filter",
      "type",
      "数组",
    ],
    "llm-api": [
      "LLM",
      "API",
      "模型",
      "chat",
      "completion",
      "预测",
      "下一个",
      "token",
    ],
    "system-prompt": [
      "system",
      "prompt",
      "提示词",
      "角色",
      "说明书",
      "约束",
      "规则",
    ],
    "agent-loop": ["agent", "loop", "循环", "多步", "多轮", "自己调"],
    "tool-calling": ["工具", "function", "tool", "天气", "定义工具", "参数"],
    rag: ["RAG", "检索", "向量", "embedding", "文档", "知识库", "私有"],
    "llm-wiki": ["wiki", "百科", "结构化", "知识"],
    "multi-agent": ["多 agent", "多智能体", "协作", "并行", "交接"],
    mcp: ["MCP", "协议", "统一", "连接", "标准"],
    "ai-safety": [
      "安全",
      "注入",
      "prompt injection",
      "防护",
      "过滤",
      "输入",
      "沙箱",
    ],
  };

  let recallCount = 0;
  const recallLower = recallResponse.toLowerCase();
  for (const [, keywords] of Object.entries(moduleKeywords)) {
    if (keywords.some((kw) => recallLower.includes(kw.toLowerCase()))) {
      recallCount++;
    }
  }

  console.log(
    `\n  💬 自由回忆：「${recallResponse.slice(0, 120)}${recallResponse.length > 120 ? "…" : ""}」`,
  );
  console.log(`     → 覆盖 ${recallCount}/11 个模块`);

  // ---- 选择题：5 道 ----
  console.log("");
  const mcDetails: { question: string; correct: boolean }[] = [];
  let mcScore = 0;

  for (const q of MC_QUESTIONS) {
    const mcPrompt = [
      "来一道选择题。只回答字母 A/B/C/D，不要解释。",
      "",
      q.question,
      ...Object.entries(q.options).map(([k, v]) => `${k}. ${v}`),
    ].join("\n");

    const answer = await studentSay(mcPrompt);
    const picked = answer.trim().toUpperCase().slice(0, 1);
    const correct = picked === q.answer;
    if (correct) mcScore++;
    mcDetails.push({ question: q.question.slice(0, 60), correct });

    console.log(
      `  [${q.id}/5] ${correct ? "✅" : "❌"} ` +
        `回答「${picked || "无"}」期望「${q.answer}」 | ${q.question.slice(0, 50)}…`,
    );
    await sleep(1000);
  }

  // ---- 综合评级 ----
  let grade: "pass" | "weak" | "fail";
  if (recallCount >= 3 && mcScore >= 3) grade = "pass";
  else if (recallCount >= 2 && mcScore >= 2) grade = "weak";
  else grade = "fail";

  console.log(
    `\n  🏆 综合评级：${grade === "pass" ? "✅ 合格" : grade === "weak" ? "⚠️ 薄弱" : "❌ 需要重学"}`,
  );
  console.log(`     自由回忆 ${recallCount}/3+ | 选择题 ${mcScore}/5`);

  return { recallCount, recallText: recallResponse, mcScore, mcDetails, grade };
}

// ==========================================================================
// 模块定义 —— Phase 1
// ==========================================================================

interface ModuleDef {
  id: string;
  name: string;
  coldStartInstruction: string;
  /** 产出要求：学生在本模块学完后要产出什么 */
  outputKind: "prompt" | "code";
  outputTask: string;
  outputFilename: string;
}

const MODULES: ModuleDef[] = [
  {
    id: "python-basics",
    name: "Python 基础速通",
    coldStartInstruction:
      "你刚看到「Python 基础速通」这个标题。你心里想：我 Python 会一点点，" +
      "但从来没用它写过和 AI 有关的东西。这个速通到底是干嘛的——是重学一遍 Python 还是学 AI 专用写法？",
    outputKind: "code",
    outputTask:
      "写一段 Python 代码热身。要求：\n" +
      "1) 定义一个函数 greet(name: str) -> str，返回问候语\n" +
      "2) 用 if/else 判断一个分数是否及格（>= 60）\n" +
      "3) 用 for 循环打印列表里的每一项\n" +
      "4) 用一个 dict 存一个学生的信息（name, score, passed）\n" +
      "5) 代码能直接 python 运行，单文件，不打任何包。",
    outputFilename: "00-python-basics.py",
  },
  {
    id: "ts-basics",
    name: "TypeScript 基础速通",
    coldStartInstruction:
      "你刚看到「TypeScript 基础速通」这个标题。你心里咯噔一下：TypeScript 是 JavaScript 的那个什么「加类型版」是吧？" +
      "Python 好歹写过，这个完全没碰过——后面那些模块是不是都要用 TS 写？那我得先搞清楚最基本的。",
    outputKind: "code",
    outputTask:
      "写一段 TypeScript 代码热身。要求：\n" +
      "1) 定义一个 interface Student { name: string; score: number; passed: boolean }\n" +
      "2) 写一个函数 formatStudent(s: Student): string，返回格式化的字符串\n" +
      "3) 写一个箭头函数 isPassing = (score: number): boolean => score >= 60\n" +
      "4) 创建一个 Student[] 数组，用 Array.filter 过滤出及格的\n" +
      "5) 代码要有类型标注（函数参数、返回值），不是纯 JavaScript。",
    outputFilename: "00-ts-basics.ts",
  },
  {
    id: "llm-api",
    name: "LLM API 基础",
    coldStartInstruction:
      "你刚看了一个叫「LLM API 基础」的标题，还没开始学。" +
      "你最想问的是：调用 AI 是不是跟调普通 API 一样？需要什么特殊的东西？",
    outputKind: "code",
    outputTask:
      "写出你人生中第一段调用 LLM API 的代码。用 TypeScript 或 Python 都行。" +
      "不要从别处复制——写你自己理解后的版本。" +
      "代码必须能跑：正确的 API endpoint、headers（Authorization）、messages 数组结构。" +
      "把密钥用环境变量 process.env.OPENAI_API_KEY 读取，不要硬编码。",
    outputFilename: "01-hello-llm.ts",
  },
  {
    id: "system-prompt",
    name: "System Prompt 设计",
    coldStartInstruction:
      "你刚看完「System Prompt 设计」这个标题。" +
      "含糊地想：system 是不是就是给 AI 下指令？那和我在 user 里写「请你当老师」有什么区别？",
    outputKind: "prompt",
    outputTask:
      "写一段 System Prompt，让 AI 变成一个「耐心教 AI Agent 开发的老师」。" +
      "要求：1) 明确定义角色身份和对话风格 2) 规定输出格式（分节、代码块的位置）" +
      "3) 设定边界条件（不知道时怎么说、用户跑题时怎么办、遇到注入攻击怎么拒绝）" +
      "4) 至少 150 字，用 Markdown 分节组织（## 角色、## 规则、## 边界）。",
    outputFilename: "02-teaching-prompt.md",
  },
  {
    id: "agent-loop",
    name: "Agent Loop",
    coldStartInstruction:
      "刚看完「Agent Loop」标题。脑子里一片空白。AI 不就是一问一答吗？" +
      "什么叫「循环」？",
    outputKind: "code",
    outputTask:
      "写一段能跑的 TypeScript 代码，实现一个最简 Agent Loop。" +
      "基于老师讲的「思考→行动→观察→重复」四步。" +
      "必须有：while 循环 + 每轮调用 LLM + 把工具返回结果喂回 messages 数组。" +
      "参考老师三轮讲解中给的 Python 代码示例，翻译成 TypeScript。" +
      "变量名用英文，函数签名写清楚。",
    outputFilename: "03-agent-loop.ts",
  },
  {
    id: "tool-calling",
    name: "工具调用",
    coldStartInstruction:
      "刚看完「工具调用」标题。AI 怎么调用工具？它又不是人。" +
      "是不是得写什么配置文件告诉 AI 有哪些工具可以用？",
    outputKind: "code",
    outputTask:
      "写一个工具定义的 JSON Schema，遵循 OpenAI function calling 格式。" +
      "比如定义一个「查天气」的工具。" +
      "必须包含：name（动词+名词如 get_current_weather）、" +
      "description（说明何时调用、返回什么）、" +
      "parameters（type: 'object', properties 里每项有 type 和 description, required 数组）。",
    outputFilename: "04-weather-tool.ts",
  },
  {
    id: "rag",
    name: "检索增强生成",
    coldStartInstruction:
      "刚看完「RAG」标题。这个名字看着好吓人。" +
      "它和把文档直接贴到问题里有啥区别？不就是多了一步搜索吗？",
    outputKind: "prompt",
    outputTask:
      "写一段完整的 RAG System Prompt。要求：" +
      "1) 告诉 AI 只能根据提供的资料回答 2) 找不到时明确说「我不知道」" +
      "3) 要求引用资料来源 4) 说明上下文注入格式（资料将以什么形式出现在 prompt 里）。" +
      "至少 100 字，分条写清楚。",
    outputFilename: "05-rag-prompt.md",
  },
  {
    id: "llm-wiki",
    name: "LLM Wiki",
    coldStartInstruction:
      "刚看完「LLM Wiki」标题。Wiki 不是维基百科吗？" +
      "和之前学的 RAG 有什么区别？感觉又像又不像。",
    outputKind: "code",
    outputTask:
      "写一个 Wiki 条目的完整数据结构。" +
      "TypeScript interface 或 Python dataclass。" +
      "必须包含字段：title, content, tags, createdAt, updatedAt。" +
      "另外写一个 WikiStore 类或对象，支持 add(entry) 添加条目和 search(keyword) " +
      "按标题和标签搜索。search 返回匹配的条目数组。",
    outputFilename: "06-wiki-struct.ts",
  },
  {
    id: "multi-agent",
    name: "多 Agent 协作",
    coldStartInstruction:
      "刚看完「多 Agent 协作」标题。一个 Agent 都搞不明白，还多个？" +
      "它们怎么交流？谁指挥谁？",
    outputKind: "prompt",
    outputTask:
      "设计两个 Agent 的分工描述：一个「代码生成 Agent」和一个「代码审查 Agent」。" +
      "写出它们各自的完整 System Prompt（每个至少 100 字）。" +
      "然后写一段 3-5 句话的协作流程说明：谁先运行、审查结果怎么传回生成者、修改后如何确认。",
    outputFilename: "07-two-agents.md",
  },
  {
    id: "mcp",
    name: "MCP 协议",
    coldStartInstruction:
      "刚看完「MCP 协议」标题。M、C、P 各代表什么来着？" +
      "这跟工具调用感觉差不多——都是让 AI 调用外部东西，为什么要抽象一层协议？",
    outputKind: "code",
    outputTask:
      "写一个 MCP Server 的 TypeScript 实现草稿。暴露至少两个 tool（如 getCurrentTime 和 echo）。" +
      "实现 JSON-RPC 风格的请求分发：收到 method='tools/list' 返回 tools 列表，" +
      "收到 method='tools/call' 根据 params.name 路由到对应 handler 并返回结果。" +
      "每个 tool 定义必须有 name、description、inputSchema。",
    outputFilename: "08-mcp-server.ts",
  },
  {
    id: "ai-safety",
    name: "AI 安全",
    coldStartInstruction:
      "刚看完「AI 安全」标题。你说的 prompt 注入——" +
      "用户输入一句话就能让 AI 忘了所有指令？那也太可怕了。",
    outputKind: "code",
    outputTask:
      "写一段输入过滤的代码。输入是一个用户消息字符串，输出是 { safe: boolean, reason: string }。" +
      "至少包含三层检查：1) 关键词黑名单（如「忽略」「忘掉」「覆盖」等注入指令模式）" +
      "2) 长度异常检查（>2000 字符标记可疑）3) 检测到注入模式时说明具体是哪个模式触发的。" +
      "函数签名：function checkInput(message: string): { safe: boolean; reason: string }。",
    outputFilename: "09-input-filter.ts",
  },
];

// ==========================================================================
// Phase 1：模块走测
// ==========================================================================

async function walkModule(def: ModuleDef): Promise<ModuleWalkResult> {
  const turns: TurnRecord[] = [];
  const history: { role: string; content: string }[] = [];
  let conceptSummary = "";

  console.log(`\n${"─".repeat(55)}`);
  console.log(`  📖 ${def.name} (${def.id})`);

  // Step 0：加载概念页
  console.log("  [0] 加载概念页…");
  const page = await loadConceptPage(def.id);
  if (page.error) {
    console.log(`      ❌ 加载失败：${page.error}`);
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary: "",
      conceptOk: false,
      turns: [],
      output: null,
      assessment: `概念页加载失败：${page.error}`,
    };
  }
  conceptSummary = page.content.slice(0, 600);
  console.log(`      ✅ 概念页已加载 (${page.content.length} 字符)`);

  // Step 1：冷启动
  console.log("  [1] 冷启动…");
  const coldContext = [
    `学习情境：你刚打开《${def.name}》这一讲，看到了标题，还没往下看。`,
    `你的基础状态：AI 编程领域的纯小白，前面学过的模块基本全忘了。`,
    `你此刻的真实想法：`,
    def.coldStartInstruction,
    ``,
    `——用你现在的水平说出第一句话。`,
  ].join("\n");

  const studentFirst = await studentSay(coldContext);
  if (!studentFirst) {
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns: [],
      output: null,
      assessment: "学生 Agent 冷启动无输出",
    };
  }
  console.log(`      🧑 学生：「${excerpt(studentFirst, 120)}」`);

  const aiFirst = await teachingSay(studentFirst, def.id);
  if (aiFirst.error) {
    turns.push({
      turn: 1,
      studentSays: studentFirst,
      aiSays: "",
      aiLength: 0,
      tokens: aiFirst.tokens ?? undefined,
      ok: false,
      error: aiFirst.error,
    });
    console.log(`      ❌ AI 无响应：${aiFirst.error}`);
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns,
      output: null,
      assessment: `第 1 轮 AI 响应失败：${aiFirst.error}`,
    };
  }
  turns.push({
    turn: 1,
    studentSays: studentFirst,
    aiSays: aiFirst.fullText,
    aiLength: aiFirst.fullText.length,
    tokens: aiFirst.tokens ?? undefined,
    ok: true,
  });
  history.push({ role: "student", content: studentFirst });
  history.push({ role: "teacher", content: aiFirst.fullText.slice(0, 800) });
  console.log(
    `      🤖 AI：${aiFirst.fullText.length} 字 ` +
      `(入${aiFirst.tokens?.input ?? "?"} 出${aiFirst.tokens?.output ?? "?"})`,
  );

  // Step 2：追问（健忘版）
  await sleep(5000);
  console.log("  [2] 追问…");
  const followContext = [
    `学习情境：AI 老师刚讲完了第一轮。你听了，但没完全懂。`,
    `注意——你是初学者，容易忘、记不清术语。`,
    ``,
    `刚才老师说的：${aiFirst.fullText.slice(0, 500)}`,
    ``,
    `你现在要做：挑一个你没完全懂的点追问。`,
    `不要用专业术语（你可能已经忘了那个词叫什么）。用你自己的大白话。`,
    `可以是「刚才说的那个什么…我没记住」，也可以是「那这跟 xxx 啥关系」。`,
  ].join("\n");

  const studentSecond = await studentSay(followContext);
  if (!studentSecond) {
    turns.push({
      turn: 2,
      studentSays: "(学生 Agent 无输出)",
      aiSays: "",
      aiLength: 0,
      ok: false,
      error: "学生 Agent 无输出",
    });
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns,
      output: null,
      assessment: "第 2 轮学生 Agent 无输出",
    };
  }
  console.log(`      🧑 学生：「${excerpt(studentSecond, 120)}」`);

  const aiSecond = await teachingSay(studentSecond, def.id);
  if (aiSecond.error) {
    turns.push({
      turn: 2,
      studentSays: studentSecond,
      aiSays: "",
      aiLength: 0,
      tokens: aiSecond.tokens ?? undefined,
      ok: false,
      error: aiSecond.error,
    });
    console.log(`      ❌ AI 无响应：${aiSecond.error}`);
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns,
      output: null,
      assessment: `第 2 轮 AI 响应失败：${aiSecond.error}`,
    };
  }
  turns.push({
    turn: 2,
    studentSays: studentSecond,
    aiSays: aiSecond.fullText,
    aiLength: aiSecond.fullText.length,
    tokens: aiSecond.tokens ?? undefined,
    ok: true,
  });
  history.push({ role: "student", content: studentSecond });
  history.push({ role: "teacher", content: aiSecond.fullText.slice(0, 800) });
  console.log(
    `      🤖 AI：${aiSecond.fullText.length} 字 ` +
      `(入${aiSecond.tokens?.input ?? "?"} 出${aiSecond.tokens?.output ?? "?"})`,
  );

  // Step 3：检验理解
  await sleep(5000);
  console.log("  [3] 检验理解…");
  const checkContext = [
    `学习情境：AI 老师已经讲了两轮。现在可能在问你一个检验问题。`,
    ``,
    `你听到的内容摘要：`,
    `第一轮：${aiFirst.fullText.slice(0, 300)}`,
    `第二轮：${aiSecond.fullText.slice(0, 300)}`,
    ``,
    `你现在要做：`,
    `1. 如果老师问了问题——用你自己的理解回答（可能对，可能错，但一定要真诚），`,
    `2. 如果没问问题——说出你现在理解到什么程度了，哪里还糊涂。`,
    ``,
    `记住你是个记性不好的初学者。用大白话。`,
  ].join("\n");

  const studentThird = await studentSay(checkContext);
  if (!studentThird) {
    turns.push({
      turn: 3,
      studentSays: "(学生 Agent 无输出)",
      aiSays: "",
      aiLength: 0,
      ok: false,
      error: "学生 Agent 无输出",
    });
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns,
      output: null,
      assessment: "第 3 轮学生 Agent 无输出",
    };
  }
  console.log(`      🧑 学生：「${excerpt(studentThird, 120)}」`);

  const aiThird = await teachingSay(studentThird, def.id);
  if (aiThird.error) {
    turns.push({
      turn: 3,
      studentSays: studentThird,
      aiSays: "",
      aiLength: 0,
      tokens: aiThird.tokens ?? undefined,
      ok: false,
      error: aiThird.error,
    });
    console.log(`      ❌ AI 无响应：${aiThird.error}`);
    return {
      moduleId: def.id,
      name: def.name,
      conceptSummary,
      conceptOk: true,
      turns,
      output: null,
      assessment: `2/3 轮成功；第 3 轮 AI 无响应。${assessModule(turns)}`,
    };
  }
  turns.push({
    turn: 3,
    studentSays: studentThird,
    aiSays: aiThird.fullText,
    aiLength: aiThird.fullText.length,
    tokens: aiThird.tokens ?? undefined,
    ok: true,
  });
  console.log(
    `      🤖 AI：${aiThird.fullText.length} 字 ` +
      `(入${aiThird.tokens?.input ?? "?"} 出${aiThird.tokens?.output ?? "?"})`,
  );

  // Step 4：动手产出
  console.log(`  [4] 动手产出（${def.outputKind}）…`);
  const produceCtx = [
    def.outputTask,
    "",
    `你已经学了《${def.name}》这一讲，听了三轮讲解。以下是老师的完整教学内容：`,
    `--- 第一轮核心讲解 ---`,
    aiFirst.fullText.slice(0, 1200),
    `--- 第二轮补充说明 ---`,
    aiSecond.fullText.slice(0, 1000),
    `--- 第三轮检验确认 ---`,
    aiThird.fullText.slice(0, 600),
    ``,
    `现在动手写吧。基于上面老师的教学内容来产出——尤其是老师给的代码示例，`,
    `可以作为你的参考模板。产出必须完整、能看出你在应用学到的知识，`,
    `不要只写一两句敷衍。`,
  ].join("\n");

  const production = await studentProduce(produceCtx, def.outputKind);
  const saved = saveOutput(
    def.outputKind === "prompt" ? "prompts" : "code",
    def.outputFilename,
    production.text,
  );
  console.log(
    `      ${production.text ? "✅" : "❌"} 产出 ${production.text.length} 字`,
  );

  // Step 5：老师审查 → 学生修正
  if (production.text.length > 0) {
    await sleep(5000);
    console.log("  [5] 老师审查产出…");
    const reviewPrompt = [
      `学生刚学完《${def.name}》这一讲。下面是他/她的产出：`,
      "",
      "```",
      production.text.slice(0, 2000),
      "```",
      "",
      `请审查这个产出。指出 2-3 个具体问题（不要笼统说「写得好」或「不够好」），`,
      `每个问题用一句话：哪里不对 + 怎么改。`,
      def.outputKind === "code"
        ? "重点关注：代码能不能跑、逻辑对不对、有没有明显的 bug、函数签名是否正确。"
        : "重点关注：结构是否完整、是否覆盖了关键要素、是否有遗漏的重要规则。",
    ].join("\n");

    const reviewResponse = await teachingSay(reviewPrompt, def.id, "explain");
    if (reviewResponse.fullText) {
      console.log(`      🔍 老师反馈：${reviewResponse.fullText.length} 字`);

      await sleep(3000);
      console.log("  [6] 学生根据反馈修正…");
      const reviseContext = [
        `老师看了你的《${def.name}》产出，给了以下反馈：`,
        "",
        reviewResponse.fullText.slice(0, 800),
        "",
        `请根据反馈修改你的产出。直接输出修改后的完整版本，不要解释。`,
        `特别注意老师指出的具体问题，逐条修正。`,
      ].join("\n");

      const revised = await studentProduce(reviseContext, def.outputKind);
      if (revised.text) {
        const revisedFilename = def.outputFilename.replace(
          /\.(\w+)$/,
          "-v2.$1",
        );
        saveOutput(
          def.outputKind === "prompt" ? "prompts" : "code",
          revisedFilename,
          revised.text,
        );
        console.log(`      ✏️ 修正版：${revised.text.length} 字`);
        production.text = revised.text;
      }
    } else if (reviewResponse.error) {
      console.log(`      ⚠️ 审查失败：${reviewResponse.error}，跳过修正`);
    }
  }

  const allOk = turns.every((t) => t.ok);
  return {
    moduleId: def.id,
    name: def.name,
    conceptSummary,
    conceptOk: true,
    turns,
    output: { kind: def.outputKind, text: production.text, savedPath: saved },
    assessment: allOk
      ? `✅ 3/3 轮走通，产出 ${production.text.length} 字 ${def.outputKind}`
      : assessModule(turns),
  };
}

function assessModule(turns: TurnRecord[]): string {
  const okCount = turns.filter((t) => t.ok).length;
  if (okCount === 0) return "全部轮次失败，模块无法完成。";

  const avgLen = Math.round(
    turns.filter((t) => t.ok).reduce((sum, t) => sum + t.aiLength, 0) / okCount,
  );

  const thinkingOverflows = turns.filter(
    (t) => t.aiLength < 10 && t.tokens && t.tokens.output > 7000,
  );

  const issues: string[] = [];
  if (avgLen < 60) issues.push("AI 回复偏短（<60 字/轮）");
  if (avgLen > 2500) issues.push("AI 回复偏长（>2500 字/轮）");
  if (avgLen > 3500) issues.push("AI 回复超长（>3500 字/轮，可能模型跑飞）");
  if (thinkingOverflows.length > 0) {
    issues.push(
      `${thinkingOverflows.length} 轮思考溢出（可见输出 <10 字但消耗 >7000 token）`,
    );
  }
  if (okCount < turns.length) issues.push(`${turns.length - okCount} 轮失败`);

  if (issues.length === 0)
    return `全部 ${okCount} 轮走通，平均回复 ${avgLen} 字。`;
  return `已走通 ${okCount}/${turns.length} 轮，平均 ${avgLen} 字。问题：${issues.join("；")}。`;
}

// ==========================================================================
// Phase 2：教学平台复刻
// ==========================================================================

interface ReplicaStep {
  label: string;
  moduleHint: string;
  /** Phase 1 产出文件（相对 walkthrough-output/）——学生必须基于这些文件搭建 */
  sourceFiles: string[];
  /**
   * 跨文件约束：本步骤产出必须 import/引用前面步骤的哪些导出。
   * key 是前面步骤的索引（0-based），value 是必须出现的 import 片段。
   * 例如 { 1: "from '../lib/llm'" } 表示必须从 step 1 的 llm.ts 导入。
   */
  importsFrom?: Record<number, string>;
  /** 给学生的具体任务描述（可用 {N} 引用 sourceFiles[N] 的内容） */
  context: string;
  expectedFile: string;
  kind: "code" | "prompt" | "config";
}

const REPLICA_STEPS: ReplicaStep[] = [
  {
    label: "项目初始化",
    moduleHint: "这是从头搭建，不涉及具体模块。",
    sourceFiles: [],
    context:
      "你要从零搭一个教学平台。技术栈必须用 Next.js（因为后续步骤需要 API Routes）。\n" +
      "第一步：运行 npx create-next-app@latest ai-teaching-platform 创建项目。\n" +
      "写出你执行过的命令和项目结构。必须明确说明「本平台使用 Next.js + React + TypeScript」。",
    expectedFile: "00-init.md",
    kind: "prompt",
  },
  {
    label: "LLM 调用封装",
    moduleHint: "基于 llm-api 模块的 Phase 1 产出。",
    sourceFiles: ["code/01-hello-llm.ts"],
    context:
      "下面是你在 Phase 1 学习 llm-api 时写的 LLM 调用代码（见下方文件内容）。\n" +
      "任务：把这个代码封装成一个可复用的模块 src/lib/llm.ts。\n" +
      "要求：1) 保持 Phase 1 代码里的 API endpoint 和请求结构，不准改核心逻辑\n" +
      "2) 把它包成 export async function chat(messages: ChatMessage[]): Promise<string> 的形式\n" +
      "   （ChatMessage = { role: 'system'|'user'|'assistant'; content: string }）\n" +
      "3) API Key 改用环境变量 process.env.OPENAI_API_KEY 读取\n" +
      "4) 返回 AI 的文本内容（response.choices[0].message.content）\n" +
      "注意：下一步会 import { chat } from '@/lib/llm' 来调用你这里封装的函数。",
    expectedFile: "src/lib/llm.ts",
    kind: "code",
  },
  {
    label: "教学 System Prompt",
    moduleHint: "基于 system-prompt 模块的 Phase 1 产出。",
    sourceFiles: ["prompts/02-teaching-prompt.md"],
    importsFrom: {},
    context:
      "下面是你在 Phase 1 学习 system-prompt 时写的教学 System Prompt（见下方文件内容）。\n" +
      "任务：基于这份 Phase 1 产出的 Prompt，适配成教学平台用的版本。\n" +
      "要求：1) 保持 Phase 1 Prompt 的核心规则（耐心、简单语言、打比方、鼓励），不准删核心规则\n" +
      "2) 新增一条规则：学生每学完一个模块，引导他动手写代码\n" +
      "3) 新增一条规则：用「门禁确认→为什么需要→核心概念→防踩坑→概念测验」的五段式讲解\n" +
      "4) 保存为 src/lib/prompt.ts，export const TEACHING_SYSTEM_PROMPT = `...`\n" +
      "注意：下一步的 route.ts 会 import { TEACHING_SYSTEM_PROMPT } from '@/lib/prompt' 来使用。",
    expectedFile: "src/lib/prompt.ts",
    kind: "prompt",
  },
  {
    label: "SSE 流式接口",
    moduleHint: "基于 llm-api + agent-loop 模块的 Phase 1 产出。",
    sourceFiles: ["code/01-hello-llm.ts", "code/03-agent-loop.ts"],
    importsFrom: {
      1: "from '@/lib/llm'",
      2: "from '@/lib/prompt'",
    },
    context:
      "下面是你在 Phase 1 写的两份代码（见下方文件内容）：\n" +
      "文件1 = llm-api 的调用代码（HTTP 请求 + 解析响应）\n" +
      "文件2 = agent-loop 的循环代码（while 循环 + 调 LLM + 喂回结果）\n\n" +
      "任务：写 src/app/api/chat/route.ts，一个 SSE 流式聊天接口。\n\n" +
      "你必须 import 前面步骤的成果——不准重新实现：\n" +
      "  import { chat } from '@/lib/llm';       // ← 步骤 1 封装的函数\n" +
      "  import { TEACHING_SYSTEM_PROMPT } from '@/lib/prompt';  // ← 步骤 2 写的 Prompt\n\n" +
      "具体实现：\n" +
      "1) POST 接收 { content } → 构造 messages 数组（system 用 TEACHING_SYSTEM_PROMPT，user 用 content）\n" +
      "2) 调用 chat(messages) 获取完整回复\n" +
      "3) 用 ReadableStream 把回复逐字以 SSE 格式返回：data: { content: '逐字' }\\n\\n\n" +
      "4) 参考文件2的「调完→拿到结果→下一步」流程来构造 messages 数组\n" +
      "5) 不准自己发明新的 HTTP 请求——用步骤 1 封装好的 chat 函数",
    expectedFile: "src/app/api/chat/route.ts",
    kind: "code",
  },
  {
    label: "前端聊天组件",
    moduleHint: "纯前端，不需要 AI 知识。",
    sourceFiles: [],
    context:
      "写 src/components/chat/ChatPanel.tsx。一个 React 聊天界面。\n\n" +
      "要求：\n" +
      "1) 输入框 + 发送按钮 + 消息列表（区分 user/AI 消息），用 useState\n" +
      "2) 点发送时 fetch('/api/chat', { method: 'POST', body: JSON.stringify({ content }) })\n" +
      "3) AI 回复用 ReadableStream 逐字读取并显示（打字机效果），不是一次性显示\n" +
      "4) 用 React + TypeScript，Enter 键发送，消息列表自动滚到底\n\n" +
      "关键：要真连 SSE——用 fetch + ReadableStream 解析 'data: ...' 行。不准用 setInterval 模拟。",
    expectedFile: "src/components/chat/ChatPanel.tsx",
    kind: "code",
  },
  {
    label: "页面路由 + 模块列表",
    moduleHint: "必须使用 Phase 1 学过的真实模块名。",
    sourceFiles: [],
    context:
      "写 src/app/page.tsx（首页）。\n" +
      "要求：1) 标题「AI 教学平台」\n" +
      "2) 列出 11 个模块作为导航——但模块名不准自己编！必须用下面这 11 个真实模块名：\n" +
      "   Python 基础速通、TypeScript 基础速通、LLM API 基础、System Prompt 设计、\n" +
      "   Agent Loop、工具调用、检索增强生成、LLM Wiki、多 Agent 协作、MCP 协议、AI 安全\n" +
      "3) 每个模块是 Next.js <Link href={`/modules/${module.id}`}> 指向对应页面\n" +
      "   moduleId 用英文：python-basics, ts-basics, llm-api, system-prompt, agent-loop, tool-calling, rag, llm-wiki, multi-agent, mcp, ai-safety",
    expectedFile: "src/app/page.tsx",
    kind: "code",
  },
  {
    label: "学习心得",
    moduleHint: "反思整个学习过程。",
    sourceFiles: [],
    context:
      "你刚刚从零搭了一个教学平台。现在写一段学习心得，回顾你学会了什么、" +
      "哪些地方特别难、哪些地方觉得「原来这么简单」。真诚地写，不用太正式。",
    expectedFile: "LEARNING.md",
    kind: "prompt",
  },
];

async function walkReplica(
  phase1Results: ModuleWalkResult[],
): Promise<PlatformReplicaResult> {
  console.log(`\n\n${"=".repeat(55)}`);
  console.log(`  🏗️  Phase 2：教学平台复刻（回放式——基于 Phase 1 产出文件）`);
  console.log(`${"=".repeat(55)}`);

  // 构建 Phase 1 产出文件索引：filename → content
  const phase1Files: Map<string, string> = new Map();
  for (const r of phase1Results) {
    if (r.output?.savedPath) {
      try {
        const content = readFileSync(r.output.savedPath, "utf-8");
        // 用相对路径做 key：code/01-hello-llm.ts 或 prompts/02-teaching-prompt.md
        const relPath = relative(OUT_DIR, r.output.savedPath).replace(
          /\\/g,
          "/",
        );
        phase1Files.set(relPath, content);
        // 也登记修正版（若有）
        const v2Path = relPath.replace(/\.(\w+)$/, "-v2.$1");
        const absV2 = join(OUT_DIR, v2Path);
        if (existsSync(absV2)) {
          phase1Files.set(v2Path, readFileSync(absV2, "utf-8"));
        }
      } catch (err) {
        console.log(`  ⚠️ 读取 Phase 1 产出失败：${r.output.savedPath}`);
        console.log(
          `     错误：${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  const savedFiles: string[] = [];
  const allHistory: string[] = [];

  for (let i = 0; i < REPLICA_STEPS.length; i++) {
    const step = REPLICA_STEPS[i];
    console.log(`\n  [${i + 1}/${REPLICA_STEPS.length}] ${step.label}`);
    console.log(`  💡 关联模块：${step.moduleHint}`);

    // 读取 Phase 1 依赖文件的内容
    const sourceContents: string[] = [];
    for (const sf of step.sourceFiles) {
      const content = phase1Files.get(sf);
      if (content) {
        sourceContents.push(content);
        console.log(`  📄 读取 Phase 1 文件：${sf} (${content.length} 字)`);
      } else {
        console.log(`  ⚠️ Phase 1 文件缺失：${sf}，将跳过`);
      }
    }

    const taskContext = [
      `你正在搭建一个完整的 AI 教学平台。这是第 ${i + 1} 步：${step.label}。`,
      ``,
      step.sourceFiles.length > 0
        ? [
            `⚠️ 关键约束：这一步骤不准从零写核心逻辑。`,
            `你必须基于下面 Phase 1 的产出文件来适配和整合——`,
            `复用文件里的代码结构、接口定义和关键实现，只做封装和串联。`,
          ].join(" ")
        : ``,
      ``,
      ...(step.sourceFiles.length > 0
        ? [
            `===== Phase 1 产出文件（你的学习成果，不准重写核心逻辑）=====`,
            ...sourceContents.map(
              (c, idx) =>
                `--- 文件${idx + 1}：${step.sourceFiles[idx]} ---\n\`\`\`\n${c.slice(0, 2000)}\n\`\`\``,
            ),
            `==========================================================`,
          ]
        : []),
      ``,
      `当前任务：`,
      step.context,
      ``,
      `产出规则：`,
      `- 只输出代码/配置/文档本身，不要解释`,
      `- ${step.sourceFiles.length > 0 ? "必须基于上面 Phase 1 文件的结构和逻辑，禁止自己发明" : "产出必须完整"}`,
      `- 代码要能跑：import 写全、变量命名清晰`,
    ]
      .filter((s) => s !== "")
      .join("\n");

    const production = await studentProduce(taskContext, step.kind);
    const saved = saveOutput("code", step.expectedFile, production.text);

    // 也保存到 replica 子目录
    if (saved) {
      const replicaPath = join(OUT_DIR, "replica", step.expectedFile);
      try {
        mkdirSync(dirname(replicaPath), { recursive: true });
        writeFileSync(replicaPath, production.text, "utf-8");
        savedFiles.push(step.expectedFile);
      } catch {
        savedFiles.push(step.expectedFile);
      }
    }

    console.log(
      `      ${production.text ? "✅" : "❌"} ` +
        `${step.expectedFile} (${production.text.length} 字)`,
    );

    // 跨文件引用验证：扫描产出文件中是否包含预期的 import
    if (step.importsFrom && production.text) {
      console.log(`  🔗 跨文件引用检查：`);
      const missing: string[] = [];
      for (const [stepIdxStr, expectedImport] of Object.entries(
        step.importsFrom,
      )) {
        const stepIdx = Number(stepIdxStr);
        const prevStep = REPLICA_STEPS[stepIdx];
        if (production.text.includes(expectedImport)) {
          console.log(
            `     ✅ 引用了步骤 ${stepIdx + 1}（${prevStep.label}）：` +
              `${expectedImport}`,
          );
        } else {
          console.log(
            `     ❌ 缺少对步骤 ${stepIdx + 1}（${prevStep.label}）的引用：` +
              `期望出现 "${expectedImport}"`,
          );
          missing.push(expectedImport);
        }
      }

      // 如果有缺失的引用，追加修正提示
      if (missing.length > 0) {
        console.log(`  🔧 追加修正提示…`);
        const fixPrompt = [
          `你刚才写了一个文件（${step.expectedFile}），但漏掉了关键的 import：`,
          ...missing.map((m, idx) => `  ${idx + 1}. 必须包含 "${m}"`),
          ``,
          `请重新输出完整的 ${step.expectedFile}，这次确保包含上面所有的 import。`,
          `不要解释，直接输出完整文件。`,
        ].join("\n");

        const fixed = await studentProduce(fixPrompt, step.kind);
        if (fixed.text) {
          const fixedSaved = saveOutput("code", step.expectedFile, fixed.text);
          if (fixedSaved) {
            const replicaPath = join(OUT_DIR, "replica", step.expectedFile);
            try {
              mkdirSync(dirname(replicaPath), { recursive: true });
              writeFileSync(replicaPath, fixed.text, "utf-8");
            } catch {
              /* ignore */
            }
            console.log(`     📝 修正后：${fixed.text.length} 字`);
            production.text = fixed.text;
          }
        } else {
          console.log(`     ⚠️ 修正产出为空，保留原始版本`);
        }
      }
    }

    allHistory.push(`[${step.label}]\n${production.text.slice(0, 500)}`);

    // 步骤间延时
    await sleep(5000);
  }

  // 学习心得单独产出
  const reflectionText =
    allHistory
      .find((h) => h.startsWith("[学习心得]"))
      ?.split("\n")
      .slice(1)
      .join("\n") ?? "";
  try {
    mkdirSync(join(OUT_DIR, "reflections"), { recursive: true });
  } catch {
    /* already exists */
  }
  writeFileSync(
    join(OUT_DIR, "reflections", "FINAL-LEARNING.md"),
    reflectionText,
    "utf-8",
  );

  return {
    files: savedFiles,
    reflection: reflectionText,
    assessment:
      savedFiles.length === REPLICA_STEPS.length
        ? `✅ 全部 ${REPLICA_STEPS.length} 步完成`
        : `⚠️ ${savedFiles.length}/${REPLICA_STEPS.length} 步完成`,
    ok: savedFiles.length >= REPLICA_STEPS.length - 1,
  };
}

// ==========================================================================
// 汇总报表
// ==========================================================================

function printWalkReport(
  phase1: ModuleWalkResult[],
  quiz: QuizResult,
  phase2: PlatformReplicaResult,
): void {
  console.log(`\n\n${"=".repeat(70)}`);
  console.log(`  📊 走测汇总报告 v2`);
  console.log(`${"=".repeat(70)}`);

  // Phase 1 模块概况
  console.log(`\n  📖 Phase 1：11 模块学习`);
  console.log(`  模块                        轮次    产出              评估`);
  console.log(`  ${"─".repeat(66)}`);

  let totalTurns = 0;
  let totalOkTurns = 0;
  let totalOutputChars = 0;

  for (const r of phase1) {
    const turnSummary = r.turns.map((t) => (t.ok ? "✓" : "✗")).join("/");
    const outputLabel = r.output
      ? `${r.output.kind} ${r.output.text.length}字`
      : "无";
    console.log(
      `  ${r.name.padEnd(20)} ${turnSummary.padEnd(8)} ${outputLabel.padEnd(16)} ${r.assessment.slice(0, 45)}`,
    );

    totalTurns += r.turns.length;
    totalOkTurns += r.turns.filter((t) => t.ok).length;
    if (r.output) totalOutputChars += r.output.text.length;
  }

  console.log(`  ${"─".repeat(66)}`);
  console.log(
    `  总计：${phase1.length} 模块 | ${totalOkTurns}/${totalTurns} 轮走通 | ` +
      `产出 ${totalOutputChars} 字`,
  );

  // 断点
  const brokenModules = phase1.filter(
    (r) => r.turns.some((t) => !t.ok) || !r.conceptOk,
  );
  if (brokenModules.length > 0) {
    console.log(`\n  ⚠️  Phase 1 断点模块：`);
    for (const m of brokenModules) {
      console.log(`     ${m.name}: ${m.assessment}`);
    }
  }

  // 知识验收
  console.log(`\n  🧠 知识验收（Phase 1 → Phase 2 过渡）`);
  console.log(`  ${"─".repeat(66)}`);
  console.log(`  自由回忆覆盖模块：${quiz.recallCount}/9`);
  console.log(
    `  「${quiz.recallText.slice(0, 150)}${quiz.recallText.length > 150 ? "…" : ""}」`,
  );
  console.log(`  选择题：${quiz.mcScore}/5`);
  for (const d of quiz.mcDetails) {
    console.log(`     ${d.correct ? "✅" : "❌"} ${d.question}`);
  }
  console.log(
    `  综合评级：${quiz.grade === "pass" ? "✅ 合格" : quiz.grade === "weak" ? "⚠️ 薄弱" : "❌ 需要重学"}`,
  );

  // Phase 2 概况
  console.log(`\n  🏗️  Phase 2：教学平台复刻`);
  console.log(`  ${"─".repeat(66)}`);
  console.log(`  ${phase2.assessment}`);
  console.log(`  产出文件 (walkthrough-output/replica/)：`);
  for (const f of phase2.files) {
    console.log(`     📄 ${f}`);
  }

  // 学习心得片段
  if (phase2.reflection) {
    console.log(`\n  📝 学习心得片段：`);
    console.log(`     ${excerpt(phase2.reflection, 200)}`);
  }

  // 学习体验抽样
  console.log(`\n  💬 学生追问抽样：`);
  for (const r of phase1) {
    const t2 = r.turns.find((t) => t.turn === 2);
    if (t2 && t2.ok) {
      console.log(`     [${r.name}] ${excerpt(t2.studentSays, 100)}`);
    }
  }

  console.log(`\n${"=".repeat(70)}\n`);
  console.log(`  📁 全部产出文件：walkthrough-output/`);
  console.log(`     prompts/    — 提示词草稿`);
  console.log(`     code/       — 代码文件`);
  console.log(`     reflections/ — 学习心得`);
  console.log(`     replica/    — 完整平台项目`);
  console.log(`${"=".repeat(70)}\n`);
}

// ==========================================================================
// 主入口
// ==========================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const targetPhase = args.includes("--phase=2") ? 2 : 1;

  // 验证 dev server
  try {
    const resp = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "ping",
        moduleId: "llm-api",
        step: "explain",
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      const body = await resp.text();
      console.error(
        `❌ dev server 返回非 2xx：HTTP ${resp.status}\n${body.slice(0, 300)}`,
      );
      process.exit(1);
    }
  } catch (err) {
    console.error(
      `❌ 无法连接到 ${BASE}。请确保 dev server 在运行。\n` +
        `   错误：${err instanceof Error ? err.message : String(err)}`,
    );
    process.exit(1);
  }

  console.log("✅ dev server 连通");
  if (targetPhase === 2) {
    console.log(
      "🧑 学生 Agent（降智版）Phase 2 模式：加载记忆 + 知识验收 + 平台复刻\n",
    );
  } else {
    console.log("🧑 学生 Agent（降智版）开始走测…\n");
  }

  // ================================================================
  // Phase 1
  // ================================================================
  let results: ModuleWalkResult[];

  if (targetPhase === 2) {
    results = loadCheckpoint();
    console.log(`📂 加载 Phase 1 记忆：${results.length}/11 模块已学\n`);
  } else {
    results = [];
    for (const def of MODULES) {
      const result = await walkModule(def);
      results.push(result);

      // 每模块完成后增量保存 checkpoint
      saveCheckpoint(results);

      const hasErrors = result.turns.some((t) => !t.ok) || !result.conceptOk;
      const delay = hasErrors ? 30_000 : 15_000;
      console.log(
        `  ⏳ 模块间等候 ${delay / 1000}s（${hasErrors ? "出错回压" : "正常冷却"}）…`,
      );
      await sleep(delay);
    }
  }

  // ================================================================
  // 知识验收（Phase 1 → Phase 2 过渡）
  // ================================================================
  const quiz = await adminQuiz(results);

  // ================================================================
  // Phase 2
  // ================================================================
  const quizLabel =
    quiz.grade === "fail"
      ? "⚠️ 验收不通过"
      : quiz.grade === "weak"
        ? "💡 验收较弱"
        : "✅ 验收通过";

  console.log(
    `\n\n  📋 知识验收：${quizLabel}（回忆 ${quiz.recallCount}/11 模块，选择 ${quiz.mcScore}/5）`,
  );
  console.log(`  ⏳ 进入 Phase 2 前冷却 10s…`);
  await sleep(10_000);
  const replica = await walkReplica(results);

  printWalkReport(results, quiz, replica);
}

main().catch((err) => {
  console.error("运行失败：", err);
  process.exit(1);
});
