"use client";

/**
 * 浏览器侧的学生身份
 *
 * 依据
 * ----
 * `api-spec.md`「一、API 路由清单」把 18 个路由里的 13 个标为「认证：是」，
 * 而 `api-auth.ts` 的实际做法是从请求头 `x-student-id` 认人。于是**客户端
 * 必须知道自己是哪个学生**，否则每个请求都是 401。
 *
 * 为什么现在只有一个固定 id
 * ----------------------
 * 库里没有「创建学生」的端点（路由清单里没有 `POST /api/student`），
 * 目前唯一能造出学生的是 `scripts/seed-test-student.mjs`。而真正的入口
 * `/onboarding 学生初始化`（`04-frontend.md`「路由」）要等有创建端点之后
 * 才谈得上。在那之前，浏览器拿这个种子学生身份工作 —— 这是一个**已知的、
 * 有明确边界的临时安排**，不是「假装已经有登录」。
 *
 * 因此本文件的读法：`localStorage` 有合法值时用它（将来登录/引导写进去的
 * 就是这里），没有则退回种子 id。两侧都走同一个 `isStudentId` 校验，
 * 保证发出去的 id 一定过得了服务端的 `z.string().uuid()`。
 *
 * 为什么不放在 `api-auth.ts`
 * ------------------------
 * 那边 import 了数据层（`node:sqlite`），是纯服务端模块。见 `student-id.ts`
 * 文件头。这里只依赖叶子模块。
 */

import demoStudent from "./demo-student.json" with { type: "json" };
import {
  AUTH_TOKEN_HEADER,
  AUTH_TOKEN_STORAGE_KEY,
  STUDENT_ID_HEADER,
  STUDENT_ID_STORAGE_KEY,
  isStudentId,
} from "./student-id";

/**
 * 只用到这两个方法的存储抽象。
 *
 * 不直接写 `window.localStorage` 而抽出接口，是为了让 `resolveStudentId`
 * 能脱离浏览器断言 —— 「存了脏值怎么办」这条规则最容易写错，也最该有测试。
 */
export interface StudentIdStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** 可选：退出去除时若实现支持则可直接删键；不支持则退回写空串。 */
  removeItem?(key: string): void;
}

/**
 * 取当前学生 id。
 *
 * 存储里的值只有在**形状合法**时才被采用：`localStorage` 是学生能手动改的，
 * 一个手改出来的 `stu_test` 会让此后每个请求都 400 —— 与其让界面表现为
 * 「接口全坏了」，不如直接退回可用的种子身份。
 */
export function resolveStudentId(
  storage: StudentIdStorage | null | undefined,
): string {
  const stored = storage?.getItem(STUDENT_ID_STORAGE_KEY) ?? null;
  if (isStudentId(stored ?? "")) return (stored as string).trim();
  return demoStudent.studentId;
}

/** 记住一个学生 id。形状不合法就什么都不做（宁可退回种子身份，也不存脏值）。 */
export function rememberStudentId(
  studentId: string,
  storage: StudentIdStorage | null | undefined,
): void {
  if (!isStudentId(studentId)) return;
  storage?.setItem(STUDENT_ID_STORAGE_KEY, studentId.trim());
}

/**
 * 清空学生身份，退回种子学生。
 *
 * 退出登录时用。实现支持 `removeItem` 就直接删键；只实现了 `setItem` 的
 * 存储则写一个空串 —— `resolveStudentId` 会把空串视为非法、退回种子身份，
 * 效果等价。
 */
export function clearStudentId(
  storage: StudentIdStorage | null | undefined,
): void {
  if (!storage) return;
  if (typeof storage.removeItem === "function") {
    storage.removeItem(STUDENT_ID_STORAGE_KEY);
  } else {
    storage.setItem(STUDENT_ID_STORAGE_KEY, "");
  }
}

/**
 * 给请求加身份头。
 *
 * 单独一个函数而不是让调用方手写 `{ "x-student-id": id }`：请求头名在
 * `student-id.ts` 里只有一份，调用方不该再抄一遍字面量。
 */
export function studentHeaders(studentId: string): Record<string, string> {
  return { [STUDENT_ID_HEADER]: studentId };
}

/**
 * 当前浏览器里的学生 id。
 *
 * `localStorage` 的读取要包 try：隐私模式/被策略禁用时访问它会**抛异常**
 * （Safari 的 `SecurityError`），不是在 `getItem` 上返回 null。没接住的话
 * 整个组件树会白屏，而这里其实完全可以退回种子身份继续跑。
 */
export function currentStudentId(): string {
  return resolveStudentId(browserStorage());
}

// ---------------------------------------------------------------------------
// 鉴权令牌
// ---------------------------------------------------------------------------

/** 取当前鉴权令牌；不存在或浏览器不可用时返回 null。 */
export function resolveAuthToken(
  storage: StudentIdStorage | null | undefined,
): string | null {
  const raw = storage?.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
  return raw && raw.length > 0 ? raw : null;
}

/** 记住鉴权令牌。传 null 等同清空。 */
export function rememberAuthToken(
  token: string | null,
  storage: StudentIdStorage | null | undefined,
): void {
  if (!storage) return;
  if (token === null) {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, "");
  } else {
    storage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  }
}

/** 清空鉴权令牌。 */
export function clearAuthToken(
  storage: StudentIdStorage | null | undefined,
): void {
  rememberAuthToken(null, storage);
}

/**
 * 给请求加身份头 —— 有令牌优先令牌，无令牌退回 student-id。
 * 调用方只管传这个返回值，不用判断走的是哪条路。
 */
export function authHeaders(): Record<string, string> {
  const token = currentAuthToken();
  if (token) return { [AUTH_TOKEN_HEADER]: token };
  return { [STUDENT_ID_HEADER]: currentStudentId() };
}

/** 当前浏览器里的鉴权令牌；不可用时返回 null。 */
export function currentAuthToken(): string | null {
  return resolveAuthToken(browserStorage());
}

/** 读写当前浏览器的存储；不可用时返回 null（见 `currentStudentId` 的注释）。 */
function browserStorage(): StudentIdStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
