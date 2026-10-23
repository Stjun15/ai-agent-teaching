import { describe, expect, it } from "vitest";

import {
  INTERNAL_WORDS,
  filterThinkingDelta,
  flushThinking,
} from "@/lib/agent/thinking-filter";

/** 按增量喂入整段文本，返回真正发给学生的完整串。 */
function stream(text: string, chunkSize: number): string {
  let carry = "";
  let out = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    const { emit, carry: next } = filterThinkingDelta(
      text.slice(i, i + chunkSize),
      carry,
    );
    out += emit;
    carry = next;
  }
  return out + flushThinking(carry);
}

describe("thinking-filter：内部口径不能在 thinking 流里出现", () => {
  it("单个 delta 里的内部词直接被替换成中性说法", () => {
    const { emit, carry } = filterThinkingDelta("我得先过门禁再讲", "");
    const full = emit + flushThinking(carry);
    expect(full).not.toContain("门禁");
    expect(full).toContain("教学要求");
  });

  it("跨块拆词（「铁」+「律」）不会漏 —— 这是首版最大的坑", () => {
    let carry = "";
    let out = "";
    for (const delta of ["这里涉及铁", "律，我要避开", "它。"]) {
      const step = filterThinkingDelta(delta, carry);
      out += step.emit;
      carry = step.carry;
    }
    out += flushThinking(carry);

    expect(out).not.toContain("铁律");
    expect(out).toContain("教学要求");
  });

  it("对每一个可能的切分点，输出都不含任何内部词", () => {
    const sample =
      "学生掌握度不够，门禁没过，前置模块也没学，编排层和评分标准都不能说，" +
      "系统内部的事更不能提，根据铁律要绕开。";
    for (let size = 1; size <= 6; size += 1) {
      const out = stream(sample, size);
      for (const word of INTERNAL_WORDS) {
        expect(out, `粒度=${size} 时泄漏了「${word}」`).not.toContain(word);
      }
    }
  });

  it("正常文本不因过滤而丢字（只替换内部词，不吞普通内容）", () => {
    const out = stream("先把变量想成贴了名字的盒子，然后一步一步赋值。", 3);
    expect(out).toContain("贴了名字的盒子");
    expect(out).toContain("一步一步赋值");
  });

  it("空 delta 与空 carry 返回空串，不制造内容", () => {
    expect(filterThinkingDelta("", "")).toEqual({ emit: "", carry: "" });
    expect(flushThinking("")).toBe("");
  });

  it("短于最长词长的残留一律不吐，等后续补齐再判", () => {
    const first = filterThinkingDelta("掌握", "");
    expect(first.emit).toBe("");
    expect(first.carry).toBe("掌握");

    const second = filterThinkingDelta("度这件事", first.carry);
    const full = second.emit + flushThinking(second.carry);
    expect(full).not.toContain("掌握度");
    expect(full).toContain("教学要求");
  });

  it("收尾时残留里的内部词也会被替换，不会原样吐出", () => {
    expect(flushThinking("关于门禁")).not.toContain("门禁");
  });
});
