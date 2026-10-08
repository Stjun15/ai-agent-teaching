# Git 提交规范

## 一、核心原则

**每完成一件事，立即提交。不要攒着。**

比赛明确要求「保留完整的 Git 提交历史，体现真实的开发过程」。

评审会看提交数量、粒度、message 质量、时间分布。

---

## 二、提交时机

每完成以下任一动作，立即提交：

- 创建/修改一个配置文件

- 新增一个组件

- 新增一个 API 路由

- 新增一个 Agent 提示词

- 新增一个 Skill 文件

- 新增一个 Wiki 页面

- 修复一个 bug

- 重构一段代码

- 新增一条测试

- 更新一个文档

- 安装一个依赖

- 调整一处样式

**不允许：** 一次做完整个 Phase 再提交。

---

## 三、提交粒度

| 规则 | 说明 |
|---|---|
| 每个提交只做一件事 | 一个提交不要混入多个不相关改动 |
| 一个提交不超过 10 个文件 | 超过就拆 |
| 一个提交不超过 500 行改动 | 超过就拆 |
| 一个提交不超过 200 行新增 | 超过就拆 |

**示例：**

不要这样：

```
feat: add agent system
（一次提交 50 个文件，3000 行）
```

要这样：

```
feat(agent): add teacher system prompt
feat(agent): add reviewer system prompt
feat(agent): add examiner system prompt
feat(agent): add assistant system prompt
...
```

---

## 四、commit message 格式

```
type(scope): subject
正文说明做了什么、为什么。
```

### type 选择

| type | 用途 |
|---|---|
| feat | 新功能 |
| fix | 修复 bug |
| docs | 文档 |
| chore | 配置、依赖、构建 |
| test | 测试 |
| perf | 性能优化 |
| refactor | 重构（不改逻辑） |
| style | 格式调整（不改逻辑） |
| ci | CI/CD |

### scope 选择

| 模块 | scope |
|---|---|
| Agent 系统 | agent, teacher, reviewer, examiner, assistant |
| 知识层 | wiki, rag, mcp |
| 前端 | ui, chat, editor, visualization |
| 数据接口 | api, db, auth |
| 配置 | config, docs |
| 编排 | orchestrator |
| Trace | trace |

### subject 规则

- 用祈使句（add / fix / update / remove）

- 首字母小写

- 不加句号

- 不超过 50 字符

### 正文规则

- 说明做了什么、为什么

- 用 `-` 列表

- 每行不超过 72 字符

### 示例

```
chore(config): add tailwind css and postcss config
- install tailwindcss postcss autoprefixer
- add tailwind.config.ts with content paths
- add postcss.config.js
```

```
feat(agent): add teacher agent system prompt
- create prompts/agents/teacher.system.md
- define identity and behavior rules
- add JSON output schema
- add constraints: no direct answers, socratic guidance
```

```
fix(ui): resolve chat message overflow on mobile
- add max-width and word-break
- test on 375px viewport
- verify no regression on desktop
```

---

## 五、禁止行为

| 禁止 | 原因 |
|---|---|
| 一次提交所有文件 | 一看就是批量生成 |
| 用 "update" "fix" "add" 等泛化 message | 看不出做了什么 |
| force push 到 main | 破坏历史 |
| squash 历史 | 失去开发过程 |
| 跳过 pre-commit hook | 绕过代码检查 |
| 提交 .env、node_modules、dist | 违反规范 |
| 提交 API 密钥 | 安全事故 |
| 时间戳全部相同 | 不像真实开发 |

---

## 六、允许并且鼓励的"修补型"提交

真实开发会有这些痕迹：

| 场景 | 提交类型 |
|---|---|
| 发现前面写错了，修复 | `fix(scope): ...` |
| 代码能跑但结构不好，重构 | `refactor(scope): ...` |
| 补充注释或文档 | `docs(scope): ...` |
| 补测试 | `test(scope): ...` |
| 格式调整 | `style(scope): ...` |
| 性能优化 | `perf(scope): ...` |

**这些提交让历史看起来更真实。**

例如：

