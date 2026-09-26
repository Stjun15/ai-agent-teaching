/**
 * 教学效果评测 —— 全模块全流程端到端观测
 *
 * 范围
 * ----
 * 覆盖全部 9 个 AI Agent 教学模块 + platform-replica 收束模块，每条
 * 对 /api/chat 发送真实 SSE 对话，观察 AI 回复是否符合教学规格。
 *
 * 9 个模块（按学习顺序）
 * --------------------
 * 1. llm-api        → LLM API 基础（怎么调大模型）
 * 2. system-prompt   → System Prompt 设计（怎么给 AI 定人设）
 * 3. agent-loop      → Agent Loop（AI 怎么自己决定下一步）
 * 4. tool-calling    → 工具调用（怎么给 AI 配备工具）
 * 5. rag             → 检索增强生成（怎么给 AI 加知识库）
 * 6. llm-wiki        → LLM Wiki（知识库的结构与维护）
 * 7. multi-agent     → 多 Agent 协作（怎么分工、怎么通信）
 * 8. mcp             → MCP 协议（怎么接外部工具服务器）
 * 9. ai-safety       → AI 安全（防护、兜底、伦理）
 *
 * 性质
 * ----
 * 这不是 pass/fail 测试，而是观测清单。每条 criterion 记录 ✓/✗/⚠
 * 并附带 LLM 输出的原文摘录（evidence），最终报表由人工判读。
 *
 * LLM 输出有天然方差（同一 Prompt 跑两次措辞不同），把一次运行的偶然值
 * 钉成 pass/fail，下次模型微调就会红。观测清单要守的是教学性质，
 * 不是措辞快照。
 *
 * 前置条件
 * -------
 * 1. dev server 在 http://localhost:3000 运行中
 * 2. LLM 密钥已配置（见 .env.local）
 *
 * 运行
 * ----
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/teaching-effectiveness-spec.ts
 *
 * 耗时约 3-5 分钟（11 条 flow × 2 轮对话，每轮 5-10 秒）。
 */

import type { SSEEventInput } from "@/schemas";

// ==========================================================================
// 工具：SSE 对话客户端 + 概念页读取
// ==========================================================================

const BASE = "http://localhost:3000";

interface ChatResult {
  fullText: string;
  thinking: string[];
  tokens: { input: number; output: number } | null;
  error: string | null;
}

async function chat(
  content: string,
  moduleId: string,
  step = "explain",
): Promise<ChatResult> {
  const response = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, moduleId, step }),
  });

  if (!response.ok) {
    const body = await response.text();
    return {
      fullText: "",
      thinking: [],
      tokens: null,
      error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
    };
  }

  if (!response.body) {
    return { fullText: "", thinking: [], tokens: null, error: "响应体为空" };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let tokens: { input: number; output: number } | null = null;
  const thinking: string[] = [];
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
          if (event.type === "thinking") {
            thinking.push(event.data.content);
          }
          if (event.type === "token") {
            contents.push(event.data.content);
          }
        } catch {
          /* 损坏的帧跳过 */
        }
      }
    }
  }

  return { fullText: contents.join(""), thinking, tokens, error: null };
}

/** GET /api/module-content?moduleId=xxx 读取概念页正文 */
async function loadConceptPage(
  moduleId: string,
): Promise<{ content: string; error: string | null }> {
  const resp = await fetch(`${BASE}/api/module-content?moduleId=${moduleId}`);
  if (!resp.ok) {
    return { content: "", error: `HTTP ${resp.status}` };
  }
  return { content: await resp.text(), error: null };
}

function excerpt(text: string, length = 180): string {
  return text.replace(/\n/g, " ").slice(0, length).trim();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ==========================================================================
// 观测记录
// ==========================================================================

interface Observation {
  criterion: string;
  verdict: "✓" | "✗" | "⚠";
  evidence: string;
}

function ok(
  criterion: string,
  condition: boolean,
  evidence: string,
): Observation {
  return {
    criterion,
    verdict: condition ? "✓" : "✗",
    evidence: evidence.slice(0, 250),
  };
}

function soft(
  criterion: string,
  condition: boolean,
  evidence: string,
): Observation {
  return {
    criterion,
    verdict: condition ? "✓" : "⚠",
    evidence: evidence.slice(0, 250),
  };
}

let totalObs = 0;
let totalOk = 0;

function printReport(title: string, observations: Observation[]): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
  for (const o of observations) {
    const icon = o.verdict === "✓" ? "✅" : o.verdict === "✗" ? "❌" : "⚠️";
    console.log(`  ${icon}  ${o.criterion}`);
    if (o.verdict !== "✓") {
      console.log(`      证据：${o.evidence}`);
    }
  }
  const score = observations.filter((o) => o.verdict === "✓").length;
  console.log(`  → ${score}/${observations.length} ✓`);
  totalObs += observations.length;
  totalOk += score;
}

