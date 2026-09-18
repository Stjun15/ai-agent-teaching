/**
 * 讲解 Agent 回归测试
 *
 * 用例来源：`agent-prompts/references/agent-prompts-lib.md`「六、回归测试用例」
 * 中「teacher uses analogy for beginner」一条，另加一条场景 ID 的性质测试。
 *
 * 与 reviewer 那组一样，纯函数用例与真实模型用例混编：
 * 前者守住规则（不花钱、秒级），后者守住提示词效果（花钱、慢，但只有真跑
 * 才能发现提示词退化 —— 这才是「回归」）。
 *
 * 运行：
 *   pnpm test:agent:teacher
 */

import assert from "node:assert/strict";
import test from "node:test";

import { isSceneId, SCENE_IDS } from "@/lib/agent/scene-ids";
import { SCENE_ID_MESSAGE } from "@/lib/agent/outputs";
import { runAgent } from "@/lib/agent/runtime";

/**
 * 「用了类比」的语言标记。
 *
 * 不写成 `/像/` 一个字：模型也可能用「好比」「类似于」「相当于」「就像」。
 * 反过来也不该收得太宽（比如把「想象」也算上），否则断言失去意义。
 */
const ANALOGY_MARKERS = /像|好比|类似|相当于|比作|打个比方/;

// ---------------------------------------------------------------------------
// 纯函数：场景 ID 守卫
// ---------------------------------------------------------------------------

test("isSceneId：已注册的场景返回 true", () => {
  assert.equal(isSceneId("scene-loop-weather"), true);
});

test("isSceneId：未注册的场景返回 false（不能让前端静默空白）", () => {
  assert.equal(isSceneId("scene-tool-chains"), false);
  assert.equal(isSceneId("scene-"), false);
  assert.equal(isSceneId(""), false);
});

test("场景 ID 校验消息：列全 9 个合法值（否则重试只能瞎猜）", () => {
  // 模型编造场景 ID 时，这条消息会被 runtime 原文回喂重试。
  // 少列一个，模型就少一个可能被选中的正确答案。
  for (const id of SCENE_IDS) {
    assert.ok(
      SCENE_ID_MESSAGE.includes(id),
      `校验消息缺少合法场景 ${id}：${SCENE_ID_MESSAGE}`,
    );
  }
  assert.equal(
    SCENE_IDS.length,
    9,
    "场景总数应为 9（见 01-teaching-system.md）",
  );
});

// ---------------------------------------------------------------------------
// 真实模型：零基础学生应当得到类比式讲解
// ---------------------------------------------------------------------------

test("讲解 Agent：对零基础学生应使用类比", async () => {
  const result = await runAgent({
    agent: "teacher",
    skill: "explain-concept",
    input: {
      module_id: "agent-loop",
      concept_id: "agent-loop",
      mastery: 0,
    },
  });

  assert.equal(result.ok, true, `运行失败：${result.error ?? "未知原因"}`);
  assert.equal(result.usedFallback, false, "不应动用兜底");

  const teaching = result.data;
  assert.ok(teaching, "应有结构化输出");

  // 性质 1：零基础（mastery 0）必须用类比。这是讲解策略矩阵的第一档。
  assert.ok(
    ANALOGY_MARKERS.test(teaching.content),
    `掌握度 0 的讲解应当出现类比，实际内容：${teaching.content.slice(0, 120)}…`,
  );

  // 性质 2：概念 ID 要原样回传。编排层靠它决定下一步读哪个页面。
  assert.equal(teaching.concept_id, "agent-loop");

  // 性质 3：说了要可视化，就必须给一个**已注册**的场景 ID。
  // 这条是本轮新加的护栏：场景 ID 在三处各存一份，漂移会让前端静默空白。
  if (teaching.type === "visualize") {
    assert.ok(
      teaching.visualize_scene !== undefined &&
        isSceneId(teaching.visualize_scene),
      `type=visualize 时必须给出已注册的场景 ID，实际：${teaching.visualize_scene}`,
    );
  }
});
