# 接手文档 — 2026-09-29

## 一、本轮修改概要

基于 `dev` 分支，围绕三个目标做了优化：**渲染速度**、**字体自适应**、**交互体验**。

## 二、修改文件清单（29 files, +808/-424）

### 1. 渲染性能优化

| 文件                                        | 改动                                                                                            |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `next.config.mjs`                           | 新增 `experimental.optimizePackageImports: ["lucide-react", "motion", "zustand"]`               |
| `src/scenes/scene-stage.tsx`                | 13 个场景组件全部改为 `next/dynamic(() => import(...), { ssr: false, loading: SceneSkeleton })` |
| `src/components/report/report-sections.tsx` | TrendChart 改为 `next/dynamic` + loading 骨架                                                   |

### 2. 字体自适应（概念讲解 + 观察示范）

核心思路：放弃固定字号（text-sm/text-base），统一用 CSS `clamp()` 响应式缩放。

| 文件                                          | 元素            | 最终字号                           |
| --------------------------------------------- | --------------- | ---------------------------------- |
| `src/components/chat/message-item.tsx`        | 聊天气泡正文    | `clamp(11px, 1.6vw, 16px)`         |
| `src/components/chat/markdown-view.tsx`       | 标题 h1~h6      | `clamp(11~13px, 1.2~2vw, 13~18px)` |
| `src/components/chat/markdown-view.tsx`       | 段落 `<p>`      | `clamp(11px, 1.6vw, 16px)`         |
| `src/components/chat/markdown-view.tsx`       | 代码块 `<pre>`  | `clamp(11px, 1.8vw, 16px)`         |
| `src/components/learn/explain-cold-start.tsx` | prose 容器 p/li | `clamp(11px, 1.6vw, 16px)`         |

### 3. 交互与布局改进

| 文件                                          | 改动                                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------- |
| `src/components/learn/observe-panel.tsx`      | 观察示范代码块添加**全屏**按钮，ESC 退出，淡入淡出动画                           |
| `src/components/learn/module-workspace.tsx`   | 对话卡片高度 `h-[560px]` → `h-[calc(100vh-12rem)] min-h-[400px]`，缩放不溢       |
| `src/components/chat/markdown-view.tsx`       | 代码块去掉 `overflow-hidden`，加 `whitespace-pre-wrap break-words`，长行自动换行 |
| `src/components/chat/visualization-panel.tsx` | 可视化面板全屏功能（之前做的）                                                   |
| `src/scenes/scene-controls.tsx`               | ParamText 新增 `readOnly` 属性                                                   |
| `src/scenes/scene-request-response.tsx`       | system 消息框设为只读                                                            |
| `src/components/layout/top-nav.tsx`           | 导航滑动指示器                                                                   |
| `src/components/learn/step-nav.tsx`           | 步骤导航视觉效果优化                                                             |
| `src/components/ui/skeleton-card.tsx`         | shimmer 流光骨架屏                                                               |
| `src/app/page.tsx`                            | Home 首屏视觉效果优化                                                            |

### 4. 已回滚/未动的内容

- **可视化场景字体**：之前放大到 50px 后已恢复 `text-sm`，本轮未修改
- **Monaco 编辑器**：已有动态加载，未修改

## 三、页面与文件映射（快速定位）

| 页面                   | 核心文件                                                                                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 首页                   | `src/app/page.tsx`                                                                                                                                                  |
| 概念讲解（explain 步） | `module-workspace.tsx` → `explain-cold-start.tsx` / `explain-fullscreen.tsx` → `lecture-launcher.tsx` → `chat-panel.tsx` → `message-item.tsx` → `markdown-view.tsx` |
| 观察示范（observe 步） | `module-workspace.tsx` → `observe-panel.tsx` → `markdown-view.tsx`                                                                                                  |
| 场景可视化             | `scene-stage.tsx` → 各个 `scene-*.tsx`                                                                                                                              |
| 报告页                 | `report-sections.tsx` → `trend-chart.tsx`                                                                                                                           |
| 导航                   | `top-nav.tsx` / `step-nav.tsx`                                                                                                                                      |

## 四、渲染链路（概念讲解为例）

```
module-workspace.tsx (currentStepId === "explain")
  → ExplainFullscreen (全屏包裹)
    → Card (对话卡片)
      → ExplainColdStart (无缓存时的预览卡片)
      → ChatPanel (对话区)
        → MessageItem (米色消息气泡)
          → MarkdownView (Markdown → HTML)
```

## 五、Git 状态

- 分支：`dev`
- 最后 commit：`e769de3` — "优化页面渲染性能与字体自适应"
- 状态：已本地提交，**未 push**（网络问题）

## 六、待办 / 可继续的方向

- Bundle Analyzer：`ANALYZE=true next build` 分析哪些模块体积大
- 图片优化：用 `next/image` 替换原生 `<img>`
- React.memo：对频繁重渲染的组件加 memo
- 推送远程：网络恢复后 `git push`
