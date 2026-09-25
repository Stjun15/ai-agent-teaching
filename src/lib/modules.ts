/**
 * 教学模块注册表 —— **从 LLM Wiki 概念页现读，不在这里抄一份**
 *
 * 为什么不硬编码
 * -------------
 * 9 个模块的 id / 名称 / 难度 / 预估时长 / 标签 / 前置依赖，权威来源是
 * `llm-wiki/concepts/*.md` 的 frontmatter（由 `SCHEMA.md` 约束必填字段）。
 * 在代码里再写一份常量表会立刻产生第三份数据（另两份是 `index.md` 的索引表
 * 与页面 frontmatter），漂移只是时间问题 —— Phase 2 已经吃过一次同类的亏：
 * `index.md` 与源页面有 5 处名称不一致。
 *
 * 顺带解决了另一件事：`src/wiki/` 此前没有任何调用方。知识层写完了却没人用，
 * 等于交付了两遍。本文件是它的第一个真实消费方。
 *
 * 教学顺序由依赖图算出来，不是写死的
 * ---------------------------------
 * `index.md` 写着「概念之间有先后依赖，按下列顺序学习：llm-api → … → ai-safety」。
 * 这条顺序**可以从 `prerequisites` 拓扑排序得到**，所以不重复声明：
 * 页面里改了依赖关系，顺序自动跟着改。链条上每步只有一个就绪节点，
 * 结果与 `index.md` 逐字一致（见验证说明）。
 *
 * ⚠️ 本模块读文件系统，**只能在服务端（React Server Component / Route Handler）
 * 使用**。客户端组件 import 它会让 Next 构建失败（`node:fs` 无法打包）。
 * 这不是疏忽，是刻意的：让误用立刻在构建期暴露，而不是留到运行期白屏。
 */

import { listPages } from "@/wiki";
import type { SceneId } from "@/lib/agent/scene-ids";
import type { WikiPage } from "@/wiki";

/**
 * 模块 → 可视化场景的映射。
 *
 * 这一份是**产品决策**，不是从 wiki 推导的：出处 `04-frontend.md`「9 个可视化场景」
 * 的对应表。场景的实现在 Phase 6，本阶段只把 id 带进数据，让模块页能提前
 * 声明「这里将来放哪个场景」。
 *
 * 值受 `SceneId` 约束（`satisfies`）：场景 ID 在提示词、本文档、本表各存一份，
 * 若某天提示词里写了个前端不存在的场景，界面会静默空白 —— 用类型把这处漂移
 * 提前到编译期。权威定义见 `src/lib/agent/scene-ids.ts`。
 */
export const MODULE_SCENE_IDS: Readonly<Record<string, SceneId>> = {
  "llm-api": "scene-request-response",
  "system-prompt": "scene-role-filter",
  "agent-loop": "scene-loop-weather",
  "tool-calling": "scene-tool-chain",
  rag: "scene-retrieve-generate",
  "llm-wiki": "scene-rag-vs-wiki",
  "multi-agent": "scene-orchestration",
  mcp: "scene-mcp-flow",
  "ai-safety": "scene-attack-defense",
};

/** 概念页正文里承载「一句话定义」的小节标题（见 `wiki-schema.md` 概念页模板）。 */
const DEFINITION_HEADING = "## 定义";

export interface TeachingModule {
  /** 概念页 frontmatter 的 `id`，同时是路由参数（`/learn/[moduleId]`）。 */
  id: string;
  /** 概念页 frontmatter 的 `name`，例如「LLM API 入门」。 */
  name: string;
  /** 正文「## 定义」的首段，用作模块卡片的一句话说明。 */
  summary: string;
  /** 1~5，取自概念页 frontmatter。 */
  difficulty: number;
  /** 例如 `30min`，取自概念页 frontmatter。 */
  estimatedTime: string;
  tags: string[];
  /** 前置模块 id。用于推导教学顺序，也用于界面提示。 */
  prerequisites: string[];
  /** 对应可视化场景 id；未映射时为 null（场景在 Phase 6 补齐）。 */
  sceneId: string | null;
  /** 相对教学顺序，从 0 开始。 */
  order: number;
  /** 卡片上显示的序号文案。空串表示用默认「第 N 讲」。 */
  orderLabel: string;
  /** 模块学习页路径。 */
  href: string;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

/**
 * 取出正文「## 定义」下的首段。
 *
 * 按行读到第一个空行为止，行间**不加空格**拼接 —— 模板里的定义是中文，
 * 两行本来就是一个句子被折行（`…“对话通道”。` / `你发送一段文字…`），
 * 补空格反而会插进一个不该有的空白。
 *
 * 找不到「## 定义」时返回空串而不是抛错：卡片少一行说明不影响可用性，
 * 而缺小节的页面该由 `maintain` 报出来，不该让整个学习中心打不开。
 */
function extractDefinition(body: string): string {
  const lines = body.split(/\r?\n/);
  const headingIndex = lines.findIndex(
    (line) => line.trim() === DEFINITION_HEADING,
  );
  if (headingIndex === -1) return "";

  const paragraph: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) break;
    if (trimmed === "") {
      if (paragraph.length > 0) break;
      continue;
    }
    paragraph.push(trimmed);
  }
  return paragraph.join("");
}

