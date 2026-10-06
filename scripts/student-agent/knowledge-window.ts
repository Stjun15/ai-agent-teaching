/**
 * 知识窗（Knowledge Window）—— 零基础学生 Agent 的核心机制
 *
 * 真实学生是逐模块学习的：学到第 N 讲时，不知道第 N+1 讲以后的内容。
 * 当前 Agent 一次性持有全部教学内容，无法产生"这个词我没见过"的真实困惑。
 *
 * 知识窗机制强制 Agent 的知识边界严格受限于已学模块：
 * - 词汇表：每个模块明确定义了它引入了哪些术语
 * - 知识窗：对模块 N，可用的术语 = 模块 0..N-1 的词汇并集
 * - 概念泄漏检测：示范代码中出现了未来模块才定义的术语 → 断层告警
 */

// ---- 类型 ----

/** 单个术语定义 */
export interface Term {
  /** 术语名称（小写） */
  name: string;
  /** 展示名称 */
  display: string;
  /** 定义摘要 */
  definition: string;
  /** 来源模块 */
  moduleId: string;
}

/** 概念泄漏 */
export interface ConceptLeak {
  /** 泄漏的术语 */
  term: string;
  /** 该术语在哪个模块被定义 */
  definedIn: string;
  /** 在代码中的出现位置（片段） */
  codeSnippet: string;
  /** 严重程度 */
  severity: "critical" | "high" | "medium";
}

/** 知识窗分析结果 */
export interface KnowledgeWindowReport {
  /** 当前模块可用的术语数 */
  knownTermCount: number;
  /** 检测到的概念泄漏 */
  leaks: ConceptLeak[];
  /** 未知术语总数 */
  unknownTermCount: number;
}

// ---- 词汇表：每个模块明确引入的术语 ----

/**
 * 每个模块的词汇表。
 * key = 术语名（小写），value = { display: 展示名, definition: 定义 }
 */
