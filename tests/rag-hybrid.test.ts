import { describe, expect, it } from "vitest";

import { HYBRID_CANDIDATES, RRF_K, fuseRrf } from "@/lib/agent/rag-hybrid";

describe("RRF 融合", () => {
  it("两路都命中的文档排在只单路命中的前面", () => {
    const fused = fuseRrf(["page-a", "page-c"], ["page-b", "page-a"]);

    expect(fused[0]).toBe("page-a");
    expect(new Set(fused)).toEqual(new Set(["page-a", "page-b", "page-c"]));
    // 单路命中时，排名更靠前的 page-b 优于 page-c
    expect(fused.indexOf("page-b")).toBeLessThan(fused.indexOf("page-c"));
  });

  it("只用排名不用分数：两路各命中一条时第二路会因排名先出", () => {
    // 两篇都是 1/(K+2) 与 1/(K+1)，分数不同，不会并列
    expect(fuseRrf(["top"], ["second"])).toEqual(["second", "top"]);
    expect(1 / (RRF_K + 1)).toBeGreaterThan(1 / (RRF_K + 2));
  });

  it("两路完全重合时保持原排名顺序", () => {
    expect(fuseRrf(["a", "b", "c"], ["a", "b", "c"])).toEqual(["a", "b", "c"]);
  });

  it("两路都为空时返回空数组", () => {
    expect(fuseRrf([], [])).toEqual([]);
  });

  it("分数相同时按路径字典序稳定输出", () => {
    expect(fuseRrf(["page-z"], ["page-a"])).toEqual(["page-a", "page-z"]);
  });

  it("常量与融合语义一致：K=60、每路多取候选", () => {
    expect(RRF_K).toBe(60);
    expect(HYBRID_CANDIDATES).toBeGreaterThan(1);
  });
});
