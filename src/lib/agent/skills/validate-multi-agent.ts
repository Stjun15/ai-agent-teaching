/**
 * Skill: 校验 Multi-Agent
 *
 * multi-agent 模块的动手环节点评。
 * 学生提交的是多 Agent 协作流程设计。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_MULTI_AGENT_SKILL: SkillDefinition = {
  id: "validate-multi-agent",
  label: "校验 Multi-Agent",
  content: [
    "# Skill: 校验 Multi-Agent",
    "",
    "## 触发条件",
    "",
    "学生提交 multi-agent 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "设计一个「写周报」的多 Agent 协作流程：",
    "- 需要哪几个 Agent？",
    "- 各自职责？",
    "- 输入输出怎么衔接？",
    "- 像示范代码那样写出流程。",
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查 Agent 设计：",
    "   - Agent 数量 >= 2（如收集者 + 撰写者，或收集者 + 摘要者 + 润色者）",
    '   - 每个 Agent 有明确的职责描述（不能笼统地写"处理数据"）',
    "   - 职责不重叠（数据收集和写周报不能都让同一个 Agent 干）",
    "3. 检查协作流程：",
    "   - 输入输出衔接是否清晰（Agent1 的输出 → Agent2 以此为输入）",
    "   - 流程顺序是否合理（先收集 → 再整理 → 最后产出）",
    "   - 是否有质量把控（谁检查结果？不合格怎么办？）——加分项",
    "4. 检查格式：",
    "   - 是否像示范代码那样结构化（不是一团文字）",
    "   - 是否让一个人读得懂整个流程",
    "5. 按 rubric_context 逐维度打分。",
    "6. 生成 issues 和 suggestions。",
    "7. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- Agent 数量 >= 2 且职责描述清晰",
    "- 输入输出衔接清楚（读得懂数据怎么在 Agent 之间流转）",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「Agent 数量 >= 2 且职责不重叠」且「输入输出衔接清晰」",
    "- detail：列出 Agent 数量、职责是否重叠、衔接是否清楚。",
    "",
    '示例："3 个 Agent（Collector/Summarizer/Writer），职责不重叠；衔接清晰（Collector→Summarizer→Writer）：满足条件。"',
  ].join("\n"),
};