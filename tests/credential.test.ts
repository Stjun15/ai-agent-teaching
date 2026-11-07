import { describe, expect, it } from "vitest";

import {
  canonicalize,
  fingerprintOf,
  issueCredential,
  shortHash,
  verifySignature,
} from "@/lib/credential";

describe("凭证指纹与签名", () => {
  it("规范化结果与 key 的书写顺序无关", () => {
    expect(canonicalize({ b: 2, a: 1 })).toBe(canonicalize({ a: 1, b: 2 }));
    expect(canonicalize({ b: 2, a: 1 })).toBe('{"a":1,"b":2}');
  });

  it("同一份数据两次算出同一指纹", () => {
    const payload = { studentId: "s1", moduleId: "rag", score: 4 };
    expect(fingerprintOf(payload)).toBe(fingerprintOf({ ...payload }));
    expect(fingerprintOf(payload)).toHaveLength(64);
  });

  it("改一个字段指纹就变（哪怕只差 1 分）", () => {
    const base = { studentId: "s1", moduleId: "rag", score: 4 };
    const changed = { ...base, score: 5 };
    expect(fingerprintOf(base)).not.toBe(fingerprintOf(changed));
  });

  it("签名可验证，篡改后验签失败", () => {
    const payload = { studentId: "s1", moduleId: "rag", totalScore: 82 };
    const stamp = issueCredential(payload);
    expect(verifySignature(payload, stamp.signature)).toBe(true);
    expect(verifySignature({ ...payload, totalScore: 95 }, stamp.signature)).toBe(
      false,
    );
  });

  it("短哈希只截前缀，长度参数有下限", () => {
    const hex = fingerprintOf("x");
    expect(shortHash(hex, 8)).toHaveLength(8);
    expect(shortHash(hex, 1)).toHaveLength(4);
    expect(hex.startsWith(shortHash(hex, 8))).toBe(true);
  });
});
