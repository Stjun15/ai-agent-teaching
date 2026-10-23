import { describe, expect, it } from "vitest";

import {
  createToken,
  hashPassword,
  verifyPassword,
  verifyToken,
} from "@/lib/auth";

describe("密码哈希", () => {
  it("同一密码两次哈希得到不同盐，但都能验证通过", () => {
    const first = hashPassword("test1234");
    const second = hashPassword("test1234");

    expect(first).not.toBe(second);
    expect(first).toContain(":");
    expect(verifyPassword("test1234", first)).toBe(true);
    expect(verifyPassword("test1234", second)).toBe(true);
  });

  it("错误密码与损坏的存盘格式都拒绝", () => {
    expect(verifyPassword("wrong", hashPassword("test1234"))).toBe(false);
    expect(verifyPassword("test1234", "not-a-hash")).toBe(false);
  });
});

describe("JWT 令牌", () => {
  it("签发后可验证并还原学生 id", () => {
    const token = createToken("student-1");
    expect(verifyToken(token)).toEqual({ studentId: "student-1" });
  });

  it("篡改签名或结构不合法时返回 null", () => {
    const token = createToken("student-1");
    const parts = token.split(".");

    expect(
      verifyToken(`${parts[0]}.${parts[1]}.${"x".repeat(parts[2].length)}`),
    ).toBeNull();
    expect(verifyToken("only.two")).toBeNull();
    expect(verifyToken("")).toBeNull();
  });
});