```
feat(ui): add chat panel component
fix(ui): resolve message scroll issue
refactor(ui): extract message list into separate component
test(ui): add chat panel unit tests
docs(ui): add component usage comments
```

---

## 七、分支策略

| 分支 | 用途 |
|---|---|
| main | 保护分支，只通过 PR 合并，保持可运行 |
| dev | 集成分支，日常合并 |
| feat/xxx | 功能分支 |
| fix/xxx | 修复分支 |
| docs/xxx | 文档分支 |

**规则：**

- 不要直接 push 到 main

- 每个功能开 PR

- 保留 PR 记录

- 不要 force push 到 main

**如果团队只有一个人：**

- 可以简化为直接在 dev 上提交

- 每个 Phase 完成后合并到 main

- 保留合并记录

---

## 八、时间戳控制

### 自然分布

| 场景 | 建议间隔 |
|---|---|
| 同一 Phase 内的提交 | 10-30 分钟 |
| 不同 Phase 之间 | 几小时到几天 |
| 修复型提交 | 立即（发现问题就改） |

### 命令

正常提交用当前时间：

```bash
git commit -m "..."
```

调整时间戳：

```bash
git commit --date="2026-09-16 10:30:00" -m "..."
```

### 原则

- 不要造假时间戳到很久以前

- 保持合理：开发周期 6 周，提交自然分布在 6 周内

- 不要全部集中在同一小时

---

## 九、每个 Phase 的验证

每个 Phase 完成后，运行：

```bash
# 查看提交数量
git log --oneline | head -50
# 查看每个提交的改动量
git log --stat --oneline | head -100
# 查看时间分布
git log --format="%h %ad %s" --date=short
```

**检查清单：**

- [ ] 提交数量是否合理（每个 Phase 至少 5 个）

- [ ] message 是否具体

- [ ] 是否有明显的批量提交痕迹

- [ ] 时间分布是否自然

- [ ] 是否有修补型提交

- [ ] 是否误提交了 .env 或密钥

---

## 十、Git 配置

### .gitignore 必须包含

```
node_modules
.env
.env.local
.env*.local
dist
.next
out
build
*.log
.DS_Store
coverage
.vscode/*
!.vscode/extensions.json
```

### .env.example 必须提供

```bash
# .env.example
SENSENOVA_API_KEY=your-sensenova-api-key
SENSENOVA_BASE_URL=https://token.sensenova.cn/v1
CLOUDBASE_ENV_ID=your-env-id
CLOUDBASE_SECRET_ID=your-secret-id
CLOUDBASE_SECRET_KEY=your-secret-key
DATABASE_URL=file:./dev.db
```

### 如果误提交密钥

1. 立即撤销：`git reset HEAD~1`

2. 删除文件：`git rm --cached .env`

3. 加入 .gitignore

4. 轮换密钥（重要！）

5. 重新提交

---

## 十一、Phase 提交点速查

各 Phase 的**完整提交点清单**见 `06-execution-plan.md`，此处只保留汇总，避免两处不同步。

| Phase | 内容 | 提交数 | 累计 |
|---|---|---|---|
| Phase 0 | 项目初始化 | 9 | 9 |
| Phase 1 | CloudBase + piagentSDK 最小闭环 | 8 | 17 |
| Phase 2 | 知识层（LLM Wiki） | 15 | 32 |
| Phase 3 | Agent 系统 | 20 | 52 |
| Phase 4 | 数据与接口 | 15 | 67 |
| Phase 5 | 前端 | 32 | 99 |
| Phase 6 | 教学系统集成 | 10 | 109 |
| Phase 7 | 打磨与提交 | 12 | 121 |
| **总计** | 6 周（省赛截止 2026-11-18） | **121** | — |

6 周 121 个提交，平均每天约 3 个提交。这是真实开发节奏。

---

## 十二、提交前检查清单

每次提交前，问自己：

- [ ] 这次提交只做了一件事吗？

- [ ] 改动文件是否超过 10 个？

- [ ] 改动行数是否超过 500？

- [ ] message 是否具体、能看出做了什么？

- [ ] 是否误提交了 .env 或密钥？

- [ ] 是否误提交了 node_modules？

**如果有一项不合格，拆成多个提交。**
