/**
 * 限流测试（不调模型、不 sleep）
 *
 * 守三件事
 * --------
 * 1. **计数语义** —— 窗口内放行且剩余次数递减；到额度后拦下并给出还要等多久；
 *    窗口过期后立刻恢复。
 * 2. **隔离性** —— 一个学生超限不该牵连另一个学生；一个端点超限不该牵连另一个
 *    端点。这条容易在实现里悄悄写错（例如键忘了拼学生、或窗口被共用），
 *    而症状是「别人被限流」这种极难排查的投诉。
 * 3. **接线未回退** —— 七个受限端点都得真的调用限流，且 scope 与路由对得上。
 *
 * 为什么 `now` 可注入
 * ----------------
 * 「窗口过期」是时间相关的。真 sleep 一个 60 秒窗口的测试没人会跑，
 * 于是它必然被写成「跳过」—— 而不测的那部分正是最该测的（过期逻辑写错，
 * 限流就变成**永久封禁**，学生要重启服务才能继续学习）。
 * 注入 `now` 让过期成为确定性断言，测试仍是毫秒级。
 *
 * 诚实标注本组测试覆盖不到的部分
 * ---------------------------
 * - **真实 HTTP 阈值行为**（连打 21 次请求看第 21 次是否 429）要起 dev 服务，
 *   不进本组；这里用文本断言守住接线，运行时的事实在人工端到端验证里核。
 * - **进程内实现的边界**不是缺陷：多实例部署时各自计数（实际额度是 N 倍）、
 *   进程重启即清零。这是 `rate-limit.ts` 文件头已声明的边界，本组测试不假装
 *   它是分布式限流，也不为它写「看起来更强」的断言。
 *
 * 运行：
 *   pnpm test:rate-limit
 */

import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  RATE_LIMIT_RULES,
  checkRateLimit,
  clientKeyFrom,
  enforceRateLimit,
  resetRateLimits,
  type RateLimitRule,
} from "@/lib/security/rate-limit";

/** 仓库根目录。用绝对路径拼源文件 —— 路由目录里有 `[id]`，走 URL 易被转义。 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function readSource(relativePath: string): string {
  return readFileSync(path.join(ROOT, relativePath), "utf8");
}

/** 注入固定的起点，避免与真实时钟耦合。 */
const T0 = 1_700_000_000_000;
const RULE: RateLimitRule = { limit: 3, windowMs: 60_000 };

beforeEach(() => {
  // 窗口是模块级状态，用例之间必须隔离，否则「谁先跑」会决定结果。
  resetRateLimits();
});

test("窗口内放行，剩余次数逐次递减", () => {
  const key = "计数:基础";

  const first = checkRateLimit(key, RULE, T0);
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 2, "额度 3，用掉 1 次后应剩 2");
  assert.equal(first.retryAfterMs, 0, "放行时不需要等待");

  const second = checkRateLimit(key, RULE, T0 + 1_000);
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 1);
});

test("到达额度后拦下，并给出还需等待的毫秒数", () => {
  const key = "计数:超限";
  for (let i = 0; i < RULE.limit; i += 1) {
    assert.equal(checkRateLimit(key, RULE, T0).allowed, true, `第 ${i + 1} 次`);
  }

  const over = checkRateLimit(key, RULE, T0 + 10_000);
  assert.equal(over.allowed, false, "第 4 次应被拦下");
  assert.equal(over.remaining, 0);
  assert.equal(
    over.retryAfterMs,
    RULE.windowMs - 10_000,
    "应给出距离窗口重置的真实剩余时间，而不是固定值",
  );
});

test("窗口过期后立刻恢复，而不是越拦越久", () => {
  const key = "计数:过期";
  for (let i = 0; i < RULE.limit; i += 1) checkRateLimit(key, RULE, T0);
  assert.equal(
    checkRateLimit(key, RULE, T0 + 1).allowed,
    false,
    "窗口内应拦下",
  );

  // 边界取「正好等于重置时刻」：实现里是 `resetAt <= now`，此时算已过期。
  // 若这里写成 `<`，窗口会多封一毫秒 —— 不致命，但语义要一致且有断言。
  const atReset = checkRateLimit(key, RULE, T0 + RULE.windowMs);
  assert.equal(atReset.allowed, true, "到重置时刻应放行");
  assert.equal(atReset.remaining, RULE.limit - 1, "过期后从满额度重新计数");
});

