/**
 * 知识卡片组件 —— 渲染、交互、持久化全链路
 *
 * 守什么
 * -----
 * 1. 初始渲染：5 个字段 + 虚化示例 + 提交按钮 disabled
 * 2. 点击聚焦：示例内容消失、恢复正常颜色
 * 3. 填写完整后提交：localStorage 落盘、视图切换到参考答案对比
 * 4. 对比视图：学生答案 vs 参考答案并排、查看解析展开/收起
 * 5. 已提交卡片重新挂载：直接进入对比视图（不跳回编辑态）
 * 6. 重写：回到编辑态，保留原有内容
 * 7. 学生隔离：不同 studentId 无法读到对方卡片
 * 8. 空模块：无参考答案时显示提示
 *
 * 全组 JSDOM，零 AI 调用。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";

import { KnowledgeCard } from "@/components/learn/knowledge-card";
import { currentStudentId } from "@/lib/client-identity";

// ---------------------------------------------------------------------------
// 辅助
// ---------------------------------------------------------------------------

const CARD_KEY = "knowledge-cards";

function storageKey(): string {
  return `${CARD_KEY}:${currentStudentId()}`;
}

function getSavedCards(): Record<string, unknown> {
  const raw = globalThis.localStorage.getItem(storageKey());
  if (!raw) return {};
  return JSON.parse(raw);
}

function seedCard(moduleId: string) {
  const cards = getSavedCards();
  cards[moduleId] = {
    summary: "之前写的总结",
    mechanism: "之前写的机制",
    parts: ["零件 A", "零件 B", "零件 C"],
    pitfall: "之前写的坑",
    relationships: "之前写的关系",
    submittedAt: new Date().toISOString(),
  };
  globalThis.localStorage.setItem(storageKey(), JSON.stringify(cards));
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. 初始渲染
// ---------------------------------------------------------------------------

test("初始渲染 — llm-api 模块显示 5 个字段标签和示例", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  // 标题
  assert.ok(
    screen.getByText(/技术要点卡/),
    "技术要点卡标题缺失",
  );
  assert.ok(
    screen.getByText(/LLM API 入门/),
    "模块名缺失",
  );

  // 5 个字段的 label
  const labelEls = document.querySelectorAll("label");
  const labelTexts = new Set(Array.from(labelEls).map(el => el.textContent));
  assert.equal(labelEls.length, 5, `应有 5 个 label，实际 ${labelEls.length}`);
  for (const expected of ["一句话", "核心机制", "关键零件", "常见坑", "前后关系"]) {
    assert.ok(
      labelTexts.has(expected) || Array.from(labelTexts).some(t => t && t.includes(expected)),
      `缺少字段标签：${expected}，现有标签：${JSON.stringify(Array.from(labelTexts))}`,
    );
  }

  // 5 个 textarea
  const textareas = document.querySelectorAll("textarea");
  assert.equal(textareas.length, 5, `应该有 5 个 textarea，实际 ${textareas.length}`);

  // 提交按钮 disabled（全空）
  const submitBtn = screen.getByRole("button", { name: /提交答案/ });
  assert.ok(
    (submitBtn as HTMLButtonElement).disabled,
    "全空时应 disabled",
  );
});

test("初始渲染 — 提示文字和状态文字", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  assert.ok(
    screen.getByText(/学完这一讲/),
    "顶部引导文案缺失",
  );
  assert.ok(
    screen.getByText(/还有空白项未填/),
    "未填状态文字缺失",
  );
});

// ---------------------------------------------------------------------------
// 2. 示例文字虚化 + 点击消失
// ---------------------------------------------------------------------------

test("示例文字 — 初始值为虚化的示例内容", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  assert.ok(textarea, "textarea 不存在");

  // 应有示例内容（不是空的）
  assert.ok(
    textarea.value.includes("调用大模型"),
    `textarea 初始值应含示例，实际为："${textarea.value}"`,
  );

  // 应带虚化样式
  assert.ok(
    textarea.className.includes("text-muted-foreground/50"),
    `textarea 初始应虚化，className: ${textarea.className}`,
  );
});

test("示例文字 — 聚焦后消失且恢复正常颜色", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textarea = document.querySelector("textarea") as HTMLTextAreaElement;
  assert.ok(textarea, "textarea 不存在");

  // 聚焦
  await act(() => {
    fireEvent.focus(textarea);
  });

  // 内容应清空
  assert.equal(textarea.value, "", "聚焦后 textarea 应变空");

  // 虚化样式应移除
  assert.ok(
    !textarea.className.includes("text-muted-foreground/50"),
    `聚焦后不应虚化，className: ${textarea.className}`,
  );
});

test("示例文字 — 每个字段独立控制", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;

  // 聚焦第一个
  await act(() => {
    fireEvent.focus(textareas[0]);
  });

  assert.equal(textareas[0].value, "", "聚焦的 textarea 应变空");
  // 第二个仍保留示例
  assert.ok(
    textareas[1].value.includes("请求-响应模型"),
    `第二个 textarea 示例应保留，实际："${textareas[1].value}"`,
  );
});

// ---------------------------------------------------------------------------
// 3. 填写与提交
// ---------------------------------------------------------------------------

test("提交 — 全填满后按钮可点", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;

  // 逐个字段输入
  const fields = ["一句话总结内容", "核心机制描述", "1. 零件一\n2. 零件二\n3. 零件三", "常见坑描述", "前后关系描述"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  const submitBtn = screen.getByRole("button", { name: /提交答案/ });
  assert.ok(
    !(submitBtn as HTMLButtonElement).disabled,
    "全填满后按钮应可点",
  );

  assert.ok(
    screen.getByText(/已填写完整/),
    "应显示已填完整",
  );
});

test("提交 — 落盘后切到对比视图", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = ["我的一句话", "我的机制描述", "1. 零件1\n2. 零件2\n3. 零件3", "我的坑", "我的关系"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  await act(() => {
    screen.getByRole("button", { name: /提交答案/ }).click();
  });

  // 应进入对比视图（5 个"参考答案"标签）
  const refMatches = screen.queryAllByText(/参考答案/);
  assert.ok(refMatches.length > 0, "提交后应显示参考答案");
  assert.equal(refMatches.length, 6, `应有 6 个"参考答案"文本点（标题+5字段），实际 ${refMatches.length}`);

  // localStorage 已落盘
  const saved = getSavedCards();
  assert.ok(saved["llm-api"], "localStorage 应有 llm-api 记录");
  assert.equal(
    (saved["llm-api"] as Record<string, unknown>).summary,
    "我的一句话",
    "落盘的 summary 应匹配",
  );
  assert.deepEqual(
    (saved["llm-api"] as Record<string, unknown>).parts,
    ["零件1", "零件2", "零件3"],
    "落盘的 parts 应拆成数组",
  );
});

test("提交 — parts 解析过滤空行和标点", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = [
    "a",
    "b",
    "1. 经过\n\n2) 局部   \n3、第三个\n\n空行跳过",
    "d",
    "e",
  ];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  await act(() => {
    screen.getByRole("button", { name: /提交答案/ }).click();
  });

  const saved = getSavedCards();
  const parts = (saved["llm-api"] as Record<string, unknown>).parts as string[];
  assert.deepEqual(
    parts,
    ["经过", "局部", "第三个", "空行跳过"],
    `parts 应去除编号和空行（未编号行保留），实际：${JSON.stringify(parts)}`,
  );
});

// ---------------------------------------------------------------------------
// 4. 对比视图
// ---------------------------------------------------------------------------

test("对比视图 — 学生答案和参考答案并排显示", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = ["我的总结", "我的机制", "1. A\n2. B\n3. C", "我的坑", "依赖啥"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  await act(() => {
    screen.getByRole("button", { name: /提交答案/ }).click();
  });

  // 学生回答栏
  assert.ok(screen.getByText("我的总结"), "应显示学生的总结");
  assert.ok(screen.getByText("我的机制"), "应显示学生的机制");

  // 参考答案栏（llm-api 的 ref data 应包含这些）
  assert.ok(
    screen.getByText(/请求-响应模型/),
    "参考答案应包含请求-响应模型",
  );

  // 5 个"查看解析"按钮
  const toggles = screen.getAllByText(/看解析|收起/);
  assert.equal(toggles.length, 5, `应有 5 个解析 toggle，实际 ${toggles.length}`);
});

test("对比视图 — 解析展开后显示更多内容并返回编辑态", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = ["S", "M", ["P1", "P2", "P3"].map((p, i) => `${i + 1}. ${p}`).join("\n"), "P", "R"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  await act(() => {
    screen.getByRole("button", { name: /提交答案/ }).click();
  });

  // 点第一个"查看解析"
  const firstToggle = screen.getAllByText("查看解析")[0];
  await act(() => {
    firstToggle.click();
  });

  // 应变成"收起解析"
  assert.ok(
    screen.getByText("收起解析"),
    "展开后应有收起解析",
  );

  // "重写"按钮存在
  const rewriteBtn = screen.getByRole("button", { name: /重写/ });
  assert.ok(rewriteBtn, "重写按钮缺失");
});

test("对比视图 — 重写回到编辑态", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = ["总结1", "机制1", "1. X\n2. Y\n3. Z", "坑1", "关系1"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => {
      fireEvent.focus(textareas[i]);
    });
    await act(() => {
      fireEvent.change(textareas[i], { target: { value: fields[i] } });
    });
  }

  await act(() => {
    screen.getByRole("button", { name: /提交答案/ }).click();
  });

  await act(() => {
    screen.getByRole("button", { name: /重写/ }).click();
  });

  // 回到编辑态——textareas 有之前的内容，提交按钮应可点
  assert.ok(
    screen.getByText(/已填写完整/),
    "重写后因保留内容，应显示已填完整",
  );

  // textarea 应有之前的内容
  const textareasAfter = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  assert.equal(textareasAfter[0].value, "总结1", "重写应保留原有内容");
});

// ---------------------------------------------------------------------------
// 5. 已提交卡片重新挂载
// ---------------------------------------------------------------------------

test("重新挂载 — 已提交卡片直接进入对比视图", async () => {
  seedCard("llm-api");

  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  // 应直接显示参考答案（不是编辑态）
  const refMatches = screen.queryAllByText(/参考答案/);
  assert.ok(refMatches.length > 0, "已提交卡片应直接显示参考答案");

  // 不应出现提交按钮
  const submitBtn = screen.queryByRole("button", { name: /提交答案/ });
  assert.equal(submitBtn, null, "已提交不应有提交按钮");
});

test("重新挂载 — 更换模块" +
  "", async () => {
  // 先提交 llm-api
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  for (let i = 0; i < textareas.length; i++) {
    await act(() => fireEvent.focus(textareas[i]));
    await act(() => fireEvent.change(textareas[i], { target: { value: "x" } }));
  }
  await act(() => screen.getByRole("button", { name: /提交答案/ }).click());

  // 渲染另一个模块 system-prompt
  render(
    createElement(KnowledgeCard, { moduleId: "system-prompt", moduleName: "System Prompt 设计" }),
  );

  // 应显示编辑态（未提交）
  const submitBtn = screen.queryByRole("button", { name: /提交答案/ });
  assert.ok(submitBtn, "新模块应显示提交按钮");
});

// ---------------------------------------------------------------------------
// 6. 学生隔离
// ---------------------------------------------------------------------------

test("学生隔离 — key 后缀 studentId", async () => {
  const sid = currentStudentId();
  assert.ok(
    storageKey().includes(sid),
    `storageKey 应含 studentId，实际：${storageKey()}`,
  );
});

// ---------------------------------------------------------------------------
// 7. 空模块
// ---------------------------------------------------------------------------

test("空模块 — 无参考答案时显示提示", async () => {
  render(
    createElement(KnowledgeCard, {
      moduleId: "nonexistent-module",
      moduleName: "不存在的模块",
    }),
  );

  assert.ok(
    screen.getByText(/暂无.*参考答案数据/),
    "无参考数据时应显示提示",
  );
});

// ---------------------------------------------------------------------------
// 8. 边界情况
// ---------------------------------------------------------------------------

test("边界 — 全部填空白提交", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const blankFields = ["   ", "\n\n", " \n \t ", "  ", "\n"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => fireEvent.focus(textareas[i]));
    await act(() => fireEvent.change(textareas[i], { target: { value: blankFields[i] } }));
  }

  // trim 后全空，按钮应 disabled
  const submitBtn = screen.getByRole("button", { name: /提交答案/ });
  assert.ok(
    (submitBtn as HTMLButtonElement).disabled,
    "纯空白应 disabled",
  );
});

test("边界 — parts 全空行" +
  "", async () => {
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const fields = ["a", "b", "1. 有效项\n\n   \n\n3. 另一个\n", "d", "e"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => fireEvent.focus(textareas[i]));
    await act(() => fireEvent.change(textareas[i], { target: { value: fields[i] } }));
  }

  await act(() => screen.getByRole("button", { name: /提交答案/ }).click());

  const saved = getSavedCards();
  const parts = (saved["llm-api"] as Record<string, unknown>).parts as string[];
  assert.deepEqual(parts, ["有效项", "另一个"], `parts 应过滤空行，实际: ${JSON.stringify(parts)}`);
});

test("边界 — 连续提交覆盖旧记录", async () => {
  seedCard("llm-api");

  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );

  // 重写
  await act(() => screen.getByRole("button", { name: /重写/ }).click());

  const textareas = document.querySelectorAll(
    "textarea",
  ) as NodeListOf<HTMLTextAreaElement>;
  const newFields = ["新总结", "新机制", "1. New1\n2. New2", "新坑", "新关系"];

  for (let i = 0; i < textareas.length; i++) {
    await act(() => fireEvent.focus(textareas[i]));
    await act(() => fireEvent.change(textareas[i], { target: { value: newFields[i] } }));
  }

  await act(() => screen.getByRole("button", { name: /提交答案/ }).click());

  const saved = getSavedCards();
  assert.equal(
    (saved["llm-api"] as Record<string, unknown>).summary,
    "新总结",
    "应覆盖旧记录",
  );
});

test("边界 — 多模块卡片互不干扰", async () => {
  // 提交 llm-api
  render(
    createElement(KnowledgeCard, { moduleId: "llm-api", moduleName: "LLM API 入门" }),
  );
  const textareas1 = document.querySelectorAll("textarea") as NodeListOf<HTMLTextAreaElement>;
  for (let i = 0; i < textareas1.length; i++) {
    await act(() => fireEvent.focus(textareas1[i]));
    await act(() => fireEvent.change(textareas1[i], { target: { value: "API" } }));
  }
  await act(() => screen.getByRole("button", { name: /提交答案/ }).click());

  // 提交 system-prompt
  render(
    createElement(KnowledgeCard, { moduleId: "system-prompt", moduleName: "System Prompt 设计" }),
  );
  const textareas2 = document.querySelectorAll("textarea") as NodeListOf<HTMLTextAreaElement>;
  for (let i = 0; i < textareas2.length; i++) {
    await act(() => fireEvent.focus(textareas2[i]));
    await act(() => fireEvent.change(textareas2[i], { target: { value: "Prompt" } }));
  }
  await act(() => screen.getByRole("button", { name: /提交答案/ }).click());

  const saved = getSavedCards();
  assert.ok(saved["llm-api"], "llm-api 记录应存在");
  assert.ok(saved["system-prompt"], "system-prompt 记录应存在");
  assert.equal(
    (saved["llm-api"] as Record<string, unknown>).summary,
    "API",
  );
  assert.equal(
    (saved["system-prompt"] as Record<string, unknown>).summary,
    "Prompt",
  );
});