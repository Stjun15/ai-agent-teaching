/**
 * Skill: 校验 RAG
 *
 * rag 模块的动手环节点评。
 * 学生提交的是知识库代码 + 推理回答。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_RAG_SKILL: SkillDefinition = {
  id: "validate-rag",
  label: "校验 RAG",
  content: [
    "# Skill: 校验 RAG",
    "",
    "## 触发条件",
    "",
    "学生提交 rag 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "两部分：",
    "",
    "1. 写出宠物店知识库：grooming.md（美容预约）、adopt.md（领养流程）、price.md（价目表），仿照示范代码的格式。",
    '2. 回答：用户问"领养需要几天？"时 buildContext() 会拼出什么内容？',
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查知识库：",
    "   - 格式是否与示范代码一致（{ doc, source } 或 { filename, content } 结构）",
    "   - 三篇文档内容是否正确（美容=预约提前1天/迟到取消，领养=填表→面谈→试养3天→签约，价格=洗澡80/剪毛150/全套200）",
    "   - 语法是否正确",
    "3. 检查 buildContext 预测：",
    '   - 是否判断 adopt.md 与"领养"最相关（匹配正确）',
    "   - 是否描述了拼出的格式（来源 + 内容）",
    '   - 是否指出了"试养3天"这个关键信息',
    '   - 答案是"大概3天左右"还是更精确的推理？——模糊的"3天"不算错，但精确到"试养3天，整个流程加上填表面谈可能更长"更好',
    "4. 如有 demo_content（示范代码），将其作为参考对照。",
    "5. 按 rubric_context 逐维度打分。",
    "6. 生成 issues 和 suggestions。",
    "7. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 理解准确度维度得分 >= 该维度权重分的 60%",
    "- 三篇文档全部覆盖",
    "- buildContext 匹配到 adopt.md（关键词匹配正确）",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「理解准确度 >= 60% 权重分」且「三篇文档全部覆盖」且「匹配到 adopt.md」",
    "- detail：列出理解得分及阈值、文档覆盖数、匹配是否正确。",
    "",
    '示例："理解准确度 30（权重 35%，阈值 21，满足）; 三篇文档全部覆盖; buildContext 正确匹配到 adopt.md：满足条件。"',
  ].join("\n"),
};