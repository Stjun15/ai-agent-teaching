/**
 * Skill: 校验 LLM API
 *
 * llm-api 模块的动手环节点评。
 * 学生提交的是 messages 数组 + 注释回答。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_LLM_API_SKILL: SkillDefinition = {
  id: "validate-llm-api",
  label: "校验 LLM API",
  content: [
    "# Skill: 校验 LLM API",
    "",
    "## 触发条件",
    "",
    "学生提交 llm-api 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "学生需要写出一个完整的 messages 数组：",
    "- system：设定 AI 是\"小学数学老师，回答耐心、只用加减乘除\"",
    "- user：\"小明有 12 个苹果，给了小红 5 个，还剩几个？\"",
    "",
    "然后用注释回答：如果用户接着问\"那小红现在有几个苹果？\"，需要在 messages 里加什么？",
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查 messages 数组：",
    "   - role 是否正确（\"system\" 和 \"user\"，不是 \"sys\"）",
    "   - content 是否包含题面要求的关键信息",
    "   - 语法是否正确（JSON 格式、逗号、引号）",
    "3. 检查注释部分：",
    "   - 是否理解 AI 的\"7 秒记忆\"——不传 assistant 消息回去 AI 不知道上一轮说了什么",
    "   - 是否给出了正确的做法：push assistant 消息 + push 新 user 消息",
    "4. 如有 demo_content（示范代码），将其作为参考对照，不一样的实现但逻辑等价的不扣分。",
    "5. 按 rubric_context 逐维度打分。",
    "6. 生成 issues 和 suggestions。",
    "7. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 理解准确度维度得分 >= 该维度权重分的 60%",
    "- messages 数组语法正确（role/content 字段齐全、无语法错误）",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「理解准确度 >= 60% 权重分」且「messages 数组语法正确」",
    "- detail：列出理解准确度得分及其阈值、messages 语法是否通过。",
    "",
    '示例："理解准确度 30（权重 35%，阈值 21，满足）; messages 语法通过：两个 role 正确、content 完整。满足条件。"',
  ].join("\n"),
};