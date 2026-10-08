# 部署指南

## 零、先给结论

三句话，先说清楚这个项目**不能**怎么做：

1. **不能部署成静态站。** 所有接口都跑在 Node 运行时（`export const runtime = "nodejs"`），
   依赖 `node:sqlite` 这个 Node 专有模块，还有 SSE 流式响应 —— `output: "export"`
   那条路直接堵死。
2. **数据库现在是本地文件，而且不入库。** `.gitignore` 排除了 `*.db`，
   `git ls-files dev.db` 为空 —— 部署包里**没有库文件**；建表还要手动跑
   `pnpm db:migrate`，没有任何构建钩子会替你做这件事。
3. **所以要先选部署形态，再谈命令。** Serverless 平台上数据库这条腿是断的
   （见路径 A 的失败点），常驻主机上则全部功能可用（路径 B）。

本文给出两条路径的完整步骤、一个部署后自检清单，以及**本次没有验证的部分**
（标了「未验证」的地方请当成待实测项，不要当结论）。

## 一、三条硬约束

| 约束                             | 来源                                               | 怎么验证                                                                |
| -------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| Node ≥ 22.5                      | `package.json` 的 `engines`；`node:sqlite` 需要它  | 打 `/api/health`，看返回体里的 `node` 字段                              |
| 必须有 Node 运行时（非 Edge）    | 21 个路由里凡涉及数据的都写了 `runtime = "nodejs"` | 同上；平台若不支持会直接 500                                            |
| 数据库要有一块**可写且持久**的盘 | `DATABASE_URL=file:./dev.db` + 无自动迁移          | `/api/health` 的 `checks.database`（`ok` / `businessTables` / `error`） |

第三条是全部问题的根源。`/api/health` 这个端点从设计上就是为这一刻准备的：
它**不会创建**库文件，只会如实报告「库文件不存在，请先执行 `pnpm db:migrate`」，
并在数据库不可用时返回 503。

## 二、路径 A：EdgeOne Makers（原 EdgeOne Pages）

平台已支持 Next.js 13.5+ 的 App Router、SSR、Route Handlers 与流式响应，
预装 Node 22.11.0 —— 硬约束的第一条能满足。**注意产品名已从「Pages」改为「Makers」，
CLI 命令仍是 `edgeone pages`。**

### A1 控制台部署（推荐先走这条）

1. 把仓库推到 GitHub 或 Gitee（**这一步还没做**，见第五节）。
2. 控制台 → 创建项目 → Connect to Git → 授权并选中仓库。
3. 构建设置：框架预设 `Next`；构建命令 `pnpm build`；输出目录 `.next`；
   Node.js 版本选 `22.11.0`。
4. 环境变量（项目设置 → 环境变量）：至少填 `ARK_API_KEY`。
   变量对所有环境生效；**改完只影响新的部署**，不会追溯已有部署。
5. 点部署，等待构建完成，得到 `xxx.edgeone.dev` 域名。
6. 打 `/api/health` 核验 —— 见第四节。

### A2 `edgeone.json`

仓库根目录的 `edgeone.json` 会覆盖控制台里的同名设置，让配置随代码走：

```json
{
  "installCommand": "pnpm install",
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "nodeVersion": "22.11.0"
}
```

`nodeVersion` 必须显式钉住：本项目 `engines` 要求 ≥ 22.5，而平台的默认版本不保证落在
22.x。填了平台未预装的版本会导致部署失败 —— 22.11.0 在预装列表内。

### A3 CLI 与 CI

```bash
# 绑定本地目录与线上项目
npx edgeone pages link

# 构建产物直接部署
npx edgeone pages deploy .next -n my-project -t $EDGEONE_API_TOKEN -e production
```

GitHub Actions 方式：在仓库 Secrets 里加 `EDGEONE_API_TOKEN`，
然后在 `main` 分支推送时执行 `setup-node`（22.11.0）→ `pnpm install` → `pnpm build`
→ `npx edgeone pages deploy .next -n <项目名> -t ${{ secrets.EDGEONE_API_TOKEN }}`。

### A4 这条路会停在哪一步（说清楚，省得白试）

先分清「构建期读」与「运行期读」—— 知识层（`llm-wiki/*.md`）两种情况都有：

| 路径                                                            | Serverless 上会怎样 | 为什么                                                                                                                                      |
| --------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页、`/learn`、`/learn/[moduleId]`、`/learn/[moduleId]/[step]` | **能看**            | 两个动态段都写了 `generateStaticParams`，构建期已预渲染，Markdown 内容烘进了 HTML                                                           |
| 对话里的引用检索、`/api/wiki/query`                             | **读不到内容**      | 走的是运行期 `{cwd}/llm-wiki` + `node:fs`，而 `wiki/paths.ts` 里的这些路径显式退出了打包追踪（`turbopackIgnore`），`.md` 大概率不进部署产物 |
| 任何读库的接口                                                  | **失败**            | 部署包里没有 `dev.db`，平台也不会替你跑迁移                                                                                                 |
| 任何写库的接口                                                  | **失败**            | 即使补进产物也没用 —— Serverless 文件系统是临时的，实例间不共享，冷启动即重置                                                               |

