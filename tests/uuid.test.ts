import { afterEach, describe, expect, it, vi } from "vitest";

import { randomUuid } from "@/lib/uuid";

const V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("randomUuid", () => {
  it("安全上下文下直接用 crypto.randomUUID", () => {
    const spy = vi.fn(() => "11111111-1111-4111-8111-111111111111");
    vi.stubGlobal("crypto", { randomUUID: spy, getRandomValues: vi.fn() });
    expect(randomUuid()).toBe("11111111-1111-4111-8111-111111111111");
    expect(spy).toHaveBeenCalledOnce();
  });

  // 生产环境是 http://<IP> 明文访问，不是安全上下文 —— randomUUID 不存在。
  // 2026-10-23 线上讲解页恒显示「还没有对话」，根因就是这里抛 TypeError。
  it("非安全上下文降级为 getRandomValues 且仍是合法 UUID v4", () => {
    let seed = 0;
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        seed += 1;
        for (let i = 0; i < bytes.length; i += 1) bytes[i] = (i * 16 + seed) & 0xff;
        return bytes;
      },
    });
    const id = randomUuid();
    expect(id).toMatch(V4);
    expect(id).not.toBe(randomUuid());
  });
});
