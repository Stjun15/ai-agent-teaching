# D 阶段：前端

## 目标

实现 Web 应用的所有页面、组件、可视化、状态管理。

## 路由

/ 首页

/onboarding 学生初始化

/learn 学习中心

/learn/[moduleId] 模块学习页

/learn/[moduleId]/[step] 模块子步骤

/playground 沙箱实验室

/report 学习报告

/profile 学生画像

/settings 设置

/project/[projectId] 项目详情

text

## 核心页面布局

### 模块学习页（三栏）

- 左：步骤导航 + 掌握度 + 学习路径缩略图

- 中：对话区 + 代码编辑区 + 可视化区

- 右：Agent 时间线 + 引用来源 + Token 计数

- 底：输入框（文本/语音/截图/发送）

## 组件树

<App> ├── <RootLayout> │ ├── <TopNav> │ └── <main> ├── <HomePage> ├── <LearnPage> │ ├── <Sidebar> │ └── <ModuleGrid> ├── <ModulePage> │ ├── <ModuleHeader> │ ├── <StepNav> │ ├── <MainArea> │ │ ├── <ChatPanel> │ │ ├── <CodeEditor> │ │ └── <VisualizationPanel> │ ├── <RightPanel> │ │ ├── <AgentTimeline> │ │ ├── <CitationPanel> │ │ └── <TokenCounter> │ └── <MasteryIndicator> ├── <PlaygroundPage> ├── <ReportPage> └── <SettingsPage> ```

9 个可视化场景

每个场景包含：

动画步骤定义

播放控制（播放/暂停/前进/后退/重置/变速）

交互（可修改参数看变化）

场景清单：

模块	场景 ID

llm-api	scene-request-response

system-prompt	scene-role-filter

agent-loop	scene-loop-weather

tool-calling	scene-tool-chain

rag	scene-retrieve-generate

llm-wiki	scene-rag-vs-wiki

multi-agent	scene-orchestration

mcp	scene-mcp-flow

ai-safety	scene-attack-defense

状态管理（5 个 Zustand Store）

Store	内容

StudentStore	学生画像、掌握度、学习路径、错题、Prompt 历史

SessionStore	会话、消息、Agent 事件、引用、流式状态

CodeStore	代码、语言、校验状态、校验结果

VisualizationStore	当前场景、步骤、播放状态、速度

SettingsStore	模型、主题、语言、语音开关

SSE 事件协议

10 种事件：token, thinking, tool_call, tool_result, citation,

ui, validation, visualization, error, done

响应式断点

断点	布局

≥1280px	三栏

1024-1279px	两栏

768-1023px	单栏 + 抽屉

<768px	移动端底部 Tab

交付物

src/app/ 所有路由页面

src/components/ 所有组件

src/stores/ 5 个 Zustand Store

src/hooks/ 自定义 hooks（useSSE, useVisualization 等）

src/scenes/ 9 个可视化场景组件

src/lib/sse.ts SSE 客户端

验收标准

所有路由可访问

所有组件渲染正常

SSE 流式渲染流畅

9 个可视化场景可播放

响应式适配正常

无 TypeScript 错误

Lighthouse 性能 ≥ 85