引用检索读不到时的表现是**优雅降级**而不是崩：`retrieveCitations` 失败返回空数组，
对话照常，只是「先看到本节参考了哪几页」这个卖点会消失。

所以路径 A 要真正可用，前置是一件**代码工作**而不是配置工作：把数据层从
`node:sqlite` 换成托管数据库，并让知识层不再依赖运行期文件系统（搬进库或对象存储 ——
`wiki/paths.ts` 的注释已经预留了这个改动范围）。`.env.example` 也预留了
`DATABASE_URL=postgresql://...` 这一行。另外平台侧的托管 KV **只在 Edge Functions
可用，Node Functions 不支持**，别指望用它替数据库。

## 三、路径 B：常驻 Node 主机（功能完整）

任意能跑 Node 22 的容器或云主机，一块持久盘即可：

```bash
pnpm install
pnpm db:migrate                  # 建表：这一步没有自动化，必须显式跑
pnpm build
PORT=3000 DATABASE_URL=file:/data/app.db ARK_API_KEY=... pnpm start
```

要点：

- `DATABASE_URL` 指到**持久卷**（上例是 `/data/app.db`），不要用相对路径 ——
  进程的工作目录换了，库就换了一份空的。
- 库文件要用 WAL 模式（代码里已设 `journal_mode = WAL`），卷上会有
  `-wal` / `-shm` 伴生文件，备份时要一起带。
- 反向代理后面要让 `x-forwarded-for` 传进来，否则 `/api/chat` 的限流会把所有
  请求算进同一个桶（该端点没有身份，只能按 IP 计数）。
- `pnpm build` 在本机需要前缀 `CODEBUDDY_SAFE_DELETE_ENABLED=0`
  （本机 safe-delete 垫片的删除预算会被构建清理撞爆），**平台侧不需要**，
  那是本机环境的问题，别写进 CI。

## 四、部署后自检清单

按顺序打，任一步不符合预期就停在那里查，不用往下走：

```bash
# 1. 存活 + Node 版本 + 数据库 + 密钥配置，一次全拿到
curl -s https://<域名>/api/health | node -e "
  let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
    const h=JSON.parse(s);
    console.log('status:',h.status,'| node:',h.node,'| uptime:',h.uptimeSeconds+'s');
    console.log('database:',JSON.stringify(h.checks.database));
    console.log('ark key configured:',h.checks.config.arkApiKeyConfigured);
  })"
```

| 看什么                              | 期望                             | 不符合说明什么                                                  |
| ----------------------------------- | -------------------------------- | --------------------------------------------------------------- |
| `node`                              | `v22.5` 以上                     | 平台的 Node 版本没钉住，`node:sqlite` 会直接不可用              |
| `checks.database.ok`                | `true`，且 `businessTables ≥ 15` | 库文件不存在或漏跑迁移；`error` 字段会写明是哪种                |
| `checks.config.arkApiKeyConfigured` | `true`                           | 环境变量没配上，涉及模型的接口会失败                            |
| HTTP 状态码                         | 200                              | 503 表示数据库不可用（密钥缺失**不**降状态码，只标 `degraded`） |

再核四条不碰模型的路：

```bash
# 预渲染的模块页：期望 200（内容烘在 HTML 里，不依赖运行期文件系统）
curl -s -o /dev/null -w "%{http_code}\n" https://<域名>/learn/llm-api

# 运行期读知识层的接口：这条是「Markdown 有没有进部署产物」的判据。
# 它是 POST 且需要身份 —— 不带身份会先返回 401，看不到知识层的真实情况
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<域名>/api/wiki/query \
  -H 'content-type: application/json' -H 'x-student-id: <学生 UUID>' \
  -d '{"query":"Agent Loop"}'
# 期望 200；若是 500，说明 llm-wiki/ 没进产物（见 A4）

# 接入层存活：期望 401 缺身份，而不是 500
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<域名>/api/agent/explain \
  -d '{}' -H 'content-type: application/json'

# 请求体校验在先：期望 400（这条只证明路由活着；限流要连打 31 次才看得出来）
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://<域名>/api/chat \
  -d '{}' -H 'content-type: application/json'
```

限流要单独验一次（**不会花钱**，请求体故意非法即可）：连打 31 次
`/api/chat` 的同一命令，第 31 次应变成 429 并带 `Retry-After`。

最后一步才验证模型链路（会花钱、需要密钥）：带 `x-student-id` 打一次
`/api/session/[id]/message`，看是否收到 SSE 事件流。

## 五、本次没有做、也没有验证的（诚实清单）

- **没有真的部署。** 本文只交付步骤与配置；仓库已于 2026-09-19 推送到
  GitHub（私有），部署动作本身仍待执行。
- **`node:sqlite` 在 Serverless 运行时上能否读写，未验证。** 验证方法就是上面那条
  `/api/health` —— 它会直接告诉你答案。我没有账号可试，所以不写「应该可以」。
- **托管数据库的驱动没有实现**：换 PostgreSQL 是代码工作，不是改一行环境变量。
- ~~仓库还没有远端~~（2026-09-19 已解决）：origin 已指向 GitHub 私有仓库，
  main / dev / 全部标签均已推送核验。
- **`edgeone.json` 未经过一次真实构建**：配置项来自官方文档，`nodeVersion` 取值
  在预装列表内，但没跑通过。
