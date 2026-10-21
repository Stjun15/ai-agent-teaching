### 第三斧：知识 + 数据库 + 点评

#### 这一斧的目标

搭完 AI 知道三件事：**你在学什么**（RAG 注入讲稿）、**你学了什么**（SQLite 存掌握度）、**你学得怎么样**（点评 Agent 打分）。

#### 前置知识速查

| 你学过的概念   | 在本斧的用途                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **RAG**        | 检索增强生成。在调大模型之前，先从教材库里捞出当前模块的讲稿，塞进 System Prompt——模型就能「照着教材讲」。                           |
| **LLM Wiki**   | 教材库的结构。每个模块的概念页（`llm-wiki/concepts/xxx.md`）就是 RAG 的知识来源。                                                    |
| **SQLite**     | 一个轻量级数据库。你的进度数据（学了哪些模块、每个模块的得分）存在这里。Node.js 22.5+ 内置了 `node:sqlite`，不需要额外安装任何东西。 |
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

---

#### 第二步：SQLite 存掌握度

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

#### 第三步：写点评 Agent

新建 `src/lib/review.ts`：

```typescript
import { getModuleMastery, upsertMastery } from "./db";

const REVIEW_SYSTEM_PROMPT = `你是作业点评导师。你的任务是对学生提交的代码作业进行维度化评分。

## 评分维度

对每份作业，你从以下 4 个维度打分（每个维度 1-5 分）：

1. **正确性**：代码能不能跑通？逻辑对不对？
2. **可读性**：变量命名清不清晰？结构乱不乱？
3. **完整性**：有没有缺关键步骤？错误处理做了吗？
4. **规范性**：有没有遵循课程教的代码规范？

## 输出格式

你必须**严格**按以下 JSON 格式输出，不要有任何额外文字：

{
  "dimensions": {
    "正确性": 4,
    "可读性": 3,
    "完整性": 5,
    "规范性": 4
  },
  "deductions": ["可读性扣分：变量名 x1, x2 含义不明确，建议改成 leftOperand, rightOperand"],
  "suggestions": "整体正确，但建议给每个函数加上 JSDoc 注释说明参数和返回值。",
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

#### 第四步：创建点评 API 路由

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

**验证知识点注入 + 数据库：**

```bash
# ① 验证数据库能读写
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT * FROM mastery').all())"
# → 先看到空数组 []（表已建好，无记录）

# ② 验证点评 Agent
curl -X POST http://localhost:3000/api/validate \
  -H "Content-Type: application/json" \
  -d '{"moduleId":"llm-api","content":"const apiKey = process.env.API_KEY; async function chat(msg) { const res = await fetch(\"https://api.example.com/chat\", { method: \"POST\", headers: {\"Authorization\": \"Bearer \" + apiKey}, body: JSON.stringify({message: msg}) }); return res.json(); }"}'
# → 返回 JSON 含维度分、扣分点、改进建议

# ③ 再次查数据库
node -e "const{DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('dev.db');console.log(db.prepare('SELECT module_id, score FROM mastery').all())"
# → 有记录，包含 module_id 和 score
```

预期结果：

- [ ] AI 回复基于注入的教材内容（不会凭空编造）
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

> 🔖 **存档检查点**：第三斧全绿——RAG 注入、掌握度存库、点评 Agent 打分。到此为止，你的单机版教学平台已经是一个完整的 AI 应用了：
> ```bash
> git add -A && git commit -m "第三斧完成：RAG 知识注入 + SQLite 存档 + 点评 Agent"
> ```

---