function printFinalScore(): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  总计：${totalOk}/${totalObs} ✓`);
  console.log(`${"=".repeat(60)}`);
}

// ==========================================================================
// 教学通用观测维度（每条 flow 共用）
// ==========================================================================

/** 核心概念关键词表：每模块有自己的关键词，AI 必须命中至少 1 个 */
const KEYWORD_MAP: Record<string, string[]> = {
  "llm-api": ["API", "大模型", "LLM", "模型", "请求", "响应", "调用"],
  "system-prompt": [
    "System Prompt",
    "系统提示",
    "角色",
    "人设",
    "指令",
    "消息",
  ],
  "agent-loop": ["Agent Loop", "循环", "多步", "下一步", "推理", "工具"],
  "tool-calling": ["工具", "Tool", "定义", "调用", "函数", "参数", "function"],
  rag: ["RAG", "检索", "知识库", "向量", "embedding", "文档"],
  "llm-wiki": ["Wiki", "知识库", "概念页", "教材", "读写", "页面"],
  "multi-agent": ["多 Agent", "协作", "分工", "通信", "编排", "orchestration"],
  mcp: ["MCP", "协议", "服务端", "工具服务器", "连接", "标准"],
  "ai-safety": ["安全", "防护", "攻击", "兜底", "伦理", "注入", "越狱"],
};

/** 判断 AI 回复是否命中模块关键词 */
function hitKeywords(moduleId: string, text: string): boolean {
  const keys = KEYWORD_MAP[moduleId] ?? [];
  return keys.some((k) => text.toLowerCase().includes(k.toLowerCase()));
}

/** 通用观测：概念页可加载 */
async function checkConceptPage(
  moduleId: string,
  obs: Observation[],
): Promise<void> {
  const page = await loadConceptPage(moduleId);
  obs.push(
    ok(
      `概念页 ${moduleId}.md 可加载`,
      page.error === null && page.content.length > 50,
      page.error ?? `长度=${page.content.length}`,
    ),
  );
}

/** 通用观测：AI 命中本模块关键词 */
function checkKeywords(
  moduleId: string,
  response: ChatResult,
  label: string,
  obs: Observation[],
): void {
  obs.push(
    ok(
      `${label}：命中 ${moduleId} 核心关键词`,
      hitKeywords(moduleId, response.fullText),
      excerpt(response.fullText),
    ),
  );
}

/** 通用观测：AI 不跑题到无关模块 */
function checkNoDrift(
  _moduleId: string,
  response: ChatResult,
  unrelatedModules: string[],
  label: string,
  obs: Observation[],
): void {
  for (const other of unrelatedModules) {
    const keys = KEYWORD_MAP[other] ?? [];
    const drifted = keys.some(
      (k) =>
        k.length >= 3 &&
        response.fullText.toLowerCase().includes(k.toLowerCase()),
    );
    if (drifted) {
      obs.push(
        soft(`${label}：不跑题到 ${other}`, false, excerpt(response.fullText)),
      );
      return;
    }
  }
  obs.push(ok(`${label}：不跑题到无关模块`, true, excerpt(response.fullText)));
}

// ==========================================================================
// Flow 1-9：逐模块教学观测
// ==========================================================================

interface ModuleFlowDef {
  moduleId: string;
  label: string;
  /** 学生冷启动时的第一句话（模拟看完概念页后的自然提问） */
  coldStartMessage: string;
  /** 学生追问 */
  followUpMessage: string;
  /** 不应出现的无关模块 */
  unrelated: string[];
  /** 额外观测 */
  extra?: (r1: ChatResult, r2: ChatResult) => Observation[];
}

const MODULE_FLOWS: ModuleFlowDef[] = [
  {
    moduleId: "llm-api",
    label: "模块 1：LLM API 基础",
    coldStartMessage:
      "我已阅读完 LLM API 基础的概念内容，之前只听说过 ChatGPT 但没调过 API，" +
      "你可以开始讲解了吗？",
    followUpMessage: "system 和 user 消息有什么区别？什么时候用哪个？",
    unrelated: ["multi-agent", "mcp", "ai-safety"],
    extra: (r1, r2) => [
      soft(
        "讲解中包含类比（零基础学生需求）",
        /就像|比如|好比|想象|假如/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
      ok(
        "能区分 system/user/assistant 三种角色",
        r2.fullText.toLowerCase().includes("assistant") ||
          r2.fullText.toLowerCase().includes("助理"),
        excerpt(r2.fullText),
      ),
    ],
  },
  {
    moduleId: "system-prompt",
    label: "模块 2：System Prompt 设计",
    coldStartMessage:
      "我已阅读完 System Prompt 设计的概念内容，不太明白为什么不能直接把要求写到 user 消息里，" +
      "你可以开始讲解了吗？",
    followUpMessage:
      "写 System Prompt 有什么常见的坑？规则写太多会不会让 AI 混乱？",
    unrelated: ["llm-wiki", "mcp", "ai-safety"],
    extra: (r1) => [
      soft(
        "解释了 system 和 user 的职责差异（不是只提名字）",
        r1.fullText.length > 100 &&
          /角色|职责|定位|规则|人设|行为/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "agent-loop",
    label: "模块 3：Agent Loop",
    coldStartMessage:
      "我已阅读完 Agent Loop 的概念内容，AI 是怎么知道自己下一步该做什么的？" +
      "你可以开始讲解了吗？",
    followUpMessage:
      "Agent Loop 和普通的一次问答有什么区别？多轮循环一定会更好吗？",
    unrelated: ["rag", "llm-wiki", "mcp"],
    extra: (r1) => [
      soft(
        "前置模块 system-prompt 被引用（知识累积）",
        /system.?prompt|系统提示|指令|角色/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
      ok(
        "能解释 Loop 的循环决策机制",
        /思考|决定|选择|判断|工具|action|thought/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "tool-calling",
    label: "模块 4：工具调用",
    coldStartMessage:
      "我已阅读完工具调用的概念内容，工具定义的三要素是指什么？" +
      "你可以开始讲解了吗？",
    followUpMessage:
      "如果工具定义写得不完整（比如缺了 required），会发生什么？",
    unrelated: ["rag", "llm-wiki", "multi-agent"],
    extra: (r1, r2) => [
      ok(
        "提到了工具三要素（name / description / parameters）",
        /名称|name|描述|description|参数|param/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
      ok(
        "能指出缺 required 的后果",
        /required|必填|错误|幻觉|调用失败|缺少参数/.test(r2.fullText),
        excerpt(r2.fullText),
      ),
    ],
  },
  {
    moduleId: "rag",
    label: "模块 5：检索增强生成",
    coldStartMessage:
      "我已阅读完 RAG 的概念内容，RAG 和直接把文档放进 Prompt 有什么区别？" +
      "你可以开始讲解了吗？",
    followUpMessage:
      "嵌入（embedding）是怎么把文字变成数字的？为什么要这样做？",
    unrelated: ["tool-calling", "mcp", "multi-agent"],
    extra: (r1) => [
      soft(
        "解释了 RAG ≠ 拼接 Prompt（核心误解澄清）",
        /检索|retriev|向量|embed|分段|chunk|窗口|长度限制/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "llm-wiki",
    label: "模块 6：LLM Wiki",
    coldStartMessage:
      "我已阅读完 LLM Wiki 的概念内容，这和普通的 RAG 有什么不同？" +
      "你可以开始讲解了吗？",
    followUpMessage: "Wiki 的页面结构应该怎么设计？什么样的页面算好页面？",
    unrelated: ["tool-calling", "mcp", "ai-safety"],
    extra: (r1) => [
      ok(
        "能区分 Wiki（结构化读写）vs RAG（检索注入）",
        /结构|读写|层级|页面|概念|维护/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "multi-agent",
    label: "模块 7：多 Agent 协作",
    coldStartMessage:
      "我已阅读完多 Agent 协作的概念内容，什么时候应该拆分而不是一个 Agent 全搞定？" +
      "你可以开始讲解了吗？",
    followUpMessage:
      "多个 Agent 之间怎么通信？出一个 Agent 的输出怎么喂给下一个？",
    unrelated: ["llm-api", "system-prompt"],
    extra: (r1) => [
      ok(
        "能解释拆分 Agent 的决策标准",
        /分工|拆分|职责|单一|专家|负担|任务/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "mcp",
    label: "模块 8：MCP 协议",
    coldStartMessage:
      "我已阅读完 MCP 协议的概念内容，MCP 和直接写工具定义有什么区别？" +
      "你可以开始讲解了吗？",
    followUpMessage: "MCP 服务器和普通的 API 有什么区别？需要自己部署吗？",
    unrelated: ["llm-api", "system-prompt", "agent-loop"],
    extra: (r1) => [
      ok(
        "能解释标准协议 vs 自定义工具的差异",
        /标准|协议|通用|复用|共享|自定义/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
    ],
  },
  {
    moduleId: "ai-safety",
    label: "模块 9：AI 安全",
    coldStartMessage:
      "我已阅读完 AI 安全的概念内容，Prompt 注入攻击到底是怎么发生的？" +
      "你可以开始讲解了吗？",
    followUpMessage: "除了防止注入，还有哪些安全方面需要考虑？",
    unrelated: ["llm-api", "system-prompt", "tool-calling"],
    extra: (r1, r2) => [
      ok(
        "能解释 Prompt 注入的原理（不是只提名字）",
        /注入|攻击|绕过|忽略|覆盖|指令|安全|防护/.test(r1.fullText),
        excerpt(r1.fullText),
      ),
      soft(
        "提及了多维安全（不限于注入一种）",
        /数据|隐私|越狱|滥用|审查|兜底|回退/.test(r2.fullText),
        excerpt(r2.fullText),
      ),
    ],
  },
];

async function runModuleFlow(def: ModuleFlowDef): Promise<void> {
  const obs: Observation[] = [];

  // 1. 概念页可加载
  await checkConceptPage(def.moduleId, obs);

  // 2. 冷启动
  console.log(`  [1/2] 冷启动…`);
  const r1 = await chat(def.coldStartMessage, def.moduleId);
  if (r1.error) {
    obs.push(ok("冷启动成功", false, r1.error));
    printReport(def.label, obs);
    return;
  }
  console.log(
    `       长度=${r1.fullText.length} token入=${r1.tokens?.input ?? "?"} 出=${r1.tokens?.output ?? "?"}`,
  );

  obs.push(
    ok(
      "冷启动：AI 有实质输出",
      r1.fullText.length > 30,
      `长度=${r1.fullText.length}`,
    ),
  );
  checkKeywords(def.moduleId, r1, "冷启动", obs);

  // 3. 追问
  await sleep(2000);
  console.log(`  [2/2] 追问…`);
  const r2 = await chat(def.followUpMessage, def.moduleId);
  if (r2.error) {
    obs.push(ok("追问成功", false, r2.error));
  } else {
    console.log(
      `       长度=${r2.fullText.length} token入=${r2.tokens?.input ?? "?"} 出=${r2.tokens?.output ?? "?"}`,
    );
    obs.push(
      ok(
        "追问：AI 有实质输出",
        r2.fullText.length > 30,
        `长度=${r2.fullText.length}`,
      ),
    );
    checkKeywords(def.moduleId, r2, "追问", obs);
    checkNoDrift(def.moduleId, r2, def.unrelated, "追问", obs);
  }

  // 4. 额外观测
  if (def.extra) {
    obs.push(...def.extra(r1, r2));
  }

  printReport(def.label, obs);
}

// ==========================================================================
// Flow 10：跨模块知识累积
// ==========================================================================

async function runCrossModuleFlow(): Promise<void> {
  const obs: Observation[] = [];

  // 模拟学生学完 llm-api 和 system-prompt，现在学 agent-loop
  console.log(`  [1/3] agent-loop 冷启动（已学前置模块）…`);
  const r1 = await chat(
    "我已学完 LLM API 基础和 System Prompt 设计，" +
      "现在准备学 Agent Loop。你可以开始了吗？",
    "agent-loop",
  );
  if (r1.error) {
    obs.push(ok("跨模块冷启动成功", false, r1.error));
    printReport("Flow 10：跨模块知识累积", obs);
    return;
  }
  console.log(`       长度=${r1.fullText.length}`);

  obs.push(
    soft(
      "agent-loop 讲解中引用了 llm-api 的知识",
      /API|LLM|模型|调用/.test(r1.fullText),
      excerpt(r1.fullText),
    ),
  );
  obs.push(
    soft(
      "agent-loop 讲解中引用了 system-prompt 的知识",
      /prompt|提示|指令|角色|system/.test(r1.fullText),
      excerpt(r1.fullText),
    ),
  );

  // 模拟学完 llm-api → tool-calling，验证工具调用引用 API 基础
  await sleep(2000);
  console.log(`  [2/3] tool-calling 冷启动（已学 LLM API + agent-loop）…`);
  const r2 = await chat(
    "我已学完 LLM API 基础和 Agent Loop，" +
      "现在准备学工具调用。你可以开始了吗？",
    "tool-calling",
  );
  if (r2.error) {
    obs.push(ok("跨模块冷启动 2 成功", false, r2.error));
    printReport("Flow 10：跨模块知识累积", obs);
    return;
  }
  console.log(`       长度=${r2.fullText.length}`);

  obs.push(
    soft(
      "tool-calling 讲解中引用了 agent-loop 的知识",
      /loop|循环|多步|agent|步骤/.test(r2.fullText),
      excerpt(r2.fullText),
    ),
  );

  // 验证 ai-safety（最后一个模块）引用了前面的安全相关知识
  await sleep(2000);
  console.log(`  [3/3] ai-safety 冷启动（已学全部前置模块）…`);
  const r3 = await chat(
    "我已学完前面 8 个模块，现在准备学 AI 安全。" + "你可以开始了吗？",
    "ai-safety",
  );
  if (r3.error) {
    obs.push(ok("跨模块冷启动 3 成功", false, r3.error));
    printReport("Flow 10：跨模块知识累积", obs);
    return;
  }
  console.log(`       长度=${r3.fullText.length}`);

  obs.push(
    soft(
      "ai-safety 能串起前面学的安全知识（system-prompt / tool-calling 等）",
      /前面|之前|学过|前置|模块/.test(r3.fullText) ||
        /prompt|工具|tool/.test(r3.fullText),
      excerpt(r3.fullText),
    ),
  );

  printReport("Flow 10：跨模块知识累积", obs);
}

// ==========================================================================
// Flow 11：platform-replica —— 收束
// ==========================================================================

async function runPlatformReplicaFlow(): Promise<void> {
  const obs: Observation[] = [];

  // 检查概念页
  await checkConceptPage("platform-replica", obs);

  // 冷启动
  console.log(`  [1/2] 冷启动…`);
  const r1 = await chat(
    "我已了解前面 9 个模块的内容，现在准备做 platform-replica 项目。" +
      "你要我怎么开始？",
    "platform-replica",
  );
  if (r1.error) {
    obs.push(ok("platform-replica 冷启动成功", false, r1.error));
    printReport("Flow 11：platform-replica 收束", obs);
    return;
  }
  console.log(`       长度=${r1.fullText.length}`);

  obs.push(
    ok(
      "platform-replica 提示词中有实质输出",
      r1.fullText.length > 30,
      `长度=${r1.fullText.length}`,
    ),
  );
  obs.push(
    soft(
      "引用了 9 个前置模块中的至少 1 个",
      /API|LLM|prompt|agent|tool|RAG|wiki|multi|MCP|安全/.test(r1.fullText),
      excerpt(r1.fullText),
    ),
  );
  obs.push(
    soft(
      "给出了项目起步指导（不只讲概念、有行动指引）",
      /开始|第一步|创建|搭建|初始化|写|做/.test(r1.fullText),
      excerpt(r1.fullText),
    ),
  );

  // 追问
  await sleep(2000);
  console.log(`  [2/2] 追问…`);
  const r2 = await chat(
    "我该从哪个模块开始搭建？有没有推荐顺序？",
    "platform-replica",
  );
  if (r2.error) {
    obs.push(ok("platform-replica 追问成功", false, r2.error));
  } else {
    console.log(`       长度=${r2.fullText.length}`);
    obs.push(
      ok(
        "追问后给出可操作的步骤建议",
        r2.fullText.length > 50,
        excerpt(r2.fullText),
      ),
    );
    obs.push(
      soft(
        "推荐了搭建顺序（按教学模块 1→9 或按功能）",
        /顺序|先|然后|最后|步骤|第.*步|模块/.test(r2.fullText),
        excerpt(r2.fullText),
      ),
    );
  }

  printReport("Flow 11：platform-replica 收束", obs);
}

// ==========================================================================
// 主入口
// ==========================================================================

async function main(): Promise<void> {
  // 连通性检查
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

  console.log("✅ dev server 连通\n");

  // ——— 逐模块教学观测 ———
  for (const def of MODULE_FLOWS) {
    await runModuleFlow(def);
    await sleep(2000);
  }

  // ——— 跨模块知识累积 ———
  await runCrossModuleFlow();
  await sleep(2000);

  // ——— 收束 ———
  await runPlatformReplicaFlow();

  // ——— 最终汇总 ———
  printFinalScore();
}

main().catch((err) => {
  console.error("运行失败：", err);
  process.exit(1);
});