test("端点之间各自计数：一个端点超限不牵连另一个", () => {
  const student = "student-endpoint-isolation";
  const rule = RATE_LIMIT_RULES.validate;

  for (let i = 0; i < rule.limit; i += 1) {
    enforceRateLimit(student, "validate");
  }
  assert.ok(enforceRateLimit(student, "validate"), "validate 应已超限");

  assert.equal(
    enforceRateLimit(student, "answer-grade"),
    null,
    "另一个端点的额度不该被牵连",
  );
});

test("学生之间各自计数：一个学生超限不牵连另一个", () => {
  const rule = RATE_LIMIT_RULES.answer;

  for (let i = 0; i < rule.limit; i += 1) {
    enforceRateLimit("student-a", "answer");
  }
  assert.ok(enforceRateLimit("student-a", "answer"), "student-a 应已超限");
  assert.equal(
    enforceRateLimit("student-b", "answer"),
    null,
    "student-b 不受影响",
  );
});

test("超限返回可退避重试的 429，并带 Retry-After", async () => {
  const scope = "explain";
  const rule = RATE_LIMIT_RULES[scope];
  const student = "student-response-shape";

  for (let i = 0; i < rule.limit; i += 1) {
    assert.equal(
      enforceRateLimit(student, scope),
      null,
      `第 ${i + 1} 次应放行`,
    );
  }

  const blocked = enforceRateLimit(student, scope);
  assert.ok(blocked, "超出额度应返回响应而非 null");
  assert.equal(blocked.status, 429);

  const body = (await blocked.json()) as {
    error: { code: string; message: string; recoverable: boolean };
  };
  assert.equal(body.error.code, "RATE_LIMIT");
  assert.equal(
    body.error.recoverable,
    true,
    "限流是可恢复错误：前端据此显示「稍后重试」而非「出错了」",
  );
  assert.match(body.error.message, /每分钟最多/, "提示要说明额度");

  const retryAfter = Number(blocked.headers.get("Retry-After"));
  assert.ok(
    Number.isFinite(retryAfter) && retryAfter >= 1,
    "应带 Retry-After 秒数：任何客户端都能据此退避，而不必解析中文提示",
  );
});

test("resetRateLimits 清空所有窗口", () => {
  const rule = RATE_LIMIT_RULES.chat;
  for (let i = 0; i < rule.limit; i += 1) enforceRateLimit("1.2.3.4", "chat");
  assert.ok(enforceRateLimit("1.2.3.4", "chat"), "应已超限");

  resetRateLimits();
  assert.equal(enforceRateLimit("1.2.3.4", "chat"), null, "清空后应恢复额度");
});

