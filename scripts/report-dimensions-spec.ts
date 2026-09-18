/**
 * 评分维度汇总的规格测试
 *
 * 守的是一条边界：**报告页上出现的每个维度分，都必须来自至少一次真实点评**。
 *
 * 为什么这条值得单独测
 * ------------------
 * 汇总的输入是 `prompt_history.dimensions`（JSON 列），而这一列在库里**确实
 * 存在空数组的行**（早期数据、以及点评未产出维度就写入的记录）。聚合时若把
 * 空数组当「0 分样本」，页面上就会冒出「某维度 0 分」，而学生其实从没被评过
 * 这一项 —— 与全项目「没数据不显示 0 分」的纪律冲突，且这种错在界面上
 * 看不出来（它长得跟真的低分一模一样）。
 *
 * 所以这里钉四件事：
 *   1. 空数组 / 缺 score / score 非有限数 / 空名字 —— 一律不进样本；
 *   2. 平均分按**实际样本数**除，不是按点评条数除；
 *   3. 排序稳定（样本数降序、同数按名字），刷新页面维度条不会跳位；
 *   4. 库里那条真实点评（5 个维度、含 0 分与 70 分）能被如实汇总。
 *
 * 运行：
 *   node --experimental-strip-types --import ./scripts/ts-loader.mjs scripts/report-dimensions-spec.ts
 */

import test from "node:test";
import assert from "node:assert/strict";

import { summarizeDimensions } from "@/lib/report-dimensions";

/** 造一条点评记录。`dimensions` 缺省为空数组 —— 库里真实存在这种行。 */
function prompt(dimensions: unknown) {
  return { dimensions } as { dimensions: { name: string; score: number }[] };
}

test("空数组的点评不产生任何维度", () => {
  assert.deepEqual(summarizeDimensions([prompt([]), prompt([])]), []);
  assert.deepEqual(summarizeDimensions([]), []);
});

test("脏样本不进统计：缺 score / 非有限数 / 空名字", () => {
  const result = summarizeDimensions([
    prompt([
      { name: "角色定义", score: 80 },
      { name: "输出格式", score: Number.NaN },
      { name: "   ", score: 50 },
      // @ts-expect-error 故意构造：模型漏给 score 时库里就是这样的行
      { name: "边界条件" },
      { name: "工具描述", score: Number.POSITIVE_INFINITY },
    ]),
  ]);

  assert.deepEqual(result, [
    { name: "角色定义", averageScore: 80, samples: 1 },
  ]);
});

test("平均分按实际样本数除，不是按点评条数除", () => {
  const result = summarizeDimensions([
    prompt([{ name: "角色定义", score: 100 }]),
    prompt([{ name: "角色定义", score: 60 }]),
    // 这条点评没有「角色定义」维度，不该把它算成 0 分样本
    prompt([{ name: "简洁性", score: 40 }]),
  ]);

  assert.equal(result.find((d) => d.name === "角色定义")?.averageScore, 80);
  assert.equal(result.find((d) => d.name === "角色定义")?.samples, 2);
});

test("排序稳定：样本数降序，同数按名字", () => {
  const result = summarizeDimensions([
    prompt([
      { name: "边界条件", score: 10 },
      { name: "角色定义", score: 10 },
    ]),
    prompt([{ name: "边界条件", score: 10 }]),
  ]);

  assert.deepEqual(
    result.map((d) => d.name),
    ["边界条件", "角色定义"],
  );
});

test("真实点评的五个维度被如实汇总（含 0 分维度）", () => {
  const real = [
    prompt([
      { name: "角色定义", score: 0 },
      { name: "工具描述", score: 0 },
      { name: "输出格式", score: 0 },
      { name: "边界条件", score: 0 },
      { name: "简洁性", score: 70 },
    ]),
  ];

  const result = summarizeDimensions(real);
  assert.equal(result.length, 5);
  // 0 分是真实评分结果，必须保留 —— 跳过 0 分会让「这一项很差」变成「这一项没评」
  assert.equal(result.find((d) => d.name === "角色定义")?.averageScore, 0);
  assert.equal(result.find((d) => d.name === "简洁性")?.averageScore, 70);
});
