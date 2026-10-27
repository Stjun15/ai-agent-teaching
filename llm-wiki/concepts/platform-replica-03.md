---
type: concept
last_updated: 2026-10-27
id: platform-replica-03
name: 复刻第三斧：知识 + 数据库 + 点评
prerequisites: [platform-replica-02]
difficulty: 4
estimated_time: 90min
tags: [replica, retired-teaching]
---

### 第三斧：知识 + 数据库 + 点评

#### 这一斧的目标

搭完 AI 知道三件事：**你在学什么**（RAG 注入讲稿）、**你学了什么**（SQLite 存掌握度）、**你学得怎么样**（点评 Agent 打分）。

#### 前置知识速查

| 你学过的概念   | 在本斧的用途                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **RAG**        | 检索增强生成。两步走——静态注入（调模型前把当前模块讲稿塞进 System Prompt）+ 动态检索（把学生问题向量化，从全部教材中检索最相关的几页）。 |
| **Embedding**  | 文本→向量的转换。语义相近的文字向量距离近——这是动态检索的数学基础。                                                                   |
| **LLM Wiki**   | 教材库的结构。每个模块的概念页（`llm-wiki/concepts/xxx.md`）既是 RAG 静态注入的知识来源，也是向量索引的切块素材。                        |
| **SQLite**     | 一个轻量级数据库。你的进度数据（学了哪些模块、每个模块的得分）+ 知识库向量索引（章节块→向量 BLOB）都存在这里。Node.js 22.5+ 内置了 `node:sqlite`，不需要额外安装任何东西。 |
| **点评 Agent** | 一个带上评分维度的 System Prompt + Agent Loop。学生交作业，Agent 按维度打分，返回扣分点和改进建议。                                  |

---

#### 第一步：注入讲稿上下文（RAG）

新建 `src/lib/lecture-context.ts`：

```typescript
import fs from "node:fs";
import path from "node:path";

/**
 * 读取指定模块的讲稿内容
 * @param moduleId - 模块的 id，如 "llm-api"、"system-prompt"
 * @returns 讲稿的 Markdown 原文，找不到则返回 undefined
 */
export function loadLectureContent(moduleId: string): string | undefined {
  // 讲稿放在项目根目录的 llm-wiki/concepts/ 下
  const filePath = path.join(
    process.cwd(),
    "llm-wiki",
    "concepts",
    `${moduleId}.md`,
  );

  if (!fs.existsSync(filePath)) return undefined;

  // 读取整个文件内容
  const raw = fs.readFileSync(filePath, "utf-8");

  // 去掉 YAML front matter（文件头部的 --- 块）
  // 它是给平台程序读的元数据，不需要喂给模型
  const contentStart = raw.indexOf("---", 3);
  if (contentStart !== -1) {
    return raw.slice(contentStart + 3).trim();
  }

  return raw;
}
```

**逐行讲解：**

| 关键点                               | 解释                                                                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `node:fs` / `node:path`              | Node.js 内置的文件系统模块。`fs` 用来读写文件，`path` 用来拼接文件路径。`node:` 前缀是 Node.js 的约定，表示「这是内置模块，不是 npm 包」。 |
| `process.cwd()`                      | 当前工作目录——就是你启动 `npm run dev` 的那个文件夹（项目根目录）。                                                                        |
| `fs.existsSync(filePath)`            | 检查文件是否存在。`Sync` 后缀表示同步操作——代码会停下来等文件系统返回结果再继续。                                                          |
| `fs.readFileSync(filePath, "utf-8")` | 读取文件的全部内容，以 UTF-8 编码（支持中文）返回字符串。                                                                                  |
| YAML front matter                    | Markdown 文件顶部的 `---` 包裹区域，包含 `type`、`id`、`tags` 等元数据。这些是给程序读的配置，喂给模型只会浪费 token，所以要去掉。         |

然后在 `route.ts` 或 `agent-loop.ts` 的 System Prompt 里注入讲稿：

```typescript
import { loadLectureContent } from "@/lib/lecture-context";

// 假设当前正在学 "llm-api" 这个模块
const lecture = loadLectureContent("llm-api");

const systemPrompt = lecture
  ? `${TEACHING_SYSTEM_PROMPT}\n\n【本讲参考资料】\n${lecture}`
  : TEACHING_SYSTEM_PROMPT;
```

