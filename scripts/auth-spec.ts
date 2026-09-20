/**
 * 本地账号（演示级登录/注册）规格测试
 *
 * 守的是 `src/lib/local-users.ts` 那套**不碰浏览器、纯函数**的契约：
 *
 *   1. 密码摘要 —— 可逆、可预测，但至少不能让明文直接躺进 `localStorage`
 *      （功能边界：它是「避免一眼可见」，不是安全方案，见源码注释）；
 *   2. 注册校验 —— 用户名长度/空格、密码长度、两次密码一致；
 *   3. 注册写入 —— 生成合法学生 UUID、能写进存储并读回、重名被拒；
 *   4. 登录匹配 —— 注册账号能登录、密码错误被拒，内置评审账号
 *      （test/eval）免注册直接登录且 id 固定；
 *   5. 存储读回 —— 存进去再读出来，形状与值都不丢失。
 *
 * 运行：
 *   pnpm test:auth
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  changePassword,
  clearCurrentUser,
  CURRENT_USER_STORAGE_KEY,
  getCurrentUser,
  hashPassword,
  LOCAL_USERS_STORAGE_KEY,
  loginUser,
  registerUser,
  setCurrentUser,
  validateRegister,
  type LocalUsersStorage,
} from "@/lib/local-users";
import { isStudentId } from "@/lib/student-id";
import { rememberStudentId } from "@/lib/client-identity";

/** 内存版存储，替代 `window.localStorage`。 */
function memoryStorage(): LocalUsersStorage & {
  map: Map<string, string>;
} {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

/** 合法注册值（用户名足够长、密码 ≥6、两次一致）。 */
const VALID = {
  username: "alice",
  password: "secret123",
  confirmPassword: "secret123",
};

// ---------------------------------------------------------------------------
// 密码摘要
// ---------------------------------------------------------------------------

test("hashPassword：可逆（自身即逆），但明文不直接可见", () => {
  assert.notEqual(hashPassword("secret123"), "secret123");
  assert.equal(hashPassword(hashPassword("secret123")), "secret123");
  assert.notEqual(hashPassword("aaaaaaaaaa"), hashPassword("bbbbbbbbbb"));
});

// ---------------------------------------------------------------------------
// 注册结构校验
// ---------------------------------------------------------------------------

test("validateRegister：合法输入通过", () => {
  const result = validateRegister(VALID);
  assert.equal(result.ok, true);
  assert.deepEqual(result.errors, []);
});

test("validateRegister：用户名太短/过长/含空格被拒", () => {
  assert.equal(validateRegister({ ...VALID, username: "a" }).ok, false);
  assert.equal(validateRegister({ ...VALID, username: "a b" }).ok, false);
  assert.equal(
    validateRegister({ ...VALID, username: "a".repeat(33) }).ok,
    false,
  );
});

test("validateRegister：密码过短、两次不一致被拒", () => {
  assert.equal(
    validateRegister({ ...VALID, password: "12345", confirmPassword: "12345" })
      .ok,
    false,
  );
  assert.equal(
    validateRegister({ ...VALID, confirmPassword: "different" }).ok,
    false,
  );
});

// ---------------------------------------------------------------------------
// 注册写入
// ---------------------------------------------------------------------------

test("registerUser：生成合法学生 UUID，且写入存储可读回", () => {
  const storage = memoryStorage();
  const result = registerUser(storage, VALID);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(
    isStudentId(result.id),
    true,
    "注册生成的 id 必须是合法学生 UUID",
  );

  const raw = storage.map.get(LOCAL_USERS_STORAGE_KEY);
  assert.ok(raw, "注册后存储里应有账号数组");
  const parsed = JSON.parse(raw as string);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].username, "alice");
  assert.equal(parsed[0].id, result.id);
  assert.equal(parsed[0].preferredName, "alice");
  assert.notEqual(parsed[0].passwordHash, "secret123");
});

test("registerUser：用户名已被占用被拒", () => {
  const storage = memoryStorage();
  registerUser(storage, VALID);

  const dup = registerUser(storage, {
    username: "alice",
    password: "secret123",
    confirmPassword: "secret123",
  });
  assert.equal(dup.ok, false);
  if (dup.ok) return;
  assert.ok(
    dup.errors.some((item) => item.field === "username"),
    "重名应落在 username 字段上",
  );
});

test("registerUser：同一次注册两个不同用户都成功且不互相覆盖", () => {
  const storage = memoryStorage();
  registerUser(storage, VALID);
  registerUser(storage, {
    username: "bob",
    password: "password1",
    confirmPassword: "password1",
  });

  const parsed = JSON.parse(storage.map.get(LOCAL_USERS_STORAGE_KEY) as string);
  assert.equal(parsed.length, 2);
});

// ---------------------------------------------------------------------------
// 登录匹配
// ---------------------------------------------------------------------------

