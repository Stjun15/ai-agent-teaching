/**
 * 客户端身份规格测试
 *
 * 这一组守的是**「发出去的学生 id 能不能过服务端那道门」**，不是「取到了什么」。
 * 三个层次：
 *
 * 1. **形状**。`api-spec.md` 第八节把 `studentId` 定成 `z.string().uuid()`，
 *    前端必须在本地先挡住脏值 —— 否则界面表现为「接口全坏了」，而不是
 *    「本地存错了」，排查方向从一开始就是歪的。
 * 2. **降级**。`localStorage` 是学生能手动改的。存了非法值时**必须退回种子
 *    身份**继续可用，而不是照原样发出去。
 * 3. **线上格式**。请求头名 `x-student-id` 是客户端与服务端之间的契约字面量，
 *    这里把字面量钉住：改名等于改协议，值得让测试红一次提醒改的人。
 *
 * `resolveStudentId` 收一个 storage 参数而不是直接摸 `window`，就是为了
 * 能在 Node 里断言上面这些 —— 见 `src/lib/client-identity.ts` 的接口注释。
 *
 * 运行：
 *   pnpm test:identity
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  currentStudentId,
  rememberStudentId,
  resolveStudentId,
  studentHeaders,
  type StudentIdStorage,
} from "@/lib/client-identity";
import { STUDENT_ID_HEADER, isStudentId } from "@/lib/student-id";

/**
 * 种子学生 id。
 *
 * 故意**不**直接 import `demo-student.json`：那会绕开被测的取值逻辑，
 * 变成「测试自己读文件、断言自己读到的值」。这里走公开访问器
 * `resolveStudentId(null)` —— 「没有任何存储时用谁」本身就是它的职责。
 */
const DEMO_STUDENT_ID = resolveStudentId(null);

/** 内存版 storage，替代 `window.localStorage`。 */
function memoryStorage(
  initial?: string,
): StudentIdStorage & { value: string | null } {
  const state = { value: initial ?? null };
  return {
    get value() {
      return state.value;
    },
    getItem: (key) => (key === "ai-teaching:studentId" ? state.value : null),
    setItem: (_key, value) => {
      state.value = value;
    },
  };
}

const OTHER_STUDENT_ID = "11111111-2222-4333-8444-555555555555";

// ---------------------------------------------------------------------------
// 形状
// ---------------------------------------------------------------------------

test("演示学生 id 本身必须是合法 UUID（它有改动就会全线 400）", () => {
  assert.equal(isStudentId(DEMO_STUDENT_ID), true);
});

test("isStudentId：合法 UUID 通过，手搓字符串与空串不通过", () => {
  assert.equal(isStudentId(OTHER_STUDENT_ID), true);
  assert.equal(isStudentId(DEMO_STUDENT_ID), true);
  assert.equal(isStudentId("stu_test"), false);
  assert.equal(isStudentId(""), false);
  assert.equal(isStudentId("   "), false);
  // 少一段、多一段、含非十六进制字符，都不该通过。
  assert.equal(isStudentId("11111111-2222-4333-8444"), false);
  assert.equal(isStudentId("11111111-2222-4333-8444-555555555555-6666"), false);
  assert.equal(isStudentId("zzzzzzzz-2222-4333-8444-555555555555"), false);
});

test("isStudentId：前后空白不算错（学生从别处复制粘贴会带进来）", () => {
  assert.equal(isStudentId(`  ${OTHER_STUDENT_ID}  `), true);
});

// ---------------------------------------------------------------------------
// 降级：脏值必须退回种子身份，而不是照发
// ---------------------------------------------------------------------------

test("resolveStudentId：没有存储时用种子学生", () => {
  assert.equal(resolveStudentId(null), DEMO_STUDENT_ID);
  assert.equal(resolveStudentId(undefined), DEMO_STUDENT_ID);
  assert.equal(resolveStudentId(memoryStorage()), DEMO_STUDENT_ID);
});

test("resolveStudentId：存储里有合法值时用它（将来登录写的就是这里）", () => {
  assert.equal(
    resolveStudentId(memoryStorage(OTHER_STUDENT_ID)),
    OTHER_STUDENT_ID,
  );
});

test("resolveStudentId：存储里是脏值时退回种子身份，不把脏值发出去", () => {
  for (const dirty of ["stu_test", "", "   ", "null", "{studentId: 1}"]) {
    assert.equal(
      resolveStudentId(memoryStorage(dirty)),
      DEMO_STUDENT_ID,
      `脏值 ${JSON.stringify(dirty)} 不该被采用`,
    );
  }
});

test("resolveStudentId：合法值带空白时取 trim 后的结果", () => {
  assert.equal(
    resolveStudentId(memoryStorage(` ${OTHER_STUDENT_ID} `)),
    OTHER_STUDENT_ID,
  );
});

// ---------------------------------------------------------------------------
// 写入
// ---------------------------------------------------------------------------

test("rememberStudentId：只写合法值，且写的是 trim 后的结果", () => {
  const storage = memoryStorage();
  rememberStudentId(`  ${OTHER_STUDENT_ID}  `, storage);
  assert.equal(storage.value, OTHER_STUDENT_ID);
});

test("rememberStudentId：非法值一律不写（宁可退回种子，也不存脏值）", () => {
  const storage = memoryStorage();
  rememberStudentId("stu_test", storage);
  assert.equal(storage.value, null);

  const kept = memoryStorage(OTHER_STUDENT_ID);
  rememberStudentId("", kept);
  assert.equal(kept.value, OTHER_STUDENT_ID, "不该被空值覆盖");
});

// ---------------------------------------------------------------------------
// 线上格式：请求头名是两端契约
// ---------------------------------------------------------------------------

test("studentHeaders：用的正是服务端读的那个头名", () => {
  const headers = studentHeaders(OTHER_STUDENT_ID);
  // 故意钉字面量：改这个字符串等于改协议，服务端 `api-auth.ts` 也在等它。
  assert.deepEqual(headers, { "x-student-id": OTHER_STUDENT_ID });
  assert.equal(STUDENT_ID_HEADER, "x-student-id");
});

// ---------------------------------------------------------------------------
// 服务端渲染期间不能炸
// ---------------------------------------------------------------------------

test("currentStudentId：Node 环境（无 window）下直接退回种子身份", () => {
  // 节点测试进程里本来就没有 window，这条断言守的是「服务端渲染阶段
  // 也不会因为摸 localStorage 而抛异常」。
  assert.equal(typeof window, "undefined");
  assert.equal(currentStudentId(), DEMO_STUDENT_ID);
});
