import { describe, expect, it } from "vitest";

import {
  arbitrateDualTask,
  getAssignmentFromMessages,
  hasTaskHeading,
  selectStepMessages,
  splitLecture,
} from "@/lib/lecture-split";

const LECTURE = [
  "## 一、开场",
  "这一讲我们聊聊安全边界。",
  "",
  "## 五、现在轮到你",
  "把这个校验函数补完。",
].join("\n");

describe("讲稿拆分", () => {
  it("按任务标题切成讲解与作业两段", () => {
    const split = splitLecture(LECTURE);
    expect(split.teaching).toContain("聊聊安全边界");
    expect(split.teaching).not.toContain("现在轮到你");
    expect(split.assignment).toContain("现在轮到你");
    expect(split.assignment).toContain("补完");
  });

  it("无任务节时整篇都是讲解部分", () => {
    const split = splitLecture("## 一、开场\n只有概念。");
    expect(split.assignment).toBeNull();
    expect(split.teaching).toContain("只有概念");
  });

  it("识别多种等价的任务节措辞", () => {
    for (const heading of [
      "### 动手任务：补完函数",
      "## 轮到你了",
      "#### 你的任务",
      "## 自己试试看",
    ]) {
      expect(hasTaskHeading(heading)).toBe(true);
    }
    expect(hasTaskHeading("## 一、开场")).toBe(false);
  });
});

describe("按步骤过滤消息", () => {
  const messages = [
    { role: "assistant", content: LECTURE, step: "explain" },
    { role: "student", content: "为什么？", step: "explain" },
    { role: "assistant", content: "因为……", step: "explain" },
    { role: "assistant", content: "示范代码", step: "observe" },
  ];

  it("full 模式原样返回该步消息", () => {
    expect(selectStepMessages(messages, "explain", "full")).toHaveLength(3);
  });

  it("truncate 模式只截首条讲稿，学生问答保持完整", () => {
    const result = selectStepMessages(messages, "explain", "truncate");
    expect(result).toHaveLength(3);
    expect(result[0].content).not.toContain("现在轮到你");
    expect(result[2].content).toBe("因为……");
  });

  it("skip 模式只吞掉首条讲稿，不会误吞导师回复", () => {
    const studentFirst = [
      { role: "student", content: "先问一句", step: "observe" },
      { role: "assistant", content: "回答", step: "observe" },
    ];
    // 首条不是助手消息 → 没有可吞的讲稿
    expect(selectStepMessages(studentFirst, "observe", "skip")).toHaveLength(2);
    // 首条是讲稿 → 只少这一条
    expect(selectStepMessages(messages, "explain", "skip")).toHaveLength(2);
  });
});

describe("任务卡取稿与双任务仲裁", () => {
  it("从讲解步的讲稿里取作业节", () => {
    const messages = [{ role: "assistant", content: LECTURE, step: "explain" }];
    expect(getAssignmentFromMessages(messages, "explain")).toContain("补完");
  });

  it("没有讲稿时返回 null", () => {
    expect(getAssignmentFromMessages([], "explain")).toBeNull();
  });

  it("已有缓存任务时在实时任务节前插入仲裁说明", () => {
    const content = "先讲个概念。\n\n## 现在轮到你\n做这个。";
    const arbitrated = arbitrateDualTask(content, true);
    expect(arbitrated).toContain("请以上方「现在轮到你」任务卡里的任务为准");
    expect(arbitrated.indexOf("任务卡里的任务为准")).toBeLessThan(
      arbitrated.indexOf("做这个"),
    );
  });

  it("没有缓存任务或正文无任务节时不改写", () => {
    const content = "## 现在轮到你\n做这个。";
    expect(arbitrateDualTask(content, false)).toBe(content);
    expect(arbitrateDualTask("没有任务节", true)).toBe("没有任务节");
  });
});
