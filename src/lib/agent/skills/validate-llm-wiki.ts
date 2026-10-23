/**
 * Skill: 校验 LLM Wiki
 *
 * llm-wiki 模块的动手环节点评。
 * 学生提交的是 wiki.ingest() 调用 + query 行为描述。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_LLM_WIKI_SKILL: SkillDefinition = {
  id: "validate-llm-wiki",
  label: "校验 LLM Wiki",
  content: [
    "# Skill: 校验 LLM Wiki",
    "",
    "## 触发条件",
    "",
    "学生提交 llm-wiki 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "两部分：",
    "",
    "1. 写一条 wiki.ingest() 调用，把《考勤政策.pdf》编译进 Wiki：source / target / schema 三个参数。",
    '2. 描述 wiki.query("加班怎么算调休？") 的行为——会读哪个文件？为什么能快速定位？',
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查 wiki.ingest() 调用：",
    '   - source：是否正确指定了原始文件"考勤政策.pdf"',
    "   - target：是否正确指定了编译后的条目名",
    '   - schema：是否提供了结构化模板（至少包含"打卡规则/请假流程/加班与调休"等字段）',
    "3. 检查 query 行为描述：",
    "   - 是否说明了会读取编译后的条目（不是原始 PDF）",
    "   - 是否解释了为什么快：编译阶段已建立索引/结构，查询时直接 key-lookup，不需要全文扫描",
    '   - 是否对比了与 RAG 的区别（RAG 是"每次现查"，Wiki 是"编译后用"）——加分项，不是必须',
    "4. 如有 demo_content（示范代码），将其作为参考对照。",
    "5. 按 rubric_context 逐维度打分。",
    "6. 生成 issues 和 suggestions。",
    "7. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 理解准确度维度得分 >= 该维度权重分的 60%",
    "- source/target/schema 三个参数完整且正确",
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「理解准确度 >= 60% 权重分」且「三参数完整正确」",
    "- detail：列出理解得分及阈值、三个参数各自是否正确。",
    "",
    '示例："理解准确度 30（权重 35%，阈值 21，满足）; source/target/schema 三参数全部正确：满足条件。"',
  ].join("\n"),
};