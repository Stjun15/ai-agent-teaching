import { describe, expect, it } from "vitest";

import {
  AUTH_TOKEN_HEADER,
  AUTH_TOKEN_QUERY,
  AUTH_TOKEN_STORAGE_KEY,
  STUDENT_ID_HEADER,
  STUDENT_ID_QUERY,
  STUDENT_ID_STORAGE_KEY,
  isStudentId,
} from "@/lib/student-id";

describe("学生身份常量", () => {
  it("请求头名统一小写，避免服务端与客户端大小写不一致", () => {
    for (const header of [STUDENT_ID_HEADER, AUTH_TOKEN_HEADER]) {
      expect(header).toBe(header.toLowerCase());
      expect(header).not.toContain(" ");
    }
    // query 参数是SSE端点用的驼峰名，不能套用 header 的小写规则
    expect(STUDENT_ID_QUERY).toBe("studentId");
    expect(AUTH_TOKEN_QUERY).toBe("token");
  });

  it("请求头与本地存储键不是同一个字符串", () => {
    expect(STUDENT_ID_STORAGE_KEY).not.toBe(STUDENT_ID_HEADER);
    expect(AUTH_TOKEN_STORAGE_KEY).not.toBe(AUTH_TOKEN_HEADER);
  });
});

describe("学生 id 形状校验", () => {
  const UUID = "3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f";

  it("标准 UUID 通过，大小写无关", () => {
    expect(isStudentId(UUID)).toBe(true);
    expect(isStudentId(UUID.toUpperCase())).toBe(true);
  });

  it("前后空白先 trim 再判定", () => {
    expect(isStudentId(`  ${UUID}\n`)).toBe(true);
  });

  it("手搓 id 与残缺 UUID 都被拒绝", () => {
    expect(isStudentId("stu_test")).toBe(false);
    expect(isStudentId("")).toBe(false);
    expect(isStudentId("3f1c2d4e5a6b4c7d8e9f0a1b2c3d4e5f")).toBe(false);
    expect(isStudentId(`${UUID}-extra`)).toBe(false);
  });
});
