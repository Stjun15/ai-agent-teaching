/**
 * ChatRequestSchema moduleId 安全校验
 *
 * 钉什么
 * -----
 * `/api/chat` 路由的 `ChatRequestSchema` 对 `moduleId` 做了与
 * `/api/module-content` 同源的正则校验（`[a-z0-9-]+`）。
 * 但现有的 MODULE_ID_RE 测试只覆盖后者；Schema 的那条正则
 * 没有独立断言，重构时可能只改一边。
 *
 * 全组不调模型。
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import { ChatRequestSchema } from "@/schemas/api";

// ---------------------------------------------------------------------------
// moduleId 合法性
// ---------------------------------------------------------------------------

test("ChatRequestSchema：放行合法 moduleId", () => {
  for (const id of ["python-basics", "ts-basics", "platform-replica", "a", "abc-123-def"]) {
    const r = ChatRequestSchema.safeParse({ content: "你好", moduleId: id });
    assert.equal(r.success, true, `「${id}」应被放行`);
    if (r.success) assert.equal(r.data.moduleId, id);
  }
});

test("ChatRequestSchema：拒绝空字符串 moduleId", () => {
  const r = ChatRequestSchema.safeParse({ content: "你好", moduleId: "" });
  assert.equal(r.success, false, "空字符串应被拒绝");
});

test("ChatRequestSchema：拒绝含特殊字符的 moduleId", () => {
  for (const id of ["invalid!!!", "module name", "module_name", "Module", "中文"]) {
    const r = ChatRequestSchema.safeParse({ content: "你好", moduleId: id });
    assert.equal(r.success, false, `「${id}」应被拒绝`);
  }
});

test("ChatRequestSchema：拒绝路径穿越", () => {
  for (const id of ["../etc/passwd", "..\\windows", "./config", "/etc/passwd", "a/b"]) {
    const r = ChatRequestSchema.safeParse({ content: "你好", moduleId: id });
    assert.equal(r.success, false, `路径穿越「${id}」应被拒绝`);
  }
});

// ---------------------------------------------------------------------------
// 缺省 moduleId 仍合法（演练场自由对话）
// ---------------------------------------------------------------------------

test("ChatRequestSchema：无 moduleId 时仍放行", () => {
  const r = ChatRequestSchema.safeParse({ content: "你好" });
  assert.equal(r.success, true);
});