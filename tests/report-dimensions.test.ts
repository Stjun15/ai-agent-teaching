import { describe, expect, it } from "vitest";

import { summarizeDimensions } from "@/lib/report-dimensions";

describe("点评维度聚合", () => {
  it("按维度名汇总平均分与样本数", () => {
    const summary = summarizeDimensions([
      { dimensions: [{ name: "角色定义", score: 80 }] },
      {
        dimensions: [
          { name: "角色定义", score: 90 },
          { name: "格式", score: 70 },
        ],
      },
    ]);

    expect(summary).toEqual([
      { name: "角色定义", averageScore: 85, samples: 2 },
      { name: "格式", averageScore: 70, samples: 1 },
    ]);
  });

  it("跳过空维度名与非有限分数（不把缺数据当 0 分）", () => {
    const summary = summarizeDimensions([
      { dimensions: [{ name: "  ", score: 80 }] },
      { dimensions: [{ name: "格式", score: Number.NaN }] },
      { dimensions: null },
      {},
    ]);

    expect(summary).toEqual([]);
  });

  it("同样本数按名字升序，保证渲染顺序稳定", () => {
    const summary = summarizeDimensions([
      { dimensions: [{ name: "b", score: 60 }] },
      { dimensions: [{ name: "a", score: 70 }] },
    ]);

    expect(summary.map((item) => item.name)).toEqual(["a", "b"]);
  });
});