const MODULE_VOCABULARY: Record<string, Record<string, string>> = {
  "ts-basics": {
    typescript: "给数据贴标签的编程语言，浏览器能读懂",
    编程语言: "人和电脑之间的翻译官",
    变量: "存数据用的命名盒子，let 声明可改，const 声明不可改",
    字符串: "文字类型的数据，用引号包起来",
    数字: "数值类型，可以做加减乘除",
    布尔值: "true 或 false，表示是/否",
    const: "声明一个不能改的变量",
    let: "声明一个可以改的变量",
    类型: "变量的标签，说明里面装的是什么",
    函数: "一段可以重复使用代码块，function 关键字声明",
    参数: "函数收到的输入值",
    返回值: "函数算完吐出来的东西",
    async: "标记函数里会有等待操作（await）",
    await: "停下来等一个异步操作做完",
    promise: "一个未来会完成的操作的占位符",
    trycatch: "试一段代码，失败了就抓住错误",
    throw: "主动抛出一个错误",
    interface: "定义对象形状的契约——规定有哪些字段、各是什么类型",
    type: "给类型起别名",
    泛型: `不确定类型时的占位符，<T> 表示\u201C不管传入什么类型\u201D`,
    import: "从别的文件借东西过来用",
    export: "把自己的东西暴露出去给其他文件用",
    jsx: "在 TypeScript 里写 HTML 标签的写法",
    组件: "React 里可以复用的界面块，函数返回 JSX",
    props: "传给组件的参数",
    usestate: "React 钩子，让组件记住状态",
    map: "JS 内置的键值对字典",
    date: "日期时间对象",
    consolelog: "在控制台打印信息",
    consoleerror: "在控制台打印错误",
    fetch: "浏览器内置函数，发 HTTP 请求",
    post: "HTTP 方法，往服务器送数据",
    json: "一种数据格式，类似 Python 字典的写法",
    headers: "HTTP 请求头，放额外信息",
    模板字符串: "反引号 `${}` 拼接变量和文字",
    箭头函数: "() => 的简写函数写法",
  },

  "llm-api": {
    api: "你和服务员之间的传话通道",
    "llm api": "专门跟大语言模型对话的 API",
    prompt: "你发给 AI 的文字",
    response: "AI 回给你的文字",
    "system role": "给 AI 定人设的角色——你是谁、怎么说话",
    "user role": "你真正想问的内容",
    "assistant role": "AI 上一次回答的内容",
    messages: "对话记录列表，每条包含 role 和 content 字段",
    上下文窗口: `AI 能\u201C记住\u201D的最大对话长度`,
    token: "AI 处理文本的最小单位，约等于一个中文字或几个英文字母",
    http请求: "浏览器往服务器发的一段消息",
    "json.stringify": "把对象变成 JSON 字符串",
  },

  "system-prompt": {
    "system prompt": "给 AI 的入职说明书——你是谁、怎么做、出事了怎么办",
    角色: "System Prompt 第一要素：身份 + 说话风格 + 能力边界",
    格式: "System Prompt 第二要素：输出长度、排版、语气",
    边界: "System Prompt 第三要素：不知道/跑题/出错的兜底规则",
    prompt模板: "可复用的 System Prompt 结构，填空就行",
  },

  "agent-loop": {
    "agent loop": "思考→行动→观察→重复的循环",
    think: "Agent 循环第一步：分析信息，决定下一步",
    act: "Agent 循环第二步：调用工具或直接回答",
    observe: "Agent 循环第三步：检查工具返回的结果",
    agent: "能自己思考、调用工具、根据结果调整计划的 AI 程序",
    工具调用: "Agent 调用外部函数（天气查询、搜索、计算）的能力",
    重试: "操作失败后自动再来一次",
    回退: "所有重试都失败后的兜底方案",
  },

  "tool-calling": {
    "tool calling": "Agent 调用外部工具的标准方式",
    tool: "一个外部工具或函数，可以被 Agent 调用",
    "tool definition": "告诉 AI 什么时候该用什么工具的参数说明",
    schema: "工具参数的格式规范——必须有哪些字段、各是什么类型",
    zod: "TypeScript 的校验库，检查数据是否符合 Schema",
    toolresult: "工具调用后返回的结果",
  },

  rag: {
    rag: "Retrieval-Augmented Generation——让 AI 先查资料再回答",
    检索: "从知识库里找到相关的内容",
    嵌入: "把文字转成一串数字，相似意思的数字也相近",
    向量数据库: "存嵌入数字的数据库，用来做相似性搜索",
    文档切块: "把长文档切成小段，每段作为一个可检索的单元",
    知识库: "存放文档切片的地方",
  },

  "llm-wiki": {
    "llm wiki": "用 Markdown 写的、可以被 AI 检索和引用的结构化知识库",
    markdown: "带标记的纯文本格式，用 # ## 标题、用 ** ** 加粗",
    frontmatter: "Markdown 文件顶部的 --- 包裹的元数据",
    wiki页面: "Markdown 文件渲染成的页面",
    引用: "从知识库里找到相关内容并在回答中标注来源",
  },

  "platform-replica": {
    nextjs: "React 之上的一层框架，处理路由和服务器端渲染",
    "next.js": "一个全栈 Web 框架，可以写前端也可以写后端",
    shadcn: "基于 Radix UI 的组件库，复制代码就能用",
    tailwindcss: "一种 CSS 原子类写法，class 名即样式",
    layout: "页面的骨架结构，多个页面共享的容器",
    page: "一个路由对应的页面组件",
    apiroute: "Next.js 里在 /api 路径下定义后端接口的文件",
    serveraction: "在前端组件里直接调用后端逻辑的 Next.js 功能",
  },

  "multi-agent": {
    "multi-agent": "多个 Agent 各司其职、互相配合的系统架构",
    orchestrator: "调度 Agent 的 Agent——决定任务分给谁",
    角色分工: "每个 Agent 分配明确的职责边界",
    agent间通信: "Agent 之间传数据的协议和格式",
    任务分解: "把大任务拆成多个小任务分给各个 Agent",
  },

  mcp: {
    mcp: "Model Context Protocol——AI 和外界工具之间的标准协议",
    "mcp server": "提供工具给 AI 调用的服务端",
    "mcp client": "调用 MCP Server 工具的客户端",
    协议: "双方通信时遵守的格式约定",
    transport: "MCP 里数据怎么传——stdio 还是 HTTP",
  },

  "ai-safety": {
    prompt注入: "用户在输入里夹带指令，试图篡改 AI 的行为",
    越狱: "用特殊提示词绕过 AI 的安全限制",
    内容过滤: "检查 AI 输入输出中是否有不安全的文本",
    沙盒: "把 AI 工具调用放进隔离环境执行，防止破坏宿主系统",
    速率限制: "限制短时间内 API 调用次数，防止滥用",
  },
};

// ---- 模块顺序 ----

export const MODULE_ORDER = [
  "ts-basics",
  "llm-api",
  "system-prompt",
  "agent-loop",
  "tool-calling",
  "rag",
  "llm-wiki",
  "platform-replica",
  "multi-agent",
  "mcp",
  "ai-safety",
];

// ---- 知识窗类 ----

export class KnowledgeWindow {
  /** moduleId → 该模块之前已学过的所有术语 */
  private cumulativeVocab: Map<string, Set<string>>;
  /** moduleId → 本模块新引入的术语 */
  private moduleVocab: Map<string, Set<string>>;
  /** 术语名 → 完整 Term 对象 */
  private termMap: Map<string, Term>;