**原理：** RAG 的核心就是这句话——**「调模型之前，把参考资料塞进 System Prompt」**。模型看到参考资料后，回复会严格基于资料内容，而不是靠「记忆」瞎编。

> **这一步就是你的「教学文档生成」：** 你写的知识卡片（`llm-wiki/concepts/*.md`）是素材，
> `loadLectureContent` 把它们变成模型的教学上下文——素材→教材，自动的。
> 静注入对于当前模块的讲解完全够用。但学生中途跨模块提问（"RAG 和 LLM Wiki 有什么
> 区别？"）时，只注一个模块的全文不够——需要动态检索。这就是下一步的用武之地。

---

#### 第二步：知识库向量索引与混合检索（RAG 向量）

**第一步的 RAG 是"静态注入"——讲哪个模块就加载哪个模块的全文。但教学对话里学生会天马行空地问，AI 需要从整个教材库里动态找到最相关的几页作为引用依据。这一步搭的就是这个能力：**

- **离线索引**（跑一次脚本）：全部概念页按 `##` 标题切块 → Embedding 向量化 → 存 SQLite
- **在线检索**（每条消息触发）：学生问题向量化 → 与全部章节块算余弦 → 取 top 3 → 作为 SSE `citation` 事件，在模型回答**之前**发给前端

**关键新增概念：**

| 概念 | 解释 |
|------|------|
| Embedding API | 和聊天 API 一样是 HTTP 调用，但返回的不是文字，是一串浮点数（向量）。DashScope 的 `text-embedding-v4` 或 OpenAI 兼容的 embedding 端点都行。 |
| 余弦相似度 | 两个向量夹角的余弦值，范围 [-1, 1]。0.8+ 高度相关，0.3 以下基本无关。你已经在 RAG 模块学过原理，这里直接写代码算。 |
| 离线索引 | "提前算好，运行时只读"。索引脚本跑一次把全部页面向量化存库，之后每次检索只需要给一个问题向量化+算余弦，毫秒级出结果。 |
| SSE `citation` 事件 | 在模型回答第一个字之前先把引用卡片推到前端——学生先看到"本节参考了哪几页教材"，再看到 AI 的回答。事件类型叫 `citation`，不是 `content`。 |

---

##### 2a：离线索引脚本

新建 `scripts/index.ts`。这个脚本只跑一次（或用 `pnpm index` 触发）：遍历 `llm-wiki/concepts/` 全部 .md 文件 → 读内容 → 按 `##` 标题切块 → 逐块调 Embedding API → 存 SQLite。

```typescript
// scripts/index.ts
import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const db = new DatabaseSync("dev.db");

// ① 建表（如果还没有）
db.exec(`
  CREATE TABLE IF NOT EXISTS knowledge_embeddings (
    page_path TEXT NOT NULL,
    heading TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    embedding BLOB NOT NULL,
    model TEXT NOT NULL,
    dim INTEGER NOT NULL
  )
`);

const CONCEPTS_DIR = "llm-wiki/concepts";

// ② 按 ## 标题切块
function chunkMarkdown(body: string): { heading: string; content: string }[] {
  const lines = body.split("\n");
  const chunks: { heading: string; content: string }[] = [];
  let current = { heading: "", content: "" };
  for (const line of lines) {
    const match = line.match(/^##\s+(.*)$/);
    if (match) {
      if (current.content.trim()) chunks.push(current);
      current = { heading: match[1].trim(), content: "" };
      continue;
    }
    current.content += line + "\n";
  }
  if (current.content.trim()) chunks.push(current);
  return chunks;
}

// ③ 调 Embedding API 把文字转成向量
async function embed(text: string): Promise<Float32Array> {
  const res = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-v4",
        input: text,
      }),
    },
  );
  const data = await res.json();
  return Float32Array.from(data.data[0].embedding);
}

async function main() {
  // ④ 全量重建：先清空，再逐篇切块+向量化
  db.prepare("DELETE FROM knowledge_embeddings").run();

  const files = readdirSync(CONCEPTS_DIR).filter((f) => f.endsWith(".md"));
  const insert = db.prepare(
    `INSERT INTO knowledge_embeddings
       (page_path, heading, content, embedding, model, dim)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );

  for (const file of files) {
    const filePath = path.join(CONCEPTS_DIR, file);
    const raw = readFileSync(filePath, "utf-8");
    // 去掉 YAML front matter
    const contentStart = raw.indexOf("---", 3);
    const body = contentStart !== -1 ? raw.slice(contentStart + 3) : raw;

    const chunks = chunkMarkdown(body);
    for (const chunk of chunks) {
      const vector = await embed(chunk.content);
      insert.run(
        file,
        chunk.heading,
        chunk.content.slice(0, 2400), // 单块上限 2400 字符，超出截断
        Buffer.from(vector.buffer),
        "text-embedding-v4",
        vector.length,
      );
    }
  }

  console.log(`索引完成：${files.length} 页 → ${db.prepare("SELECT COUNT(*) as c FROM knowledge_embeddings").get() as any}.c 个章节块`);
}

