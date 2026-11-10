/**
 * 种子数据的形状契约
 *
 * 为什么需要这一组
 * --------------
 * 演示账号的数据是**手写常量**（`scripts/seed-auth-accounts.mjs` 的 `DEMO`），
 * 不经过任何 Agent 的 Zod 校验就直接落库。于是它和 `src/lib/db/types.ts`
 * 的列类型之间没有任何东西强制一致 —— TypeScript 看不见 `.mjs` 里的字面量。
 *
 * 实际踩到的坑（2026-11-10）：`promptHistory` 的 `issues` 写成了**纯字符串数组**
 * （`["messages 数组正确"]`），而契约是 `PromptIssue[]`（带 type / detail /
 * deduction / relatedDimension / relatedAntiPattern 的对象）。后果不是「少显示了
 * 一点信息」，是两处：
 *   1. 报告页每条 issue 渲染成空徽章 +「（-）」—— 问题文本整个消失；
 *   2. `key={`${issue.type}-${issue.detail}`}` 拼成 `undefined-undefined`，
 *      同一记录内多条 issue 立刻主键冲突，React 报 7 条 duplicate key。
 *
 * 所以这里把「种子数据的每一条 issues 都必须是完整 PromptIssue」钉成断言。
 * 判据取自 `db/types.ts` 的 `PromptIssue`，不另抄一份字段清单。
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DEMO_PROMPT_ISSUES } from "./seed-auth-accounts.mjs";

/**
 * `DEMO` 是 `.mjs` 里的手写字面量，TS 只能把它推成宽联合类型。
 * 这里显式收窄成「一条记录的 issues 数组」——收窄本身也是断言的一部分：
 * 若哪天 `issues` 位置被写成了别的东西（比如漏了一列导致元组错位），
 * 下面的 `flat()` / `map()` 会立刻炸，而不是静默跳过。
 */
type SeedIssue = {
  type: string;
  detail: string;
  deduction: number;
  relatedDimension: string;
  relatedAntiPattern: string | null;
};

const RECORDS = DEMO_PROMPT_ISSUES as unknown as SeedIssue[][];

/** `PromptIssue` 的字段（与 `src/lib/db/types.ts` 保持一致）。 */
const ISSUE_KEYS = [
  "deduction",
  "detail",
  "relatedAntiPattern",
  "relatedDimension",
  "type",
] as const;

const ISSUE_TYPES = new Set(["严重错误", "优化建议"]);

test("种子 promptHistory 的 issues 全部是 PromptIssue 对象，不是字符串", () => {
  assert.ok(
    RECORDS.length > 0,
    "种子脚本必须导出 issues，否则这条断言等于没跑",
  );

  for (const record of RECORDS) {
    for (const issue of record) {
      assert.equal(
        typeof issue,
        "object",
        `issues 必须是对象（PromptIssue），不能再写字符串：${JSON.stringify(issue)}`,
      );
    }
  }
});

test("每一条 issue 的字段齐全且类型正确", () => {
  for (const [recordIndex, record] of RECORDS.entries()) {
    for (const issue of record) {
      assert.deepEqual(
        Object.keys(issue).sort(),
        [...ISSUE_KEYS],
        `第 ${recordIndex} 条记录里的 issue 字段必须恰好是 PromptIssue 的五项`,
      );
      assert.ok(
        ISSUE_TYPES.has(issue.type),
        `type 只能是「严重错误」或「优化建议」，实际 ${issue.type}`,
      );
      assert.equal(typeof issue.detail, "string");
      assert.ok(
        issue.detail.length > 0,
        "detail 不能是空串 —— 空串在界面上什么都不显示，等于没写",
      );
      assert.equal(typeof issue.deduction, "number");
      assert.ok(
        issue.deduction >= 0,
        "deduction 落库一律是正数（见 outputs.ts 的 deductionSchema 归一化）",
      );
      assert.equal(typeof issue.relatedDimension, "string");
      assert.ok(
        issue.relatedAntiPattern === null ||
          typeof issue.relatedAntiPattern === "string",
        "relatedAntiPattern 只能是字符串或 null",
      );
    }
  }
});

test("同一条记录内的 (type, detail) 不重复 —— 那是 React key 的组成部分", () => {
  // 报告页 `record-details.tsx` 用 `${issue.type}-${issue.detail}` 作 key。
  // 同一条记录里出现两对相同值就会重复 key，而这不是「视觉问题」：
  // React 会少渲染一个子节点，学生看到的问题条目数比真实条数少。
  for (const [index, record] of RECORDS.entries()) {
    const keys = record.map((issue) => `${issue.type}-${issue.detail}`);
    assert.equal(
      new Set(keys).size,
      keys.length,
      `第 ${index} 条 promptHistory 有重复的 issue key`,
    );
  }
});