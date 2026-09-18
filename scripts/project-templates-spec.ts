/**
 * 项目模板规格测试
 *
 * 守的是「`llm-wiki/projects/` 下的模板页是齐的、字段是自洽的、而且真的能被
 * 路由读出来」—— 也就是 Phase 6 那个 404 占位被真实实现之后，闭环没破。
 *
 * 为什么值得单独测
 * -------------
 * 模板是知识层内容，从 wiki 页现读。这类「文件即数据」最容易出的错是：
 * 页建了但 frontmatter 字段名拼错（difficulty 写成 dificulty）、某页缺
 * `module_id` 导致实践步骤接不上、或者 id 与 `index.md` 对不上。这些在界面上
 * 表现为「模板页打开是空的」「实践步骤跳不过去」，很难一眼看出。
 *
 * 这里用一组断言把它们钉死：数量、id 集合、字段完整性、与 `concepts/` 的关联。
 * 不测 JSX（同 scene-spec 的约定）—— 画面正确性靠浏览器验收。
 *
 * 运行：
 *   pnpm test:projects
 */

import test from "node:test";
import assert from "node:assert/strict";

import { loadModules } from "@/lib/modules";
import {
  findProjectTemplate,
  loadProjectTemplates,
} from "@/lib/project-templates";

/** `index.md` 项目模板分节声明的 9 个 id（按约定顺序，用于核对「齐不齐」）。 */
const EXPECTED_IDS = [
  "01-chatbot",
  "02-persona-bot",
  "03-weather-agent",
  "04-multi-tool-agent",
  "05-rag-agent",
  "06-wiki-agent",
  "07-multi-agent-system",
  "08-mcp-agent",
  "09-safe-agent",
];

test("9 个模板全部加载，且 id 集合与 index.md 完全一致", async () => {
  const templates = await loadProjectTemplates();
  assert.equal(
    templates.length,
    EXPECTED_IDS.length,
    `模板数量应为 ${EXPECTED_IDS.length}，实际 ${templates.length}`,
  );
  const ids = templates.map((template) => template.id);
  assert.deepEqual(
    ids,
    EXPECTED_IDS,
    `模板 id 集合应逐字等于 index.md 声明，实际：\n  ${ids.join("\n  ")}`,
  );
});

test("每个模板字段完整且难度在合法区间", async () => {
  const templates = await loadProjectTemplates();
  for (const template of templates) {
    assert.ok(template.name, `${template.id} 缺 name`);
    assert.ok(
      template.difficulty >= 1 && template.difficulty <= 5,
      `${template.id} 的 difficulty ${template.difficulty} 不在 1~5`,
    );
    assert.ok(template.estimatedTime, `${template.id} 缺 estimated_time`);
    assert.ok(
      Array.isArray(template.tags) && template.tags.length > 0,
      `${template.id} 的 tags 应为非空数组`,
    );
    assert.ok(template.summary, `${template.id} 的概述（summary）为空`);
    assert.ok(
      template.body.includes("## 检查清单"),
      `${template.id} 正文缺「## 检查清单」小节`,
    );
  }
});

test("每个模板都关联到真实存在的教学模块", async () => {
  const modules = await loadModules();
  const moduleIds = new Set(modules.map((module) => module.id));
  const templates = await loadProjectTemplates();
  for (const template of templates) {
    assert.ok(template.moduleId, `${template.id} 缺 module_id`);
    assert.ok(
      moduleIds.has(template.moduleId as string),
      `${template.id} 关联的模块 ${template.moduleId} 不在 concepts/ 里`,
    );
  }
});

test("findProjectTemplate：合法 id 命中、非法 id 返回 undefined", async () => {
  const hit = await findProjectTemplate("05-rag-agent");
  assert.ok(hit, "05-rag-agent 应命中");
  assert.equal(hit?.name, "RAG Agent", "命中的模板 name 应为 RAG Agent");

  const miss = await findProjectTemplate("99-not-exist");
  assert.equal(miss, undefined, "非法 id 应返回 undefined（路由据此返回 404）");
});
