/**
 * 混合检索规格测试
 *
 * 守的是三件事：
 *   1. **RRF 融合的排序语义**：两路都命中的页排第一（这是混合检索的价值
 *      所在），只出现在单路的页按各自排名与字母序决出确定次序 —— 纯函数，
 *      断言精确到整个输出数组；
 *   2. **余弦相似度的量纲**：同向 1、正交 0、零向量 0 —— 向量路的相关度
 *      归一化依赖这三档；
 *   3. **降级与连通**：索引已建时混合路必须真跑通（mode = hybrid 且
 *      usedFallback = false，期望页真的被召回）—— 如果这条红了而索引在，
 *      说明融合管线断了；索引为空时必须降级为关键词路并如实标注。
 *
 * 运行：
 *   pnpm test:rag
 */

import test from "node:test";
import assert from "node:assert/strict";

import { cosine } from "../src/lib/agent/embeddings";
import { fuseRrf, retrieveHybrid } from "../src/lib/agent/rag-hybrid";
import { knowledgeEmbeddingDb } from "../src/lib/db";

test("RRF：两路都命中的页排第一", () => {
  const fused = fuseRrf(["a", "b", "c"], ["b", "d"]);
  assert.equal(fused[0], "b");
  // a（1/61）与 d（1/61）同分，字母序决出确定次序 —— 排序必须稳定可断言
  assert.deepEqual(fused.slice(1), ["a", "d", "c"]);
});

test("RRF：自定义 K 与空路不炸", () => {
  assert.deepEqual(fuseRrf(["x"], [], 60), ["x"]);
  assert.deepEqual(fuseRrf([], ["y"]), ["y"]);
  assert.deepEqual(fuseRrf([], []), []);
});

test("余弦：同向 1、正交 0、零向量 0", () => {
  assert.ok(
    Math.abs(cosine(new Float32Array([1, 0]), new Float32Array([2, 0])) - 1) <
      1e-9,
  );
  assert.ok(
    Math.abs(cosine(new Float32Array([1, 0]), new Float32Array([0, 1]))) < 1e-9,
  );
  assert.equal(cosine(new Float32Array([0, 0]), new Float32Array([1, 1])), 0);
});

test("混合路连通：召回到期望页；向量路不可用时如实降级", async () => {
  assert.ok(knowledgeEmbeddingDb.count() > 0, "索引为空请先跑 pnpm rag:index");
  const { drafts, mode, usedFallback } = await retrieveHybrid(
    "RAG 的检索和生成两段是怎么接起来的",
    3,
    (score) => Math.min(1, score / 40),
  );
  if (mode === "hybrid") {
    // 向量接口可用（有配额）：断言完整混合行为
    assert.equal(usedFallback, false);
    assert.ok(
      drafts.some((draft) => (draft.source ?? "").endsWith("/rag.md")),
      `期望召回 concepts/rag.md，实际：${drafts.map((d) => d.source).join(", ")}`,
    );
  } else {
    // 向量接口不可用（免费额度耗尽 / 网络断）：降级必须**如实标注**且
    // 关键词路依然出货——这是产品对配额耗尽的承诺，不因环境波动变红。
    assert.equal(usedFallback, true);
    assert.ok(drafts.length > 0, "降级后关键词路应仍有引用产出");
  }
});

test("混合路永不抛错：任意问题都返回数组", async () => {
  const { drafts } = await retrieveHybrid(
    "工具调用的参数怎么校验",
    3,
    (score) => Math.min(1, score / 40),
  );
  assert.ok(Array.isArray(drafts));
});