test("loginUser：注册账号用对密码能登录，密码错误被拒", () => {
  const storage = memoryStorage();
  registerUser(storage, VALID);

  const ok = loginUser(storage, { username: "alice", password: "secret123" });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(isStudentId(ok.id), true);
    assert.equal(ok.username, "alice");
  }

  const bad = loginUser(storage, { username: "alice", password: "wrongpass" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.message, /不正确/);
});

test("loginUser：未注册用户名登录失败", () => {
  const result = loginUser(memoryStorage(), {
    username: "nobody",
    password: "whatever",
  });
  assert.equal(result.ok, false);
});

test("loginUser：内置评审账号免注册直接登录，id 固定", () => {
  const storage = memoryStorage();
  // 从未注册也能用内置账号登录。
  const result = loginUser(storage, { username: "test", password: "test1234" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(isStudentId(result.id), true);

  const wrong = loginUser(storage, { username: "test", password: "wrong" });
  assert.equal(wrong.ok, false);
});

test("loginUser：用户名匹配忽略首尾空白", () => {
  const storage = memoryStorage();
  registerUser(storage, VALID);
  const result = loginUser(storage, {
    username: "  alice  ",
    password: "secret123",
  });
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// 与身份写入的连接契约（演示流程的核心）
// ---------------------------------------------------------------------------

test("登录得到的 id 能被 rememberStudentId 写入身份存储", () => {
  const storage = memoryStorage();
  registerUser(storage, VALID);
  const login = loginUser(storage, {
    username: "alice",
    password: "secret123",
  });

  const identity = {
    ...memoryStorage(),
    value: null as string | null,
  };
  if (!login.ok) throw new Error("登录应当成功");
  rememberStudentId(login.id, {
    getItem: () => identity.value,
    setItem: (_key, value) => {
      identity.value = value;
    },
  });
  assert.equal(identity.value, login.id, "登录后的 id 应作为学生身份写进去");
});

// ---------------------------------------------------------------------------
// 当前会话用户（`sso.currentUser`）
// ---------------------------------------------------------------------------

test("setCurrentUser/getCurrentUser：写入后能读回，preferredName 可选", () => {
  const storage = memoryStorage();
  setCurrentUser(storage, {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "alice",
    preferredName: "Alice",
  });
  assert.equal(getCurrentUser(storage)?.username, "alice");
  assert.equal(getCurrentUser(storage)?.preferredName, "Alice");

  setCurrentUser(storage, {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "alice",
  });
  assert.equal(getCurrentUser(storage)?.preferredName, undefined);
});

test("getCurrentUser：无值或损坏时返回 null", () => {
  assert.equal(getCurrentUser(memoryStorage()), null);

  const bad = memoryStorage();
  bad.setItem(CURRENT_USER_STORAGE_KEY, "{not-json");
  assert.equal(getCurrentUser(bad), null);
});

test("clearCurrentUser：清空会话", () => {
  const storage = memoryStorage();
  setCurrentUser(storage, {
    id: "aaaaaaaa-0000-4000-8000-000000000001",
    username: "alice",
  });
  clearCurrentUser(storage);
  assert.equal(
    storage.map.get(CURRENT_USER_STORAGE_KEY),
    "",
    "仅 getItem/setItem 的存储清空后键应为空串",
  );
  assert.equal(getCurrentUser(storage), null);
});

// ---------------------------------------------------------------------------
// 修改密码（演示级）
// ---------------------------------------------------------------------------

test("changePassword：旧密码正确则改成功，且新密码能登录", () => {
  const storage = memoryStorage();
  const reg = registerUser(storage, VALID);
  if (!reg.ok) throw new Error("注册应当成功");

  const changed = changePassword(storage, {
    id: reg.id,
    oldPassword: "secret123",
    newPassword: "brandNew1",
  });
  assert.equal(changed.ok, true);

  const ok = loginUser(storage, { username: "alice", password: "brandNew1" });
  assert.equal(ok.ok, true);
  const old = loginUser(storage, { username: "alice", password: "secret123" });
  assert.equal(old.ok, false, "旧密码应已失效");
});

test("changePassword：旧密码错误、新密码过短、新旧相同、账号不存在都被拒", () => {
  const storage = memoryStorage();
  const reg = registerUser(storage, VALID);
  if (!reg.ok) throw new Error("注册应当成功");
  const id = reg.id;

  assert.equal(
    changePassword(storage, {
      id,
      oldPassword: "wrong-old",
      newPassword: "aaa",
    }).ok,
    false,
    "旧密码错误",
  );
  assert.equal(
    changePassword(storage, {
      id,
      oldPassword: "secret123",
      newPassword: "123",
    }).ok,
    false,
    "新密码过短",
  );
  assert.equal(
    changePassword(storage, {
      id,
      oldPassword: "secret123",
      newPassword: "secret123",
    }).ok,
    false,
    "新旧相同",
  );
  assert.equal(
    changePassword(storage, {
      id: "00000000-0000-4000-8000-000000000000",
      oldPassword: "secret123",
      newPassword: "brandNew1",
    }).ok,
    false,
    "账号不存在",
  );
});
