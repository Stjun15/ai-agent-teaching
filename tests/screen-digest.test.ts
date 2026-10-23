import { describe, expect, it } from "vitest";

import {
  DIGEST_LIMITS,
  buildScreenDigest,
  keepRecentTranscript,
  truncateTail,
} from "@/lib/agent/student/screen-digest";

const LONG = "甲".repeat(DIGEST_LIMITS.lecture + 200);

describe("截断", () => {
  it("短文本原样返回（不引入省略号）", () => {
    expect(truncateTail("  短内容  ", 100)).toBe("短内容");
  });

  it("超长文本保留尾部并显式标注前略", () => {
    const result = truncateTail(LONG, 100);
    expect(result.startsWith("…（前略）")).toBe(true);
    expect(result.length).toBeLessThan(LONG.length);
    // 尾部最后一个字必须还在：截断的是「前面的部分」。
    expect(result.endsWith("甲")).toBe(true);
  });
});

describe("历史裁剪", () => {
  it("从最新往回保留整条，超出额度即停止", () => {
    const transcript = [
      { speaker: "mentor" as const, content: "很早的一条" },
      { speaker: "student" as const, content: "中间一条" },
      { speaker: "mentor" as const, content: "最新一条" },
    ];
    const kept = keepRecentTranscript(transcript, 10);
    // 最新一条无条件保留，即使它自己也超额度。
    expect(kept.at(-1)?.content).toBe("最新一条");
    expect(kept.length).toBeLessThan(transcript.length);
  });

  it("额度够时全部保留并维持原顺序", () => {
    const transcript = [
      { speaker: "student" as const, content: "第一句" },
      { speaker: "mentor" as const, content: "第二句" },
    ];
    expect(keepRecentTranscript(transcript, 1000)).toEqual(transcript);
  });
});

describe("屏幕快照", () => {
  it("包含页面、步骤中文名与对话双方标签", () => {
    const digest = buildScreenDigest({
      moduleId: "llm-api",
      moduleName: "LLM API 入门",
      step: "explain",
      lectureText: "这里是讲稿正文。",
      transcript: [
        { speaker: "student", content: "我听不懂" },
        { speaker: "mentor", content: "别急，我们拆开看" },
      ],
    });

    expect(digest).toContain("/learn/llm-api · LLM API 入门");
    expect(digest).toContain("当前步骤：概念讲解（explain）");
    expect(digest).toContain("这里是讲稿正文。");
    expect(digest).toContain("我：我听不懂");
    expect(digest).toContain("导师：别急，我们拆开看");
  });

  it("没有对话时明确写「还没有任何对话」，而不是留白", () => {
    const digest = buildScreenDigest({
      moduleId: "llm-api",
      moduleName: "LLM API 入门",
      step: "imitate",
      lectureText: "",
      transcript: [],
    });
    expect(digest).toContain("（还没有任何对话）");
    expect(digest).toContain("这一页暂时没有教学内容");
    expect(digest).toContain("动手模仿（imitate）");
  });

  it("讲稿超过额度时被截断 —— 不让模拟学生一次读到全部答案", () => {
    const digest = buildScreenDigest({
      moduleId: "llm-api",
      moduleName: "LLM API 入门",
      step: "explain",
      lectureText: LONG,
      transcript: [],
    });
    expect(digest).toContain("前略");
    expect(digest.length).toBeLessThan(LONG.length);
  });

  it("快照里不出现 DOM 术语（模拟学生不该知道选择器）", () => {
    const digest = buildScreenDigest({
      moduleId: "llm-api",
      moduleName: "LLM API 入门",
      step: "observe",
      lectureText: "示范",
      transcript: [],
    });
    for (const word of ["selector", "data-slot", "DOM"]) {
      expect(digest).not.toContain(word);
    }
  });
});
