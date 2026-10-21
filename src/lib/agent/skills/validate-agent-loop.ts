/**
 * Skill: 校验 Agent Loop
 *
 * agent-loop 模块的动手环节点评。
 * 学生提交的是纯文本回答：类比解释 + 后果分析。
 * 维度来自 rubric_context；本 Skill 提供该道题专属的执行步骤和通过条件。
 */

import type { SkillDefinition } from "../types";

export const VALIDATE_AGENT_LOOP_SKILL: SkillDefinition = {
  id: "validate-agent-loop",
  label: "校验 Agent Loop",
  content: [
    "# Skill: 校验 Agent Loop",
    "",
    "## 触发条件",
    "",
    "学生提交 agent-loop 模块的动手作业。",
    "",
    "## 这道题要做什么",
    "",
    "两部分：",
    "",
    "1. 用「做菜」的例子解释 Agent Loop 的四步（Think → Act → Observe → Answer）。",
    "2. 回答：如果 Agent 调了工具但不去观察返回结果，会发生什么？举一个具体例子。",
    "",
    "## 执行步骤",
    "",
    "1. 阅读 rubric_context（评分标准的完整原文）。维度、权重、扣分细则均以此为准。",
    "2. 检查做菜比喻：",
    "   - Think：看菜谱决定下一步（对应\"决定下一步做什么\"）",
    "   - Act：放盐尝一口（对应\"调用工具\"）",
    "   - Observe：尝了发现太咸（对应\"读取工具返回结果\"）",
    "   - 四步是否都覆盖到了？（Answer 步可隐含在\"调整后继续\"中）",
    "3. 检查类比质量：",
    "   - 做饭的每一步是否对应 Agent Loop 的每一步？",
    "   - 不是硬套——Think 不是\"想放盐\"，而是\"尝过之后决定下一步\"",
    "4. 检查\"不观察后果\"：",
    "   - 是否举了具体例子？（不能只说\"会出错\"）",
    "   - 例子是否体现了\"信息在手里但没用\"的本质？",
    "5. 按 rubric_context 逐维度打分。",
    "6. 生成 issues 和 suggestions。",
    "7. 计算 total_score，判定 is_correct。",
    "",
    "## 通过条件（本模块专用）",
    "",
    "- total_score >= 75",
    "- 理解准确度维度得分 >= 该维度权重分的 60%",
    "- 四步全部覆盖（Think/Act/Observe 三步必须有，Answer 可隐含）",
    '- "不观察后果"有具体例子',
    "",
    "## skill_condition_check",
    "",
    "请显式判定：",
    "",
    "- met：是否满足「理解准确度 >= 60% 权重分」且「四步全部覆盖」且「有具体例子」",
    "- detail：列出理解得分及阈值、四步覆盖状态、例子是否具体。",
    "",
    '示例："理解准确度 35（权重 40%，阈值 24，满足）; 四步全覆盖（Think→Act→Observe→Answer 均解释）; 例子具体（查天气工具返回暴雨但 Agent 说晴天）：满足条件。"',
  ].join("\n"),
};