main().catch(console.error);
```

**逐行讲解：**

| 关键点 | 解释 |
|--------|------|
| `chunkMarkdown` | 把 Markdown 正文按 `##` 标题切成章节块。页首引言（第一个 `##` 之前）为第 0 块、heading 为空串。不用更细的 `###`——太细了语义不完整。 |
| `embed()` | 和 `chat()` 一样是 HTTP POST，但调的是 `/embeddings` 端点。返回的 `data[0].embedding` 是一个数字数组（如 `[0.23, -0.11, 0.89, ...]`），长度由模型决定（常见 1024 或 1536 维）。 |
| `Buffer.from(vector.buffer)` | SQLite 只存字节，不认 `Float32Array`。`Float32Array.buffer` 拿到原始 ArrayBuffer，`Buffer.from()` 转成可写入 SQLite 的字节序列。读回来时反向操作。 |
| `DELETE FROM ...` 在最前面 | 全量重建——索引应该是"编一次读多次"的只读缓存，不应该增量合并（会积攒重复/过时块）。 |
| `slice(0, 2400)` | 单块上限。章节块天然不长，这只是护栏——防止某页只有一个巨大段落时塞不进上下文。 |

**运行验证：**

```bash
pnpm tsx scripts/index.ts
# 终端输出类似：索引完成：11 页 → 47 个章节块
```

---

##### 2b：在线混合检索 + SSE 引用事件

在 `src/lib/retrieve.ts`（或直接写在 `route.ts` 里）加入检索逻辑：

```typescript
// src/lib/retrieve.ts
import { DatabaseSync } from "node:sqlite";

export interface ChunkRef {
  pagePath: string;
  heading: string;
  snippet: string;
  similarity: number;
}

const db = new DatabaseSync("dev.db");

// ① 余弦相似度
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

interface DbChunk {
  page_path: string;
  heading: string;
  content: string;
  embedding: Buffer;
  dim: number;
}

// ② 检索：向量化问题 → 与全部块算相似度 → 取 top 3
export async function retrieveRelevant(
  question: string,
  topK: number = 3,
): Promise<ChunkRef[]> {
  // 调同一套 embedding API
  const embeddingsRes = await fetch(
    "https://dashscope.aliyuncs.com/compatible-mode/v1/embeddings",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "text-embedding-v4",
        input: question,
      }),
    },
  );
  const embData = await embeddingsRes.json();
  const questionVec = Float32Array.from(embData.data[0].embedding);

  // 加载全部章节块
  const rows = db
    .prepare("SELECT page_path, heading, content, embedding, dim FROM knowledge_embeddings")
    .all() as DbChunk[];

  // 逐块计算余弦，取每页最匹配的块
  const bestPerPage = new Map<string, ChunkRef>();
  for (const row of rows) {
    const chunkVec = new Float32Array(
      row.embedding.buffer,
      0,
      row.dim,
    );
    // slice 一份——Buffer 底下的内存池可能被复用
    const similarity = cosine(questionVec, chunkVec.slice());
    const known = bestPerPage.get(row.page_path);
    if (!known || similarity > known.similarity) {
      bestPerPage.set(row.page_path, {
        pagePath: row.page_path,
        heading: row.heading,
        snippet: row.content.slice(0, 200),
        similarity: Math.round(similarity * 1e4) / 1e4,
      });
    }
  }

  // 排序 + 截断
  return [...bestPerPage.values()]
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}
```

然后在 `route.ts` 里——**在模型回答之前**——先检索再发引用事件：