  constructor() {
    this.cumulativeVocab = new Map();
    this.moduleVocab = new Map();
    this.termMap = new Map();

    const accumulated = new Set<string>();

    for (const moduleId of MODULE_ORDER) {
      // 保存当前累积的作为"进入本模块前的知识"
      this.cumulativeVocab.set(moduleId, new Set(accumulated));

      // 本模块的词汇
      const vocab = MODULE_VOCABULARY[moduleId] ?? {};
      const terms = new Set<string>();
      for (const [termName, def] of Object.entries(vocab)) {
        const key = termName.toLowerCase();
        terms.add(key);
        accumulated.add(key);
        // 只在新引入时记录（避免后面模块覆盖定义）
        if (!this.termMap.has(key)) {
          this.termMap.set(key, {
            name: key,
            display: termName,
            definition: def,
            moduleId,
          });
        }
      }
      this.moduleVocab.set(moduleId, terms);
    }
  }

  /**
   * 获取模块 N 之前（不含）已知的所有术语名
   */
  getKnownTerms(moduleId: string): Set<string> {
    return this.cumulativeVocab.get(moduleId) ?? new Set();
  }

  /**
   * 获取本模块新引入的术语名
   */
  getModuleTerms(moduleId: string): Set<string> {
    return this.moduleVocab.get(moduleId) ?? new Set();
  }

  /**
   * 检查一个术语是否在模块 N 之前已知
   */
  isKnown(moduleId: string, term: string): boolean {
    return this.getKnownTerms(moduleId).has(term.toLowerCase());
  }

  /**
   * 获取术语的完整定义
   */
  getTermDefinition(term: string): Term | undefined {
    return this.termMap.get(term.toLowerCase());
  }

  /**
   * 查找术语在哪个模块首次被定义
   */
  findTermOrigin(term: string): string | undefined {
    return this.termMap.get(term.toLowerCase())?.moduleId;
  }

  /**
   * 给定一个术语列表，返回其中不在知识窗内的术语
   */
  findUnknownTerms(moduleId: string, terms: string[]): string[] {
    const known = this.getKnownTerms(moduleId);
    return terms.filter((t) => !known.has(t.toLowerCase()));
  }

  /**
   * 在代码文本中检测未来模块的概念泄漏
   *
   * 对模块 `moduleId` 的代码文本，检查是否包含了在后续模块才定义的术语。
   * 返回按严重程度排序的概念泄漏列表。
   */
  detectLeaks(moduleId: string, codeText: string): ConceptLeak[] {
    const leaks: ConceptLeak[] = [];
    const moduleIndex = MODULE_ORDER.indexOf(moduleId);
    if (moduleIndex === -1) return leaks;

    // 只检查后续模块的词汇（本模块词汇可能在讲稿中出现，不算泄漏）
    const currentModuleTerms = new Set<string>();
    for (const [key] of Object.entries(MODULE_VOCABULARY[moduleId] ?? {})) {
      currentModuleTerms.add(key.toLowerCase());
    }

    // 收集所有"未来词汇"——后续模块才定义的词
    const futureTerms = new Map<string, string>(); // term → definedIn
    for (const term of this.termMap.values()) {
      const termIndex = MODULE_ORDER.indexOf(term.moduleId);
      if (termIndex > moduleIndex) {
        futureTerms.set(term.name, term.moduleId);
      }
    }

    // 在代码中搜索每个未来词汇
    const codeLower = codeText.toLowerCase();
    for (const [termName, definedIn] of futureTerms) {
      // 跳过太短的词（容易误匹配）
      if (termName.length < 3) continue;

      // 尝试多种匹配方式
      const patterns = [
        // 1. 完整词匹配（考虑驼峰命名拆分）
        termName,
        // 2. 连字符拆分（agent-loop → agent, loop）
        ...termName.split("-"),
        // 3. 下划线拆分
        ...termName.split("_"),
        // 4. 驼峰拆分后的每个部分（AgentLoop → agent, loop）
        ...splitCamelCase(termName),
      ];

      for (const pattern of patterns) {
        if (pattern.length < 3) continue;
        const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        // 用单词边界匹配
        const regex = new RegExp(`\\b${escaped}\\b`, "gi");
        const matches = codeText.match(regex);
        if (matches && matches.length > 0) {
          // 提取出现位置的代码片段
          const firstIndex = codeLower.indexOf(pattern);
          const snippet =
            firstIndex >= 0
              ? codeText.slice(
                  Math.max(0, firstIndex - 30),
                  firstIndex + pattern.length + 30,
                )
              : `"${pattern}" 出现在代码中`;

          // 判断严重程度
          const dist =
            MODULE_ORDER.indexOf(definedIn) - MODULE_ORDER.indexOf(moduleId);
          let severity: ConceptLeak["severity"] = "medium";
          if (dist >= 3) severity = "critical";
          else if (dist >= 2) severity = "high";

          leaks.push({
            term: termName,
            definedIn,
            codeSnippet: snippet,
            severity,
          });
          break; // 此术语已找到，不再重复
        }
      }
    }

    // 按严重程度排序
    const severityOrder = { critical: 0, high: 1, medium: 2 };
    leaks.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return leaks;
  }

