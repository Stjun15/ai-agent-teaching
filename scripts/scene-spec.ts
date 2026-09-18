/**
 * 可视化场景规格测试
 *
 * 守的是**「场景目录里写的那份定义是自洽的、而且真的驱动得了播放」**。
 *
 * 为什么值得单独测
 * -------------
 * 场景的步骤定义（几步、每步多久、参数初值）是纯数据，没有任何类型能拦住
 * 「时长写成 0」「步骤 id 抄重」「参数初值给成 null」这三类错误 —— 它们在
 * 界面上表现为**播放时一步闪过去**或**参数控件显示空白**，看起来都像「动画
 * 有点怪」，没人会怀疑数据。而这份数据要乘 9 份（9 个场景），手抄错的概率不低。
 *
 * 另一个更隐蔽的风险：目录与 `SCENE_IDS` 是两张表。`getSceneDefinition` 里
 * 有一道 `isSceneId` 守卫，所以「目录里写了个不存在的场景 id」会被静默忽略 ——
 * 场景写完了、界面上却没有。这里用一条断言把「静默忽略」变成红。
 *
 * 本组不测 JSX，只测 `.ts` 那两份：测试用 `node --experimental-strip-types`，
 * 它不编译 JSX。所以这里断言的是**数据**，画面的正确性靠浏览器验收。
 *
 * 运行：
 *   pnpm test:scenes
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SCENE_IDS, SCENE_LABELS, isSceneId } from "@/lib/agent/scene-ids";
import {
  SCENE_CATALOG,
  getSceneDefinition,
  listSceneDefinitions,
} from "@/scenes/scene-catalog";
import { useVisualizationStore } from "@/stores/visualization";
import type { SceneStep } from "@/scenes/scene-types";

/** 目录里已注册的场景 id（按权威顺序）。 */
const registered = listSceneDefinitions();

/** 每个场景至少要有几步：少于 3 步的「动画」讲不清任何过程。 */
const MIN_STEPS = 3;
/** 单步时长的合理区间（毫秒）。低于下限是「一闪而过」，高于上限是「在等它」。 */
const MIN_STEP_MS = 300;
const MAX_STEP_MS = 10_000;

test("目录里的场景 id 都是合法场景（不会有写完却被静默忽略的场景）", () => {
  for (const id of Object.keys(SCENE_CATALOG)) {
    assert.equal(
      isSceneId(id),
      true,
      `目录里的 ${id} 不在 SCENE_IDS 里 —— getSceneDefinition 会静默忽略它，界面上不会出现`,
    );
  }
});

test("已注册场景的步骤数够讲清一个过程", () => {
  assert.ok(registered.length > 0, "一个场景都没注册，这组用例等于没测");
  for (const scene of registered) {
    assert.ok(
      scene.steps.length >= MIN_STEPS,
      `${scene.id} 只有 ${scene.steps.length} 步`,
    );
  }
});

test("步骤 id 在场景内唯一（否则 React 列表会复用错元素）", () => {
  for (const scene of registered) {
    const ids = scene.steps.map((step) => step.id);
    assert.equal(
      new Set(ids).size,
      ids.length,
      `${scene.id} 的步骤 id 有重复：${ids.join("、")}`,
    );
  }
});

test("每步的时长在合理区间，且标题与解说都不为空", () => {
  for (const scene of registered) {
    for (const step of scene.steps) {
      assert.ok(
        step.durationMs >= MIN_STEP_MS && step.durationMs <= MAX_STEP_MS,
        `${scene.id}/${step.id} 的时长 ${step.durationMs}ms 越界`,
      );
      assert.notEqual(step.title.trim(), "", `${scene.id}/${step.id} 缺标题`);
      assert.notEqual(
        step.description.trim(),
        "",
        `${scene.id}/${step.id} 缺解说`,
      );
    }
  }
});

test("参数初值只有三种可序列化的类型", () => {
  for (const scene of registered) {
    for (const [key, value] of Object.entries(scene.defaultParams)) {
      assert.ok(
        typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean",
        `${scene.id} 的参数 ${key} 是 ${typeof value}，不能序列化`,
      );
    }
  }
});