```typescript
// route.ts 的 POST 处理函数里，在调 chat() 之前加入：

import { retrieveRelevant, type ChunkRef } from "@/lib/retrieve";

// ... 前面解析请求的代码不变 ...

// 检索知识库引用（在模型回答之前发出）
let citations: ChunkRef[] = [];
try {
  citations = await retrieveRelevant(body.content, 3);
} catch {
  // 检索失败不阻塞对话——降级为空引用（好过回答卡住）
  citations = [];
}

// SSE 流——先发引用事件，再发模型回答
const stream = new ReadableStream({
  async start(controller) {
    // ① 先发引用卡片（citation 事件）
    if (citations.length > 0) {
      controller.enqueue(
        `data: ${JSON.stringify({ type: "citation", citations })}\n\n`,
      );
    }

    // ② 再发模型回答（content 事件）
    // ... 后续的 chat() + 逐字发送逻辑不变 ...
  },
});
```

**原理：引用事件为什么要"提前发"**

模型调用需要几秒（网络往返+推理），这段时间学生看着空白屏幕等。引用检索在本地的几百条向量上算余弦，毫秒级完成——完全可以把这段时间利用起来：先发引用卡片，让学生看到"本节参考了 concepts/rag.md、concepts/llm-wiki.md、concepts/ai-safety.md"，再等 AI 回答。引用先到，回答后来——节奏刚好。

**运行验证：**

```bash
# ① 确认索引已构建
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT COUNT(*) as c FROM knowledge_embeddings').get())"
# → { c: 47 }（章节块数量因内容而异）

# ② 发一条会触发跨模块问题的消息
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"LLM Wiki 跟 RAG 有什么区别？"}'
# → SSE 事件顺序：先收到 type: "citation"（含 3 条引用，各有 pagePath + snippet + similarity）
# → 再收到 type: "content"（模型逐字回答）
```

---

> **为什么不用向量数据库（Qdrant/Milvus）？** 11 篇教材按节切块只有几十条记录，全量加载到内存、逐条算余弦只需微秒级——SQLite 存 BLOB 完全够用。向量数据库是海量文档（百万级）才需要的重型武器。你在 RAG 模块学过的 Embedding + 余弦 + 检索逻辑，这里用原生代码实现一遍——理解"向量数据库到底做了什么"，比直接调库更有价值。

---

#### 第三步：SQLite 存掌握度

新建 `src/lib/db.ts`：

