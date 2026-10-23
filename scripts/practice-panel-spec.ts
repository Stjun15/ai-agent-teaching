/**
 * PracticePanel 组件 + usePractice hook —— 出题→作答→评分 全链路
 *
 * 钉什么
 * -----
 * 取题→作答→评分 四阶段状态机、未作答守卫、兜底诚实、会话缓存。
 *
 * 方式
 * ----
 * Mock `fetch`，渲染 PracticePanel，模拟点击流程。
 * 不调模型。
 */

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";

import { createElement } from "react";
import { act } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";

import { PracticePanel } from "@/components/learn/practice-panel";
import { useStudentStore } from "@/stores/student";

// ---------------------------------------------------------------------------
// 共享状态复位 & fetch 拦截
// ---------------------------------------------------------------------------

interface FetchCall {
  url: string;
  body: Record<string, unknown>;
}

let fetchCalls: FetchCall[] = [];
let fetchResponder: ((url: string, body: Record<string, unknown>) => Response | Promise<Response>) | null = null;

beforeEach(() => {
  fetchCalls = [];
  fetchResponder = null;

  globalThis.fetch = (async (url, init) => {
    const body = init?.body
      ? (JSON.parse(init.body as string) as Record<string, unknown>)
      : {};
    const urlStr = String(url);
    fetchCalls.push({ url: urlStr, body });

    if (fetchResponder) {
      return fetchResponder(urlStr, body);
    }

    // 默认：200 空响应
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof globalThis.fetch;

  // 种子学生 ID（"00000000-0000-4000-8000-000000000001"）在 localStorage 不可用时退回
  useStudentStore.setState({ mastery: {} });
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function questionResp(questions: Array<{
  id: string; type: string; difficulty: number; question: string; options?: string[];
}>) {
  return {
    questions: questions.map((q) => ({
      ...q,
      concept_id: "ts-basics",
      scenario: "",
      correct_answer: "SECRET",
      explanation: "SECRET",
      options: q.options ?? [],
    })),
    usedFallback: false,
  };
}

function gradeResp(isCorrect: boolean, score: number) {
  return {
    isCorrect,
    score,
    feedback: "不错！",
    gradedBy: "rule",
    resultId: "r1",
    usedFallback: false,
  };
}

// ---------------------------------------------------------------------------
// ① 初始状态
// ---------------------------------------------------------------------------

test("初始 → 显示「生成练习题」按钮", async () => {
  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  assert.ok(screen.getByText("生成练习题"), "应显示生成按钮");
});

// ---------------------------------------------------------------------------
// ② 成功出题 → 进入作答
// ---------------------------------------------------------------------------

test("点击生成练习题 → 调 generate-question → 显示题目", async () => {
  let sessionCreated = false;

  fetchResponder = (url, _body) => {
    if (url === "/api/session") {
      sessionCreated = true;
      return new Response(JSON.stringify({ sessionId: "sess-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([
            { id: "q1", type: "选择题", difficulty: 2, question: "1+1=?", options: ["2", "3"] },
            { id: "q2", type: "简答题", difficulty: 3, question: "解释闭包" },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  const btn = screen.getByText("生成练习题");
  await act(async () => {
    fireEvent.click(btn);
  });

  await waitFor(() => {
    assert.ok(screen.getByText(/1\+1/), "第一题应出现");
    assert.ok(screen.getByText(/解释闭包/), "第二题应出现");
    assert.ok(screen.getByText("提交答案"), "提交按钮应出现");
  });

  assert.ok(sessionCreated, "第一次出题应先开会话");
});

// ---------------------------------------------------------------------------
// ③ 出题兜底 → 退回 idle
// ---------------------------------------------------------------------------

test("出题兜底 → 显示错误提示，不展示题目", async () => {
  fetchResponder = (url, _body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-2" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify({ questions: [], usedFallback: true }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => {
    assert.ok(
      screen.getByText(/没能连上出题模型/),
      "应显示兜底提示",
    );
    assert.ok(screen.getByText("生成练习题"), "应回到 idle 按钮");
  });
});

// ---------------------------------------------------------------------------
// ④ 提交作答 → 调 answer-grade → 显示评分结果
// ---------------------------------------------------------------------------

test("作答后提交 → 逐题评分 → 显示结果", async () => {
  fetchResponder = (url, body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-3" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([
            { id: "q1", type: "选择题", difficulty: 1, question: "Q1?", options: ["A", "B"] },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/agent/answer-grade") {
      const b = body as Record<string, unknown>;
      assert.ok(b.studentAnswer, "评分请求应携带答案");
      assert.equal(b.sessionId, "sess-3", "评分请求应携带初始会话 ID");
      return new Response(JSON.stringify(gradeResp(true, 80)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByText(/Q1/));

  // 选择答案 A
  const optionA = screen.getByLabelText("A");
  await act(async () => {
    fireEvent.click(optionA);
  });

  await act(async () => {
    fireEvent.click(screen.getByText("提交答案"));
  });

  await waitFor(() => {
    assert.ok(screen.getByText(/答对/), "应显示答对标记");
    assert.ok(screen.getByText("再练一组"), "应显示再练一组按钮");
  });
});

// ---------------------------------------------------------------------------
// ⑤ 未作答守卫
// ---------------------------------------------------------------------------

test("未作答就提交 → 提示未完成", async () => {
  fetchResponder = (url, _body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-4" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([
            { id: "q1", type: "简答题", difficulty: 1, question: "Q?" },
            { id: "q2", type: "简答题", difficulty: 1, question: "Q2?" },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByText(/Q\?/));

  // 不填答案，直接提交
  await act(async () => {
    fireEvent.click(screen.getByText("提交答案"));
  });

  await waitFor(() => {
    assert.ok(
      screen.getByText(/还有.*道题没作答/),
      "应提示还有题没做",
    );
  });

  // 状态应仍在 answering
  assert.ok(screen.getByText("提交答案"), "提交按钮仍应存在");
});

// ---------------------------------------------------------------------------
// ⑥ 简答题输入
// ---------------------------------------------------------------------------

test("简答题可输入文本", async () => {
  fetchResponder = (url, _body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-5" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([
            { id: "q1", type: "简答题", difficulty: 2, question: "说明 TypeScript 的泛型用法" },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByPlaceholderText("写下你的答案…"));

  const textarea = screen.getByPlaceholderText("写下你的答案…") as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "泛型允许函数在调用时确定类型。" } });
  });

  assert.equal(textarea.value, "泛型允许函数在调用时确定类型。");
});

// ---------------------------------------------------------------------------
// ⑦ 评分兜底 → 显示兜底警告
// ---------------------------------------------------------------------------

test("评分兜底 → 显示「有题目没能连上评分模型」", async () => {
  fetchResponder = (url) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-6" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([
            { id: "q1", type: "选择题", difficulty: 1, question: "Q?", options: ["A", "B"] },
          ]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/agent/answer-grade") {
      return new Response(
        JSON.stringify({
          isCorrect: false,
          score: 0,
          feedback: "无评分",
          gradedBy: "model",
          resultId: null,
          usedFallback: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByText(/Q\?/));

  const optionA = screen.getByLabelText("A");
  await act(async () => {
    fireEvent.click(optionA);
  });

  await act(async () => {
    fireEvent.click(screen.getByText("提交答案"));
  });

  await waitFor(() => {
    assert.ok(
      screen.getByText(/没能连上评分模型/),
      "应显示评分兜底警告",
    );
  });
});

// ---------------------------------------------------------------------------
// ⑧ 会话缓存 —— 二次出题不重复开会话
// ---------------------------------------------------------------------------

test("第二次出题复用初始会话", async () => {
  let sessionCallCount = 0;

  fetchResponder = (url, _body) => {
    if (url === "/api/session") {
      sessionCallCount++;
      return new Response(JSON.stringify({ sessionId: `sess-${sessionCallCount}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([{ id: "q1", type: "选择题", difficulty: 1, question: "Q?", options: ["A", "B"] }]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/agent/answer-grade") {
      return new Response(JSON.stringify(gradeResp(true, 80)), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  // 第一轮
  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });
  await waitFor(() => screen.getByText(/Q\?/));
  assert.equal(sessionCallCount, 1, "第一轮应开一次会话");

  // 作答 + 提交
  await act(async () => {
    fireEvent.click(screen.getByLabelText("A"));
  });
  await act(async () => {
    fireEvent.click(screen.getByText("提交答案"));
  });
  await waitFor(() => screen.getByText("再练一组"));

  // 第二轮
  await act(async () => {
    fireEvent.click(screen.getByText("再练一组"));
  });
  await waitFor(() => screen.getByText(/Q\?/));

  assert.equal(sessionCallCount, 1, "第二轮不应重复开会话（useRef 缓存）");
});

// ---------------------------------------------------------------------------
// ⑨ 掌握度上下文
// ---------------------------------------------------------------------------

test("有掌握度记录 → generate-question 携带 difficulty", async () => {
  useStudentStore.setState({
    mastery: {
      "ts-basics": {
        studentId: "00000000-0000-4000-8000-000000000001",
        conceptId: "ts-basics",
        score: 4,
        errorCount: 0,
        lastReviewedAt: null,
        status: "in_progress",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    },
  });

  let difficultySent: number | undefined;

  fetchResponder = (url, body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-d" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      difficultySent = (body as Record<string, unknown>).difficulty as number | undefined;
      return new Response(
        JSON.stringify(
          questionResp([{ id: "q1", type: "选择题", difficulty: 4, question: "难题?", options: ["A", "B"] }]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByText(/难题/));

  assert.equal(difficultySent, 4, "应携带当前掌握度");
});

test("无掌握度记录 → generate-question 不携带 difficulty", async () => {
  useStudentStore.setState({ mastery: {} });

  let difficultySent: unknown = "NOT_SET";

  fetchResponder = (url, body) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-n" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      difficultySent = (body as Record<string, unknown>).difficulty;
      return new Response(
        JSON.stringify(
          questionResp([{ id: "q1", type: "选择题", difficulty: 1, question: "基础题?", options: ["A", "B"] }]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByText(/基础题/));

  assert.equal(difficultySent, undefined, "无掌握度不应携带 difficulty");
});

// ---------------------------------------------------------------------------
// ⑩ 选题卡：locked 状态不可编辑
// ---------------------------------------------------------------------------

test("评分中题目 locked → 控件 disabled", async () => {
  // 用对象持有 resolver：`let` 变量只在 Promise 回调里赋值时，
  // TS 的控制流分析会在使用点把它窄化成 `null`（进而报「不可调用」）。
  const gradeGate: { resolve: ((v: Response) => void) | null } = {
    resolve: null,
  };

  // 用可控的悬挂 Promise 让评分悬在 grading 阶段
  fetchResponder = (url) => {
    if (url === "/api/session") {
      return new Response(JSON.stringify({ sessionId: "sess-lock" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (url === "/api/agent/generate-question") {
      return new Response(
        JSON.stringify(
          questionResp([{ id: "q1", type: "简答题", difficulty: 1, question: "L?", options: [] }]),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    if (url === "/api/agent/answer-grade") {
      // 可控悬挂：返回一个 Promise，由 gradeGate.resolve 手动释放
      return new Promise<Response>((resolve) => {
        gradeGate.resolve = resolve;
      });
    }
    return new Response("{}", { status: 200, headers: { "Content-Type": "application/json" } });
  };

  await act(async () => {
    render(createElement(PracticePanel, { moduleId: "ts-basics" }));
  });

  await act(async () => {
    fireEvent.click(screen.getByText("生成练习题"));
  });

  await waitFor(() => screen.getByPlaceholderText("写下你的答案…"));

  // 输入答案
  const textarea = screen.getByPlaceholderText("写下你的答案…") as HTMLTextAreaElement;
  await act(async () => {
    fireEvent.change(textarea, { target: { value: "答案" } });
  });

  // 提交
  await act(async () => {
    fireEvent.click(screen.getByText("提交答案"));
  });

  // 等 grading 阶段
  await waitFor(() => {
    const locked = screen.getByPlaceholderText("写下你的答案…") as HTMLTextAreaElement;
    assert.equal(locked.disabled, true, "评分中 textarea 应 disabled");
  });

  // 释放 Promise，让测试干净收尾
  gradeGate.resolve?.(new Response(JSON.stringify(gradeResp(true, 80)), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  }));
});