  /**
   * 生成知识窗报告
   */
  analyzeCode(moduleId: string, codeText: string): KnowledgeWindowReport {
    const known = this.getKnownTerms(moduleId);
    const leaks = this.detectLeaks(moduleId, codeText);

    // 统计代码中引用的未知术语
    const allTermsInCode = extractCodeTerms(codeText);
    const unknownTerms = this.findUnknownTerms(moduleId, allTermsInCode);

    return {
      knownTermCount: known.size,
      leaks,
      unknownTermCount: unknownTerms.length,
    };
  }
}

// ---- 工具函数 ----

/** 拆分驼峰命名：AgentLoop → ["agent", "loop"] */
function splitCamelCase(name: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const ch of name) {
    if (ch >= "A" && ch <= "Z" && current.length > 0) {
      parts.push(current.toLowerCase());
      current = ch;
    } else {
      current += ch;
    }
  }
  if (current.length > 0) parts.push(current.toLowerCase());
  return parts;
}

/** 从代码文本中提取关键标识符/术语 */
function extractCodeTerms(code: string): string[] {
  const terms = new Set<string>();

  // 1. PascalCase 标识符（React 组件、类型名）
  const pascalRegex = /\b([A-Z][a-z0-9]+(?:[A-Z][a-z0-9]+)+)\b/g;
  for (const m of code.matchAll(pascalRegex)) {
    terms.add(m[1]);
    // 也加入拆分后的部分
    for (const part of splitCamelCase(m[1])) {
      if (part.length >= 3) terms.add(part);
    }
  }

  // 2. 小写下划线命名
  const snakeRegex = /\b([a-z][a-z0-9]*(?:_[a-z][a-z0-9]*)+)\b/g;
  for (const m of code.matchAll(snakeRegex)) {
    terms.add(m[1].toLowerCase());
    for (const part of m[1].split("_")) {
      if (part.length >= 3) terms.add(part);
    }
  }

  // 3. 连字符命名
  const kebabRegex = /\b([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)+)\b/g;
  for (const m of code.matchAll(kebabRegex)) {
    terms.add(m[1].toLowerCase());
    for (const part of m[1].split("-")) {
      if (part.length >= 3) terms.add(part);
    }
  }

  // 4. import 路径的最后一段
  const importRegex = /from\s+['"](?:@\/)?([\w/-]+)['"]/g;
  for (const m of code.matchAll(importRegex)) {
    const parts = m[1].split("/");
    const last = parts.at(-1);
    if (last && last.length >= 3) {
      terms.add(last.toLowerCase());
    }
  }

  // 5. 关键 API 调用模式
  const apiRegex = /\b\w+\.(\w+)\s*\(/g;
  for (const m of code.matchAll(apiRegex)) {
    if (m[1].length >= 3) terms.add(m[1].toLowerCase());
  }

  return [...terms];
}

// ---- 单例 ----

let _window: KnowledgeWindow | null = null;

export function getKnowledgeWindow(): KnowledgeWindow {
  if (!_window) {
    _window = new KnowledgeWindow();
  }
  return _window;
}

/**
 * 格式化概念泄漏列表为可读文本，用于报告和日志
 */
export function formatLeakReport(leaks: ConceptLeak[]): string {
  if (leaks.length === 0) return "✅ 未检测到概念泄漏";

  const critical = leaks.filter((l) => l.severity === "critical");
  const high = leaks.filter((l) => l.severity === "high");
  const medium = leaks.filter((l) => l.severity === "medium");

  const lines: string[] = [];
  if (critical.length > 0) {
    lines.push(
      `🔴 Critical（≥3 讲后才教）：${critical.map((l) => `\`${l.term}\`→${l.definedIn}`).join("、")}`,
    );
  }
  if (high.length > 0) {
    lines.push(
      `🟠 High（≥2 讲后才教）：${high.map((l) => `\`${l.term}\`→${l.definedIn}`).join("、")}`,
    );
  }
  if (medium.length > 0) {
    lines.push(
      `🟡 Medium（下一讲才教）：${medium.map((l) => `\`${l.term}\`→${l.definedIn}`).join("、")}`,
    );
  }
  return lines.join("\n");
}