```typescript
import { DatabaseSync } from "node:sqlite";

// ① 创建 / 打开数据库
const db = new DatabaseSync("dev.db");

// ② 建表（如果表不存在）
db.exec(`
  CREATE TABLE IF NOT EXISTS mastery (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    module_id TEXT NOT NULL,
    score REAL NOT NULL DEFAULT 0,
    dimension_scores TEXT DEFAULT '{}',
    feedback TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ③ 插入或更新掌握度记录
export function upsertMastery(
  moduleId: string,
  score: number,
  dimensionScores: Record<string, number>,
  feedback: string,
) {
  const existing = db
    .prepare("SELECT id FROM mastery WHERE module_id = ?")
    .get(moduleId) as { id: number } | undefined;

  if (existing) {
    db.prepare(
      `UPDATE mastery 
       SET score = ?, dimension_scores = ?, feedback = ?, updated_at = datetime('now')
       WHERE module_id = ?`,
    ).run(score, JSON.stringify(dimensionScores), feedback, moduleId);
  } else {
    db.prepare(
      `INSERT INTO mastery (module_id, score, dimension_scores, feedback)
       VALUES (?, ?, ?, ?)`,
    ).run(moduleId, score, JSON.stringify(dimensionScores), feedback);
  }
}

// ④ 查询所有掌握度记录
export function getAllMastery() {
  return db.prepare("SELECT * FROM mastery ORDER BY updated_at DESC").all();
}

// ⑤ 查询单个模块的掌握度
export function getModuleMastery(moduleId: string) {
  return db
    .prepare("SELECT * FROM mastery WHERE module_id = ?")
    .get(moduleId) as Record<string, unknown> | undefined;
}
```

**逐行讲解：**

| 标注 | 代码                                       | 解释                                                                                                                                  |
| ---- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| ①    | `new DatabaseSync("dev.db")`               | `DatabaseSync` 是 Node.js 22.5+ 内置的 SQLite 驱动。`"dev.db"` 是数据库文件名——如果项目根目录没有这个文件，它会自动创建一个。         |
| ②    | `CREATE TABLE IF NOT EXISTS mastery (...)` | SQL 建表语句。`IF NOT EXISTS` 表示「如果表已经存在就不动它」。表名叫 `mastery`（掌握度），有 7 个字段。                               |
| ②    | `score REAL NOT NULL DEFAULT 0`            | `score` 是综合分数（浮点数），默认 0。                                                                                                |
| ②    | `dimension_scores TEXT DEFAULT '{}'`       | 各维度的分数，用 JSON 字符串存（SQLite 没有 JSON 列类型）。比如 `{"正确性": 4, "可读性": 3, "完整性": 5}`。                           |
| ②    | `datetime('now')`                          | SQLite 内置函数，返回当前时间。                                                                                                       |
| ③    | `db.prepare(...).get(moduleId)`            | 「预编译」一条 SQL 语句，然后执行它。`?` 是占位符——`get(moduleId)` 把 `moduleId` 填进去。预编译的好处：防 SQL 注入 + 比字符串拼接快。 |
| ③    | `upsertMastery`                            | `upsert` = update + insert。先查有没有记录：有就更新，没有就插入。这样同一个模块的分数始终只有一条记录，新分数覆盖旧分数。            |
| ④    | `getAllMastery()`                          | 查全部记录，按更新时间倒序排列。用于显示学习进度总览。                                                                                |
| ⑤    | `getModuleMastery(moduleId)`               | 查单个模块的掌握度。用于每次答题后回显当前得分。                                                                                      |

> **为什么用 `node:sqlite` 而不是装 `better-sqlite3`？** `node:sqlite` 是 Node.js 22.5 起内置的模块。不用 `npm install`，不用编译 C++ 代码，不用担心不同操作系统的兼容问题——直接 `import` 就能用。对于单机版教学平台这种场景完全够用。

**验证数据库：**

```bash
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
```

如果输出 `[]`（空数组），说明数据库已创建、表已建好，只是还没有记录——正常。

---

#### 第四步：写点评 Agent

新建 `src/lib/review.ts`：

```typescript
import { getModuleMastery, upsertMastery } from "./db";

const REVIEW_SYSTEM_PROMPT = `你是作业点评导师。你的任务是对学生提交的代码作业进行维度化评分。

## 评分方式

评分维度不写死——从验收清单按证据动态生成：

- 提交文本里找到证据的清单条目 → 设维度，打 1-5 分
- 找不到证据的条目 → 不设维度、不给分、不扣分
- 另加一个"代码质量"维度综合评代码本身

## 输出格式

你必须**严格**按以下 JSON 格式输出，不要有任何额外文字：

{
  "dimensions": {
    "SSE 流式对话": 4,
    "System Prompt 约束": 5,
    "代码质量": 3
  },
  "deductions": ["扣分点说明"],
  "suggestions": "整体建议",
  "overall": 4
}`;

export async function reviewHomework(
  moduleId: string,
  homework: string,
): Promise<string> {
  const apiKey = process.env.ARK_API_KEY!;
  const baseUrl = "https://ark.cn-beijing.volces.com/api/v3";

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "deepseek-v4-flash-ga-260731",
      messages: [
        { role: "system", content: REVIEW_SYSTEM_PROMPT },
        {
          role: "user",
          content: `模块：${moduleId}\n\n学生作业：\n${homework}`,
        },
      ],
      temperature: 0.3, // 低温度让评分更稳定
    }),
  });

  if (!res.ok) {
    return `点评请求失败：HTTP ${res.status}`;
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  // 解析模型返回的 JSON，落库
  try {
    const review = JSON.parse(content);
    const overall = review.overall ?? 3;
    const dimensions = review.dimensions ?? {};

    upsertMastery(moduleId, overall, dimensions, JSON.stringify(review));
  } catch {
    // 解析失败不影响返回——学生还能看到原始回复
  }

  return content;
}
```

**逐行讲解：**

| 关键点                        | 解释                                                                                                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `REVIEW_SYSTEM_PROMPT` 的格式 | System Prompt 里写死了输出格式（JSON Schema + 示例）。模型看到这个 Prompt 后，**大概率**会严格按 JSON 格式输出。后续可以加 Tool Calling 用 Schema 硬约束。 |
| `temperature: 0.3`            | 温度参数。范围 0-2，越低模型越「确定」（每次输出几乎一样），越高越「随机」（每次输出可能不同）。评分场景需要稳定，所以设 0.3。                             |
| `upsertMastery(...)`          | 把评分结果存入数据库。这样学生的每次作业评分都被持久化——刷新页面、重启电脑都不会丢。                                                                       |
| try-catch 包裹 `JSON.parse`   | 模型偶尔会在 JSON 外面包一层 markdown 代码块（\`\`\`json ... \`\`\`），导致 `JSON.parse` 失败。用 try-catch 兜底：解析失败照样返回原始内容给学生看。       |

---

#### 第五步：创建点评 API 路由

新建 `src/app/api/validate/route.ts`：

```typescript
import { reviewHomework } from "@/lib/review";

