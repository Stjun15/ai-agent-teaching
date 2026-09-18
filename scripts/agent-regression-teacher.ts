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
 *
 * 为什么要收进「想象一下 / 想象你」
 * -----------------------------
 * 原先刻意不收「想象」，理由是这种词太常见、收了断言就失去意义。但真实跑
 * 出来的失败是这样的两句：
 *   「想象一下，你在做一个自动回复机器人：它读到你发的消息，想想该回什么…」
 *   「想象你要出门前查天气：先看一眼窗外（感知天气），然后想该带伞还是戴帽子…」
 * 两条都是**货真价实的情景类比**，只是句子里没有「像」——「想象」用的是
 * 「象」不是「像」，一个字都没匹配上。断言由此成了假阴性：模型答得对，测试
 * 却红。**收窄到「想象一下 / 想象你」这种必须接对象的写法**，既能认下模型
 * 实际最常用的类比开头，又不会把「想象 Agent 会怎么做」这类普通叙述放进来
 * ——下面那条纯函数用例就是在守这条边界，正反两面都断言。
 */
const ANALOGY_MARKERS = /像|好比|类似|相当于|比作|打个比方|想象一下|想象你/;

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
// 纯函数：类比标记的正反边界
// ---------------------------------------------------------------------------

test("类比标记：认得出「想象…」式情景类比（真实模型输出的原句）", () => {
  assert.ok(
    ANALOGY_MARKERS.test(
      "想象一下，你在做一个自动回复机器人：它读到你发的消息，想想该回什么。",
    ),
  );
  assert.ok(ANALOGY_MARKERS.test("想象你要出门前查天气：先看一眼窗外。"));
  assert.ok(ANALOGY_MARKERS.test("Agent Loop 好比一个不断重复的循环。"));
});

test("类比标记：纯定义式讲解不该被判成用了类比", () => {
  // 守住「收得太宽断言就失去意义」这条：没有类比标记的讲解必须落空。
  assert.equal(
    ANALOGY_MARKERS.test(
      "Agent Loop 是一个循环结构，每一轮包含思考与行动两个阶段。",
    ),
    false,
  );
  assert.equal(ANALOGY_MARKERS.test("Agent Loop 的想象空间很大。"), false);
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
