/**
 * Skill: 校验 MCP
 *
 * mcp 模块的动手环节点评。
 * 学生提交的是 MCP Server 工具列表 + 错误处理回答。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_MCP_SKILL: SkillDefinition = {
  id: "validate-mcp",
  label: "校验 MCP",
  content: [
    "# Skill: 校验 MCP",
    "",
    "## 触发条件",
    "",
    "学生提交 mcp 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "两部分：",
    "",
    "1. 设计一个「本地文件管理」的 MCP Server：列出至少 3 个工具，每个写清 name、description、parameters。",
    '2. 回答：如果 Agent 调用 readFile 返回了"文件不存在"的错误，Agent 应该怎么处理？（联系 Agent Loop 的 Observe 步骤来答）',
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查 MCP Server 工具设计：",
    "   - 工具数量 >= 3（至少要覆盖读、写、列出三种操作）",
    "   - 每个工具的 name 是否动词+名词",
    "   - 每个工具的 description 是否写了触发条件（Agent 什么时候该调用它）",
    "   - 每个工具的 parameters 是否有 type、是否标注了 required",
    "   - 工具粒度是否合理（读文件、写文件、列出目录——各司其职）",
    "3. 检查错误处理回答：",
    "   - 是否联系了 Agent Loop 的 Observe 步骤",
    '   - 是否描述了正确路径：Observe 到 "File not found" → Think（路径错了还是没创建？）→ 先 listFiles 确认文件是否存在 → 再决定重试或创建',
    "   - 是否体现了\"观察→思考→再行动\"的闭环",
    "4. 按 rubric_context 逐维度打分。",
    "5. 生成 issues 和 suggestions。",
    "6. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 工具设计维度得分 >= 该维度权重分的 60%",
    "- 至少 3 个工具",
    "- 错误处理回答了 Observe 步骤（联系上了 Agent Loop）",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「工具设计 >= 60% 权重分」且「>= 3 个工具」且「错误处理联系了 Observe」",
    "- detail：列出工具设计得分及阈值、工具数量、Observe 是否被提及。",
    "",
    '示例："工具设计 30（权重 40%，阈值 24，满足）; 3 个工具（listFiles/readFile/writeFile）; 错误处理正确联系了 Observe 步骤：满足条件。"',
  ].join("\n"),
};