export async function POST(req: Request) {
  const { content, moduleId } = await req.json();

  if (!content || !moduleId) {
    return Response.json(
      { error: "缺少 content 或 moduleId 参数" },
      { status: 400 },
    );
  }

  const result = await reviewHomework(moduleId, content);
  return Response.json({ result });
}
```

---

#### 验收

> 🤖 **Agent 自查**：不用贴 prompt——给你的 Agent 装一个校验工具。打开右侧「工具箱 → Agent 自查」，按步骤把 `check_knowledge` 工具的 Schema 和执行函数装到你的 Agent 里。装好后在对话框说「检查知识引擎」，Agent 自动扫描 RAG/向量/检索/citation/数据库。

**🔍 自助验证：知识点注入 + 向量索引 + 数据库 + 引用：**

```bash
# ① 验证数据库能读写
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT COUNT(*) as c FROM mastery').get())"
# → { c: 0 }（表已建好，无记录）

# ② 验证向量索引已构建
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT COUNT(*) as c FROM knowledge_embeddings').get())"
# → { c: 47 }（章节块数量因内容而异）

# ③ 验证引用检索 + 点评 Agent
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"content":"LLM Wiki 跟 RAG 有什么区别？"}'
# → SSE 事件顺序：先 type: "citation"（3 条引用），再 type: "content"（模型回答）

curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"moduleId":"platform-replica","content":"const name = (void 0).name"}'
# → 返回 JSON 含维度分、扣分点、改进建议

# ④ 再次查数据库
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT module_id, score FROM mastery').all())"
# → 有记录，包含 module_id 和 score
```

预期结果：

- [ ] AI 回复基于注入的教材内容（不会凭空编造）
- [ ] 每次对话附带知识库引用卡片（SSE `citation` 事件，含最相关的 3 页教材）
- [ ] 点评返回 JSON 格式：维度分 + 扣分点 + 改进建议
- [ ] 数据库有掌握度记录，刷新不丢

---

#### 常见问题排查

| 你遇到的问题                   | 大概率是什么原因           | 怎么解决                                                                                                                 |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `DatabaseSync is not defined`  | Node.js 版本 < 22.5        | `node --version` 确认版本。如果 < 22.5，去 nodejs.org 升级                                                               |
| 点评 Agent 返回的不是 JSON     | 模型没有严格按输出格式返回 | 在 System Prompt 里加强约束。或者后续引入 Tool Calling，用 `response_format: { type: "json_object" }` 参数强制 JSON 输出 |
| `fs.existsSync` 找不到讲稿文件 | 路径拼接不对               | 确认 `llm-wiki/concepts/` 文件夹存在。确认 `moduleId` 和文件名（去掉 `.md`）一致                                         |
| 数据库文件 `dev.db` 找不到     | 文件创建在当前工作目录     | `new DatabaseSync("dev.db")` 会在 `process.cwd()` 下创建文件。确认你在项目根目录启动的 `npm run dev`                     |
| `Buffer is not defined`     | client component 里引了 server 代码   | `src/lib/retrieve.ts` 用了 `node:sqlite` 和 `Buffer`，只能被 `route.ts`（服务端）引用。 |

> 🔖 **存档检查点**：第三斧全绿——RAG 注入、向量索引、混合检索、引用卡片、掌握度存库、点评 Agent 打分。到此为止，你的单机版教学平台已经是一个完整的 AI 应用了：
> ```bash
> git add -A && git commit -m "第三斧完成：RAG 知识注入 + 向量索引 + 混合检索 + SQLite 存档 + 点评 Agent"
> ```

---