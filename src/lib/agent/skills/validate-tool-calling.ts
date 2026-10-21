/**
 * Skill: 校验 Tool Calling
 *
 * tool-calling 模块的动手环节点评。
 * 学生提交的是工具定义 + 概念回答。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_TOOL_CALLING_SKILL: SkillDefinition = {
  id: "validate-tool-calling",
  label: "校验 Tool Calling",
  content: [
    "# Skill: 校验 Tool Calling",
    "",
    "## 触发条件",
    "",
    "学生提交 tool-calling 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "两部分：",
    "",
    "1. 设计一个「查快递」的工具：名字（动词+名词）、描述（AI 靠什么判断该不该用）、参数定义。",
    "2. 回答：如果用户连续问\"查快递12345\"和\"查快递67890\"，两次调用的结果会不会一样？工具实现里要注意什么？",
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查工具定义：",
    "   - name 必须是动词+名词（如 queryExpress），不能是纯名词（如 \"express\"）",
    "   - description 必须描述了触发条件（\"当用户提到快递单号或想查包裹时调用\"），不能只写\"查快递\"",
    "   - parameters 必须有类型和 required 标注",
    "3. 检查概念回答：",
    '   - "两次调用结果不同"是否正确（不同单号 → 不同结果）',
    "   - 工具实现注意事项是否切中要害（如：不缓存结果、校验单号格式、处理查询失败）",
    "4. 按 rubric_context 逐维度打分。",
    "5. 生成 issues 和 suggestions。",
    "6. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 工具定义维度得分 >= 该维度权重分的 60%",
    "- name 必须是动词+名词",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「工具定义 >= 60% 权重分」且「name 是动词+名词」",
    "- detail：列出工具定义得分及阈值、name 是否符合规范。",
    "",
    '示例："工具定义 30（权重 40%，阈值 24，满足）; name=\'queryExpress\' 动词+名词：满足条件。"',
  ].join("\n"),
};