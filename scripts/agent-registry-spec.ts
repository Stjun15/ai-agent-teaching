/**
 * Agent + Skill 注册表全量校验
 *
 * 覆盖：
 *   - SKILLS 8 项齐全、id 自洽、content 非空
 *   - AGENTS 4 项齐全、label 非空
 *   - 铁律「Agent 权限由代码控制」—— defaultSkill 必须在 allowedSkills 中
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { SKILLS, getSkill } from "@/lib/agent/skills";
import { AGENTS, getAgent } from "@/lib/agent/prompts";
import { SKILL_IDS, AGENT_IDS, type SkillId, type AgentId } from "@/lib/agent/types";

// -- Skill 注册表 ----------------------------------------------------------

test("SKILLS 包含全部 8 项 SKILL_IDS", () => {
  for (const id of SKILL_IDS) {
    assert.ok(id in SKILLS, `缺 Skill: ${id}`);
  }
  assert.equal(Object.keys(SKILLS).length, SKILL_IDS.length, "不应有多余 Skill");
});

test("每个 Skill 的 id 与键名一致", () => {
  for (const [key, skill] of Object.entries(SKILLS)) {
    assert.equal(skill.id, key as SkillId, `${key}.id 不一致`);
  }
});

test("每个 Skill 的 content 非空", () => {
  for (const [key, skill] of Object.entries(SKILLS)) {
    assert.ok(skill.content.length > 0, `${key}.content 为空`);
  }
});

test("每个 Skill 的 label 非空", () => {
  for (const [key, skill] of Object.entries(SKILLS)) {
    assert.ok(skill.label.length > 0, `${key}.label 为空`);
  }
});

test("explain-concept 包含讲解策略矩阵关键词", () => {
  const { content } = SKILLS["explain-concept"];
  assert.ok(content.includes("掌握度"), "缺 掌握度");
  assert.ok(content.includes("类比"), "缺 类比");
  assert.ok(content.includes("触发"), "缺 触发");
});

test("validate-code 包含评分与通过条件", () => {
  const { content } = SKILLS["validate-code"];
  assert.ok(content.includes("维度"), "缺 评分维度");
  assert.ok(content.includes("严重错误"), "缺 严重错误级别");
});

test("validate-prompt 包含角色/工具/输出/边界/简洁性维度", () => {
  const { content } = SKILLS["validate-prompt"];
  assert.ok(content.includes("角色定义"), "缺 角色定义");
  assert.ok(content.includes("边界条件"), "缺 边界条件");
  assert.ok(content.includes("简洁性"), "缺 简洁性");
});

test("validate-tool 包含名称/描述/参数维度", () => {
  const { content } = SKILLS["validate-tool"];
  assert.ok(content.includes("名称"), "缺 名称");
  assert.ok(content.includes("参数"), "缺 参数");
});

test("validate-qa 包含评分维度与 rubric_context 机制", () => {
  const { content } = SKILLS["validate-qa"];
  assert.ok(content.includes("文本回答"), "缺 文本回答触发");
  assert.ok(content.includes("理解准确度"), "缺 理解准确度");
  assert.ok(content.includes("rubric_context"), "缺 rubric_context 引用");
  assert.ok(content.includes("module_context"), "缺 module_context 引用");
});

test("generate-question 包含出题策略与难度递进", () => {
  const { content } = SKILLS["generate-question"];
  assert.ok(content.includes("难度递进"), "缺 难度递进");
  assert.ok(content.includes("选择题"), "缺 题型");
  assert.ok(content.includes("mastery"), "缺 mastery 参数说明");
});

test("answer-question 包含四种问题类型策略", () => {
  const { content } = SKILLS["answer-question"];
  assert.ok(content.includes("概念不清"), "缺 概念不清分支");
  assert.ok(content.includes("代码报错"), "缺 代码报错分支");
  assert.ok(content.includes("跑偏"), "缺 跑偏分支");
  assert.ok(content.includes("苏格拉底"), "缺 苏格拉底式引导");
});

test("trigger-visualization 包含场景映射表", () => {
  const { content } = SKILLS["trigger-visualization"];
  assert.ok(content.includes("场景 ID"), "缺 场景映射");
  assert.ok(content.includes("scene-"), "缺 scene- 前缀场景");
});

test("getSkill 正常取值", () => {
  const sk = getSkill("explain-concept");
  assert.equal(sk.id, "explain-concept");
  assert.ok(sk.content.length > 0);
});

test("getSkill 不存在的 id 返回 undefined（运行时兜底）", () => {
  const sk = getSkill("nonexistent" as SkillId);
  assert.equal(sk, undefined);
});

// -- Agent 注册表 -----------------------------------------------------------

test("AGENTS 包含全部 4 项 AGENT_IDS", () => {
  for (const id of AGENT_IDS) {
    assert.ok(id in AGENTS, `缺 Agent: ${id}`);
  }
  assert.equal(Object.keys(AGENTS).length, AGENT_IDS.length, "不应有多余 Agent");
});

test("每个 Agent 的 id / label / systemPrompt 非空", () => {
  for (const def of Object.values(AGENTS)) {
    assert.ok(def.id.length > 0, `${def.id}: id 为空`);
    assert.ok(def.label.length > 0, `${def.id}: label 为空`);
    assert.ok(def.systemPrompt.length > 0, `${def.id}: systemPrompt 为空`);
  }
});

test("铁律：每个 Agent 的 defaultSkill 在 allowedSkills 中", () => {
  for (const def of Object.values(AGENTS)) {
    assert.ok(
      (def.allowedSkills as readonly string[]).includes(def.defaultSkill),
      `${def.id}: defaultSkill "${def.defaultSkill}" 不在 allowedSkills 中`,
    );
  }
});

test("每个 Agent 的 allowedSkills 非空", () => {
  for (const def of Object.values(AGENTS)) {
    assert.ok(
      def.allowedSkills.length > 0,
      `${def.id}: allowedSkills 为空`,
    );
  }
});

test("teacher Agent 允许讲解+可视化+答疑", () => {
  const teacher = AGENTS.teacher;
  assert.ok((teacher.allowedSkills as readonly string[]).includes("explain-concept"));
  assert.ok((teacher.allowedSkills as readonly string[]).includes("trigger-visualization"));
  assert.ok((teacher.allowedSkills as readonly string[]).includes("answer-question"));
  assert.equal(teacher.defaultSkill, "explain-concept");
});

test("reviewer Agent 允许四种校验+可视化", () => {
  const reviewer = AGENTS.reviewer;
  assert.ok((reviewer.allowedSkills as readonly string[]).includes("validate-prompt"));
  assert.ok((reviewer.allowedSkills as readonly string[]).includes("validate-tool"));
  assert.ok((reviewer.allowedSkills as readonly string[]).includes("validate-code"));
  assert.ok((reviewer.allowedSkills as readonly string[]).includes("validate-qa"));
  assert.ok((reviewer.allowedSkills as readonly string[]).includes("trigger-visualization"));
});

test("examiner Agent 只允许出题", () => {
  const examiner = AGENTS.examiner;
  assert.equal(examiner.allowedSkills.length, 1);
  assert.ok((examiner.allowedSkills as readonly string[]).includes("generate-question"));
});

test("assistant Agent 允许答疑+讲解", () => {
  const assistant = AGENTS.assistant;
  assert.ok((assistant.allowedSkills as readonly string[]).includes("answer-question"));
  assert.ok((assistant.allowedSkills as readonly string[]).includes("explain-concept"));
});

test("getAgent 正常取值", () => {
  const ag = getAgent("teacher");
  assert.equal(ag.id, "teacher");
  assert.equal(ag.label, "讲解 Agent");
});