/**
 * 按 `prerequisites` 依赖图拓扑排序。
 *
 * 采用**分层**取法：每轮把所有「前置已全部满足」的节点按 id 字典序取出。
 * 这样结果与输入顺序无关（可复验），且并行分支有确定的先后。
 * 当前 9 个概念是一条链，每轮只有一个就绪节点，所以顺序唯一确定。
 *
 * 未知的前置引用（指向不存在的模块）**不参与排序**，当作外部依赖忽略 ——
 * 死链的检查是 `maintain` 的职责，在此重复一遍只会多出一处会漂移的判据。
 * 真出现环时抛错：那不是可以静默降级的情况，顺序错乱的课程比打不开更糟。
 */
function sortByPrerequisites(pages: WikiPage[]): WikiPage[] {
  const ids = pages.map((page) => asString(page.frontmatter.id));
  const known = new Set(ids);
  const remaining = new Map(
    pages.map((page) => [
      asString(page.frontmatter.id),
      asStringArray(page.frontmatter.prerequisites).filter((ref) =>
        known.has(ref),
      ),
    ]),
  );

  const sorted: WikiPage[] = [];
  const byId = new Map(
    pages.map((page) => [asString(page.frontmatter.id), page]),
  );

  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter(([, prerequisites]) => prerequisites.length === 0)
      .map(([id]) => id)
      .sort();

    if (ready.length === 0) {
      throw new Error(
        `概念页的 prerequisites 存在循环依赖，无法推导教学顺序：${[...remaining.keys()].sort().join("、")}`,
      );
    }

    for (const id of ready) {
      remaining.delete(id);
      sorted.push(byId.get(id) as WikiPage);
      for (const prerequisites of remaining.values()) {
        const at = prerequisites.indexOf(id);
        if (at !== -1) prerequisites.splice(at, 1);
      }
    }
  }

  return sorted;
}

/** 读取全部概念页并组装成教学模块列表（按依赖顺序）。 */
export async function loadModules(): Promise<TeachingModule[]> {
  const pages = await listPages();
  const concepts = pages.filter((page) => page.type === "concept");

  let regularNo = 0;
  return sortByPrerequisites(concepts).map((page, order) => {
    const id = asString(page.frontmatter.id);
    const isLanguageModule = id === "python-basics" || id === "ts-basics";
    if (!isLanguageModule) regularNo++;
    return {
      id,
      name: asString(page.frontmatter.name, id),
      summary: extractDefinition(page.body),
      difficulty: Number(page.frontmatter.difficulty ?? 0),
      estimatedTime: asString(page.frontmatter.estimated_time),
      tags: asStringArray(page.frontmatter.tags),
      prerequisites: asStringArray(page.frontmatter.prerequisites),
      sceneId: MODULE_SCENE_IDS[id] ?? null,
      order,
      orderLabel: isLanguageModule ? "0" : `${regularNo}`,
      href: `/learn/${id}`,
    };
  });
}

/** 按 id 取单个模块；不存在时返回 undefined（由调用方决定是 404 还是兜底）。 */
export async function findModule(
  id: string,
): Promise<TeachingModule | undefined> {
  const modules = await loadModules();
  return modules.find((teachingModule) => teachingModule.id === id);
}

/** 难度 1~5 的固定档位数量，用于掌握度条等需要满量程的地方。 */
export const MAX_DIFFICULTY = 5;
