/**
 * selectStepMessages —— 分屏过滤的「开场」判定
 *
 * 钉什么
 * -----
 * 「该步的讲稿」= 这一步对话的**第一条**消息（播种或静默流式，先于任何
 * 学生输入）。学生先开口时，第一条助手消息是对学生的回复，skip / truncate
 * 都不得把它当讲稿处理 —— 2026-10-07 审计 C1：observe / imitate 页从不
 * 播种开场（observe 示范 2026-09-25 起改 wiki 直读），skip 模式曾把导师
 * 对提问的回复整条吞掉，学生看到「已读不回」且无报错，刷新后 store 里
 * 明明有这条消息。
 *
 * 不调模型、不碰数据库。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { selectStepMessages, splitLecture } from "@/lib/lecture-split";

interface Msg {
  role: string;
  content: string;
  step: string;
}

function msg(role: string, content: string, step: string): Msg {
  return { role, content, step };
}

const OPENER = "开场讲稿。\n\n## 一、为什么需要\n讲稿正文。";
const REPLY = "这是导师对学生提问的回复。";

test("skip：学生先开口时，导师回复必须原样保留（C1 回归）", () => {
  const out = selectStepMessages<Msg>(
    [
      msg("student", "两个冒号各在给什么贴标签？", "observe"),
      msg("assistant", REPLY, "observe"),
    ],
    "observe",
    "skip",
  );
  assert.equal(out.length, 2);
  assert.equal(out[1].content, REPLY);
});

test("skip：助手先开口（播种讲稿）时，开场被跳过、后续回复保留", () => {
  const out = selectStepMessages<Msg>(
    [
      msg("assistant", OPENER, "observe"),
      msg("student", "问一个问题", "observe"),
      msg("assistant", REPLY, "observe"),
    ],
    "observe",
    "skip",
  );
  assert.equal(out.length, 2);
  assert.ok(out.every((m) => m.content !== OPENER));
  assert.equal(out[1].content, REPLY);
});

test("truncate：学生先开口时，回复不被切分（回复里没有任务节）", () => {
  const out = selectStepMessages<Msg>(
    [
      msg("student", "变量是什么？", "explain"),
      msg("assistant", REPLY, "explain"),
    ],
    "explain",
    "truncate",
  );
  assert.equal(out.length, 2);
  assert.equal(out[1].content, REPLY);
});

test("truncate：助手先开口时，讲稿截到任务节之前、回复原样", () => {
  const withTask = OPENER + "\n\n### 五、现在轮到你\n写一个温度判断函数。";
  const out = selectStepMessages<Msg>(
    [
      msg("assistant", withTask, "explain"),
      msg("student", "问一个问题", "explain"),
      msg("assistant", REPLY, "explain"),
    ],
    "explain",
    "truncate",
  );
  assert.equal(out.length, 3);
  assert.ok(out[0].content.includes("为什么需要"));
  assert.ok(!out[0].content.includes("现在轮到你"));
  assert.equal(out[2].content, REPLY);
});

test("splitLecture：无任务节时 assignment 为 null（任务卡据此不渲染）", () => {
  const result = splitLecture(OPENER);
  assert.equal(result.assignment, null);
  assert.ok(result.teaching.includes("为什么需要"));
});

test("splitLecture：有任务节时按标记切开", () => {
  const result = splitLecture(OPENER + "\n\n### 五、现在轮到你\n任务题面。");
  assert.ok(result.teaching.includes("讲稿正文"));
  assert.ok(result.assignment?.includes("任务题面"));
});
