import { beforeEach, describe, expect, it } from "vitest";

import {
  RATE_LIMIT_RULES,
  clientKeyFrom,
  enforceRateLimit,
  resetRateLimits,
} from "@/lib/security/rate-limit";

describe("限流规则表", () => {
  it("每条规则的额度与窗口都是正数", () => {
    for (const [scope, rule] of Object.entries(RATE_LIMIT_RULES)) {
      expect(rule.limit, scope).toBeGreaterThan(0);
      expect(rule.windowMs, scope).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("重活端点额度低于同类轻量端点", () => {
    expect(RATE_LIMIT_RULES["curriculum-audit"].limit).toBeLessThan(
      RATE_LIMIT_RULES.audit.limit,
    );
    expect(RATE_LIMIT_RULES["auth-login"].limit).toBeLessThan(
      RATE_LIMIT_RULES["answer-grade"].limit,
    );
    // 注册按小时计窗口，挡住批量造号
    expect(RATE_LIMIT_RULES["auth-register"].windowMs).toBe(60 * 60_000);
  });
});

describe("端点接入 enforceRateLimit", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  it("额度内放行时返回 null", () => {
    expect(enforceRateLimit("student-a", "explain")).toBeNull();
  });

  it("超限时返回 429 且带 Retry-After 与可恢复标记", async () => {
    const rule = RATE_LIMIT_RULES["auth-login"];
    for (let i = 0; i < rule.limit; i += 1) {
      expect(enforceRateLimit("student-b", "auth-login")).toBeNull();
    }

    const response = enforceRateLimit("student-b", "auth-login");
    expect(response).not.toBeNull();
    expect(response?.status).toBe(429);

    const retryAfter = Number(response?.headers.get("Retry-After"));
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);

    const body = await response?.json();
    expect(body.error.code).toBe("RATE_LIMIT");
    expect(body.error.recoverable).toBe(true);
    expect(body.error.message).toContain("auth-login");
  });

  it("不同学生共用同一端点时互不占额度", () => {
    const rule = RATE_LIMIT_RULES["validate"];
    for (let i = 0; i < rule.limit; i += 1) {
      enforceRateLimit("student-c", "validate");
    }
    expect(enforceRateLimit("student-c", "validate")?.status).toBe(429);
    expect(enforceRateLimit("student-d", "validate")).toBeNull();
  });
});

describe("无身份端点的限流键", () => {
  it("优先取 x-forwarded-for 的第一跳地址", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    });
    expect(clientKeyFrom(request)).toBe("203.0.113.7");
  });

  it("退回 x-real-ip", () => {
    const request = new Request("http://localhost/api/chat", {
      headers: { "x-real-ip": "198.51.100.9" },
    });
    expect(clientKeyFrom(request)).toBe("198.51.100.9");
  });

  it("都取不到时归入同一个桶，而不是完全免检", () => {
    const request = new Request("http://localhost/api/chat");
    expect(clientKeyFrom(request)).toBe("unknown-client");
  });
});