test("场景名与顺序都取自权威表，不另抄一份", () => {
  // 顺序：listSceneDefinitions 是 SCENE_IDS 的子序列，界面上看到的顺序就是
  // `01-teaching-system.md` 表格里的顺序。
  const order = registered.map((scene) => scene.id);
  const expected = SCENE_IDS.filter((id) => order.includes(id));
  assert.deepEqual(order, expected);

  for (const scene of registered) {
    assert.equal(scene.title, SCENE_LABELS[scene.id]);
  }
});

test("查不到的场景返回 undefined，而不是抛错", () => {
  // 「某个场景没写完」不该升级成「整个模块页打不开」。
  assert.equal(getSceneDefinition(null), undefined);
  assert.equal(getSceneDefinition("scene-not-exist"), undefined);
  assert.equal(getSceneDefinition(""), undefined);
});

test("选中已交付场景：步数归零、状态暂停、参数是初值的副本", () => {
  const scene = registered[0];
  const store = useVisualizationStore;

  store.getState().selectScene(scene.id);
  const state = store.getState();
  assert.equal(state.sceneId, scene.id);
  assert.equal(state.stepIndex, 0);
  assert.equal(state.status, "paused");
  assert.deepEqual(state.params, scene.defaultParams);
  // 必须是副本：与目录共用同一个对象的话，改参数会写脏那张静态表。
  assert.notEqual(state.params, scene.defaultParams);
});

test("选中未交付场景：停在 idle、参数清空（不给能点却没反应的播放）", () => {
  const pending = SCENE_IDS.find(
    (id) => !registered.some((scene) => scene.id === id),
  );
  if (pending === undefined) return; // 9 个都交付了，这条自然不需要

  const store = useVisualizationStore;
  store.getState().selectScene(pending);
  assert.equal(store.getState().status, "idle");
  assert.deepEqual(store.getState().params, {});
});

test("推进到末尾会停在最后一步并标记完成，不越界", () => {
  const scene = registered[0];
  const store = useVisualizationStore;
  store.getState().selectScene(scene.id);

  // 多推一步，确认不会把 stepIndex 推过 steps.length。
  for (let i = 0; i < scene.steps.length + 1; i += 1) {
    store.getState().nextStep();
  }
  const state = store.getState();
  assert.equal(state.stepIndex, scene.steps.length - 1);
  assert.equal(state.status, "finished");

  // 后退要解除 finished，否则「播放」按钮停在完成态、点了没反应。
  store.getState().prevStep();
  assert.equal(store.getState().status, "paused");
});

test("重置回到第 0 步并恢复参数初值，但不重置速度", () => {
  const scene = registered[0];
  const store = useVisualizationStore;
  store.getState().selectScene(scene.id);
  store.getState().setSpeed(2);
  store.getState().setParam("__probe__", "改过的值");
  store.getState().nextStep();

  store.getState().reset();
  const state = store.getState();
  assert.equal(state.stepIndex, 0);
  assert.deepEqual(state.params, scene.defaultParams);
  // 与 selectScene 同样要求是副本：两处都是「把目录里的静态表当模板」，
  // 只补一处的话，另一处将来被人改成原地改参数就会写脏那张表。
  assert.notEqual(state.params, scene.defaultParams);
  // 速度是用户偏好，不是场景状态。
  assert.equal(state.speed, 2);
});

test("步骤定义里的字段名与播放器读的一致", () => {
  // 播放器按 `durationMs` 排定时器、按 `title` 显示标题。改字段名时若只改一边，
  // 界面上的表现是「时长变成 undefined，定时器瞬间推进」——这条把它钉住。
  for (const scene of registered) {
    for (const step of scene.steps as SceneStep[]) {
      assert.equal(typeof step.durationMs, "number");
      assert.equal(typeof step.title, "string");
      assert.equal(typeof step.description, "string");
    }
  }
});