test("clientKeyFrom：转发头首段 → x-real-ip → 单一兜底桶", () => {
  const withHeaders = (headers: Record<string, string>) =>
    new Request("http://localhost/api/chat", { headers });

  assert.equal(
    clientKeyFrom(withHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" })),
    "1.2.3.4",
    "多层代理时应取最靠近客户端的首段",
  );
  assert.equal(
    clientKeyFrom(withHeaders({ "x-forwarded-for": "  9.9.9.9  " })),
    "9.9.9.9",
    "应去掉空白",
  );
  assert.equal(
    clientKeyFrom(withHeaders({ "x-real-ip": "7.7.7.7" })),
    "7.7.7.7",
    "没有转发头时回退到 x-real-ip",
  );
  assert.equal(
    clientKeyFrom(withHeaders({ "x-forwarded-for": "   " })),
    "unknown-client",
    "空白的转发头等同于没有：否则会出现一个名为空串的桶",
  );
  assert.equal(
    clientKeyFrom(withHeaders({})),
    "unknown-client",
    "取不到 IP 时归入同一个桶（刻意降级，见 rate-limit.ts）",
  );
});

test("规则表覆盖全部受限端点，且额度与窗口为正", () => {
  const expected = [
    "chat",
    "message",
    "explain",
    "generate-question",
    "validate",
    "answer",
    "answer-grade",
    // 课程审计评估代理（/api/audit/evaluate，本地审计工具用）。
    "audit",
    // 触发课程审计（/api/audit 的 POST）。额度刻意压得比 audit 低：
    // 一次审计要扫全 wiki + 全部讲稿缓存，是重活，不是轻量查询。
    "curriculum-audit",
  ];
  assert.deepEqual(
    Object.keys(RATE_LIMIT_RULES).sort(),
    [...expected].sort(),
    "新增/删除端点时必须同步额度表，否则会静默不限流",
  );

  for (const [scope, rule] of Object.entries(RATE_LIMIT_RULES)) {
    assert.ok(
      Number.isInteger(rule.limit) && rule.limit > 0,
      `${scope} 的额度应是正整数`,
    );
    assert.ok(rule.windowMs > 0, `${scope} 的窗口应是正毫秒数`);
  }
});

/** 路由文件 → 该路由应使用的 scope，以及限流键的来源。 */
const ROUTE_SCOPES: { file: string; scope: string; key: string }[] = [
  { file: "src/app/api/chat/route.ts", scope: "chat", key: "IP" },
  {
    file: "src/app/api/session/[id]/message/route.ts",
    scope: "message",
    key: "身份",
  },
  { file: "src/app/api/agent/explain/route.ts", scope: "explain", key: "身份" },
  {
    file: "src/app/api/agent/generate-question/route.ts",
    scope: "generate-question",
    key: "身份",
  },
  {
    file: "src/app/api/agent/validate/route.ts",
    scope: "validate",
    key: "身份",
  },
  { file: "src/app/api/agent/answer/route.ts", scope: "answer", key: "身份" },
  {
    file: "src/app/api/agent/answer-grade/route.ts",
    scope: "answer-grade",
    key: "身份",
  },
];

test("七个端点都接了限流，scope 与路由一致", () => {
  for (const { file, scope, key } of ROUTE_SCOPES) {
    const text = readSource(file);
    assert.match(
      text,
      new RegExp(`enforceRateLimit\\([\\s\\S]{0,60}?"${scope}"\\)`),
      `${file} 应调用 enforceRateLimit(..., "${scope}")`,
    );
    if (key === "IP") {
      assert.match(
        text,
        /enforceRateLimit\(\s*clientKeyFrom\(req\)/,
        `${file} 没有身份，只能用客户端 IP 作限流键`,
      );
    } else {
      assert.match(
        text,
        /enforceRateLimit\(\s*auth\.student\.id/,
        `${file} 有身份，应按学生计数（按 IP 会让同一 NAT 下的学生互相影响）`,
      );
    }
  }
});

test("限流发生在解析请求体与起流之前", () => {
  for (const { file } of ROUTE_SCOPES) {
    const text = readSource(file);
    // 匹配调用而非 import —— `enforceRateLimit(` 带括号，import 行没有，
    // 用 import 的行号会让这条断言退化成「import 在最上面」这种恒真的废话。
    const limitAt = text.indexOf("enforceRateLimit(");

    assert.ok(limitAt >= 0, `${file} 应有限流调用`);
    assert.ok(
      limitAt < text.indexOf(".json()"),
      `${file} 的限流应早于解析请求体 —— 这样它统计的是全部请求，` +
        "请求体畸形也照样计数，不留免检通道",
    );
  }

  // SSE 端点额外一条：响应头一交出就没法再用状态码拒绝了，
  // 所以限流必须在起流之前 —— 晚一步就不是 429，而是流跑完才被告知超限。
  const messageFile = "src/app/api/session/[id]/message/route.ts";
  const messageText = readSource(messageFile);
  // 锚点是 `runAgentLoop(`（调用），不是 `{` 结尾的字面量 —— 2026-09-19 起
  // 请求体先组 `loopOptions` 再传入，按 `{` 找会得到 -1，断言恒假（曾红过一轮）。
  // import 行写的是 `runAgentLoop,`，不带括号，不会被这个锚误中。
  assert.ok(
    messageText.indexOf("enforceRateLimit(") <
      messageText.indexOf("runAgentLoop("),
    `${messageFile} 的限流必须早于 runAgentLoop —— 一次请求会跑完一整轮 Agent`,
  );
});
