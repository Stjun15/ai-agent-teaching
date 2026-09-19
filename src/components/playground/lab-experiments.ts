/**
 * 沙箱实验室的实验清单 —— **端点的请求形状只在这里写一次**
 *
 * 沙箱要回答的问题是「这四个 Agent 到底输出什么」。学生改参数、点运行，
 * 看到的就是服务端按 Schema 校验过的真实结构化输出。
 * 字段契约见 `lab-types.ts`。
 *
 * 为什么是「清单 + build 函数」而不是一张纯配置表
 * --------------------------------------------
 * 5 个端点的请求体并不统一：`validate` 是 `content` + `taskType`，
 * `answer` 的模块字段叫 `currentModule`，`wiki/query` 还要把 `topK`
 * 嵌进 `options` 里。用一张「字段名 + 类型」的纯配置表表达这些差异，
 * 需要发明一套迷你 DSL（路径、包装、重命名…），而它本身又成了需要维护的
 * 一层。这里直接把「填好的值 → 请求体」写成函数：差异是显式的、可读的，
 * 而且与 `schemas/api.ts` 的字段名一眼可比。
 *
 * 本文件不 import React，也不碰网络 —— 纯数据 + 纯函数，因此可以在
 * Node 里直接断言（见 `scripts/playground-spec.ts`）。
 */

import type {
  LabExperiment,
  LabField,
} from "@/components/playground/lab-types";

/** 任务类型三档，与 `ValidateSchema.taskType` 同值域。 */
const TASK_TYPES = [
  { value: "prompt", label: "Prompt 写法" },
  { value: "tool", label: "工具描述" },
  { value: "code", label: "代码实现" },
] as const;

/** 讲解模式，与 `ExplainSchema.mode` 同值域 —— 补讲就是「我更糊涂了」那条路。 */
const EXPLAIN_MODES = [
  { value: "normal", label: "正常讲解" },
  { value: "remedial", label: "换一种讲法（补讲）" },
] as const;

/** 四个 Agent 里三个都要「在哪个模块下干活」，字段形状一致，只差键名。 */
function moduleField(key: string, label: string): LabField {
  return {
    key,
    label,
    kind: "select",
    source: "modules",
    help: "模块 id 就是概念 id；后置模块有前置掌握度门槛，未达标会返回 403。",
  };
}

export const LAB_EXPERIMENTS: readonly LabExperiment[] = [
  {
    id: "explain",
    label: "讲解",
    endpoint: "/api/agent/explain",
    agentLabel: "导师 Agent",
    description:
      "拿一个模块让导师讲解。零基础学生会得到类比式讲解；选「补讲」会把同样的模块换一种讲法再讲一遍。",
    fields: [
      moduleField("moduleId", "模块"),
      { key: "mode", label: "模式", kind: "select", options: EXPLAIN_MODES },
    ],
    needsSession: true,
    build: (values, context) => ({
      studentId: context.studentId,
      sessionId: context.sessionId,
      moduleId: values.moduleId,
      mode: values.mode ?? "normal",
    }),
  },
  {
    id: "validate",
    label: "校验点评",
    endpoint: "/api/agent/validate",
    agentLabel: "点评 Agent",
    description:
      "把你写的东西交给点评 Agent 按 rubric 打分。先故意写一句模糊的 Prompt，看扣分扣在哪里 —— 被扣分比被夸更有用。",
    fields: [
      moduleField("moduleId", "模块"),
      {
        key: "taskType",
        label: "任务类型",
        kind: "select",
        options: TASK_TYPES,
        help: "类型决定用哪套评分标准；选错类型会得到完全不相关的建议。",
      },
      {
        key: "content",
        label: "待点评内容",
        kind: "textarea",
        placeholder: "例如：帮我写个东西",
        help: "写什么就评什么，不做改写。",
      },
    ],
    needsSession: true,
    build: (values, context) => ({
      studentId: context.studentId,
      sessionId: context.sessionId,
      moduleId: values.moduleId,
      taskType: values.taskType ?? "prompt",
      content: values.content,
      // 沙箱试玩不进学生档案（prompt_history / errors / mastery）——
      // 否则玩票的 15 分会砸掉掌握度、污染报告页平均分。
      sandbox: true,
    }),
  },
  {
    id: "generate-question",
    label: "出题",
    endpoint: "/api/agent/generate-question",
    agentLabel: "出题 Agent",
    description:
      "让出题 Agent 出变式练习：换一个条件、换一个场景。这就是教学流程的第 5 步。",
    fields: [
      moduleField("moduleId", "模块"),
      {
        key: "count",
        label: "题数",
        kind: "number",
        min: 1,
        max: 10,
        placeholder: "3",
      },
      {
        key: "difficulty",
        label: "难度",
        kind: "number",
        min: 1,
        max: 5,
        placeholder: "留空则由服务端决定",
      },
    ],
    needsSession: false,
    build: (values, context) => ({
      studentId: context.studentId,
      moduleId: values.moduleId,
      count: values.count ?? 3,
      // 留空即**不发送**该字段，让服务端的可选语义生效（见 `coerceValue`）。
      ...(values.difficulty === undefined
        ? {}
        : { difficulty: values.difficulty }),
    }),
  },
  {
    id: "answer",
    label: "答疑",
    endpoint: "/api/agent/answer",
    agentLabel: "答疑 Agent",
    description:
      "问一个和学习有关的问题。它带着当前模块的上下文回答，所以同一个问题在不同模块下答案不同。",
    fields: [
      moduleField("currentModule", "当前模块"),
      {
        key: "question",
        label: "问题",
        kind: "textarea",
        placeholder: "例如：AI 为什么记不住上一轮说的话？",
      },
    ],
    needsSession: true,
    build: (values, context) => ({
      studentId: context.studentId,
      sessionId: context.sessionId,
      currentModule: values.currentModule,
      question: values.question,
    }),
  },
  {
    id: "wiki-query",
    label: "知识库检索",
    endpoint: "/api/wiki/query",
    agentLabel: "LLM Wiki",
    description:
      "直接查 LLM Wiki，看检索命中的是哪个页面。在理解 RAG 之前，先看一次真实的检索结果。",
    fields: [
      {
        key: "query",
        label: "查询词",
        kind: "text",
        placeholder: "例如：上下文窗口",
      },
      {
        key: "topK",
        label: "返回条数",
        kind: "number",
        min: 1,
        max: 20,
        placeholder: "3",
      },
    ],
    needsSession: false,
    usesModel: false,
    build: (values) => ({
      query: values.query,
      options: { topK: values.topK ?? 3 },
    }),
  },
];

/** 按 id 取实验；找不到返回 undefined（调用方决定兜底展示）。 */
export function findExperiment(id: string): LabExperiment | undefined {
  return LAB_EXPERIMENTS.find((experiment) => experiment.id === id);
}
