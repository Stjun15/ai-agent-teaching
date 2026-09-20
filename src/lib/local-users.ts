/**
 * 本地账号（演示级登录/注册）
 *
 * ⚠️ 这不是真实鉴权。这里没有任何后端、没有任何密钥，账号只存在当前浏览器的
 * `localStorage` 里，换浏览器 / 清缓存就没了，改 `localStorage` 就能冒充任意
 * 用户。它存在的唯一目的是让演示/评审能「假扮」成一个独立学生来走完整流程，
 * 好让这个前端 Web 应用能展示登录这一形态 —— 与项目一贯的「不要假装有能力」
 * 纪律一致，界面必须常驻「演示模式」提示，绝不把这里描述成安全方案。
 *
 * 存储契约
 * -------
 * key `sso.localUsers`，值是一个 JSON 数组，元素形如
 * `{ id: uuid, username: string, preferredName?: string, passwordHash: string,
 *    createdAt: ISO 字符串 }`。
 *
 * 为什么是可注入的 storage 而不是直接摸 `window.localStorage`
 * -------------------------------------------------------
 * 与 `client-identity.ts` 同款做法：抽成 `LocalUsersStorage` 接口，让校验、
 * 注册去重、登录匹配、localStorage 读回这些逻辑能脱离浏览器用 Node 断言
 * （`pnpm test:auth`）。真正的浏览器读写只在 `auth/page.tsx` 里接。
 */

import { isStudentId } from "./student-id";

/** `localStorage` 里账号数组用的键。 */
export const LOCAL_USERS_STORAGE_KEY = "sso.localUsers";

/** 一个本地账号。`id` 同时用作学生身份（必须过 `isStudentId` 的 UUID 校验）。 */
export interface LocalUser {
  id: string;
  username: string;
  preferredName?: string;
  passwordHash: string;
  createdAt: string;
}

/** 只用到读写（删除可选）的存储抽象 —— 便于脱离浏览器测试。 */
export interface LocalUsersStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** 可选：清空时若实现支持可直接删键；不支持则退回写空串。 */
  removeItem?(key: string): void;
}

// ---------------------------------------------------------------------------
// 密码摘要
// ---------------------------------------------------------------------------

/**
 * 演示级密码摘要。
 *
 * 对每个字符做固定偏移的按位异或（`0x5a`）。**可逆、可预测、谈不上任何安全**：
 * 它顶多让明文不直接躺进 `localStorage`、起到「避免一眼可见」的效果；
 * 绝不是哈希加密。真实产品必须用带盐的强哈希（如 bcrypt/argon2）并走服务端。
 * 这里维持可逆是为了配合「演示级」定位 —— 一旦评审在 Data 面板里看到明文，
 * 反而说明实现越界了。
 */
export function hashPassword(password: string): string {
  let out = "";
  for (let i = 0; i < password.length; i++) {
    out += String.fromCharCode(password.charCodeAt(i) ^ 0x5a);
  }
  return out;
}

/** 生成新账号的学生 id 与学生账号 id —— 复用 UUID 生成，保证形状合法。 */
function newUuid(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// 注册校验
// ---------------------------------------------------------------------------

export type RegisterField = "username" | "password" | "confirmPassword";

export interface RegisterError {
  field: RegisterField;
  message: string;
}

export interface RegisterValues {
  username: string;
  password: string;
  confirmPassword: string;
}

/** 纯结构校验：字段是否满足格式（不含「重名」这类需要读存储的判断）。 */
export function validateRegister(values: RegisterValues): {
  ok: boolean;
  errors: RegisterError[];
} {
  const errors: RegisterError[] = [];

  const username = values.username.trim();
  if (username.length < 2) {
    errors.push({ field: "username", message: "用户名至少 2 个字符。" });
  } else if (username.length > 32) {
    errors.push({ field: "username", message: "用户名最多 32 个字符。" });
  } else if (/\s/.test(username)) {
    errors.push({ field: "username", message: "用户名不能包含空格。" });
  }

  if (values.password.length < 6) {
    errors.push({ field: "password", message: "密码至少 6 个字符。" });
  }
  if (values.password !== values.confirmPassword) {
    errors.push({
      field: "confirmPassword",
      message: "两次输入的密码不一致。",
    });
  }

  return { ok: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// 注册 / 登录
// ---------------------------------------------------------------------------

export type RegisterUserResult =
  | { ok: true; id: string; username: string; preferredName: string }
  | { ok: false; errors: RegisterError[] };

/**
 * 注册一个本地账号并写入存储。
 *
 * 结构校验（`validateRegister`）与「用户名是否已被占用」一起返回为
 * `RegisterError[]`，让界面能按字段提示。成功后返回新账号的 `id` —— 这个
 * `id` 就是本次学习的**学生身份**，页面据此改写 `student-id` 存储。
 */
export function registerUser(
  storage: LocalUsersStorage | null | undefined,
  values: RegisterValues,
): RegisterUserResult {
  const validation = validateRegister(values);
  const username = values.username.trim();

  const taken = readUsers(storage).some(
    (user) => user.username.toLowerCase() === username.toLowerCase(),
  );
  if (taken) {
    const errors = [
      ...validation.errors,
      { field: "username" as const, message: "该用户名已被注册。" },
    ];
    return { ok: false, errors };
  }
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const id = newUuid();
  const user: LocalUser = {
    id,
    username,
    preferredName: username,
    passwordHash: hashPassword(values.password),
    createdAt: new Date().toISOString(),
  };

  const users = readUsers(storage);
  users.push(user);
  writeUsers(storage, users);

  return {
    ok: true,
    id,
    username,
    preferredName: user.preferredName as string,
  };
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export type LoginResult =
  | { ok: true; id: string; username: string; preferredName: string }
  | { ok: false; message: string };

/**
 * 内置评审账号。
 *
 * 固定用户名 + 固定密码，方便评审/演示免注册直接登录。密码同样是上面那个
 * **演示级**摘要，不作为任何安全承诺。
 */
const BUILTIN_ACCOUNTS: readonly {
  username: string;
  preferredName: string;
  password: string;
  id: string;
}[] = [
  {
    username: "test",
    preferredName: "评审演示账号",
    password: "test1234",
    id: "aaaaaaaa-0000-4000-8000-000000000001",
  },
  {
    username: "eval",
    preferredName: "评审演示账号",
    password: "eval1234",
    id: "aaaaaaaa-0000-4000-8000-000000000002",
  },
];

/** 登录：先查本地注册账号，再回退到内置评审账号。 */
export function loginUser(
  storage: LocalUsersStorage | null | undefined,
  credentials: LoginCredentials,
): LoginResult {
  const username = credentials.username.trim();
  const attemptHash = hashPassword(credentials.password);

  const registered = readUsers(storage).find(
    (user) => user.username.toLowerCase() === username.toLowerCase(),
  );
  if (registered && registered.passwordHash === attemptHash) {
    return {
      ok: true,
      id: registered.id,
      username: registered.username,
      preferredName: registered.preferredName ?? registered.username,
    };
  }

  const builtin = BUILTIN_ACCOUNTS.find(
    (account) => account.username.toLowerCase() === username.toLowerCase(),
  );
  if (builtin && hashPassword(builtin.password) === attemptHash) {
    return {
      ok: true,
      id: builtin.id,
      username: builtin.username,
      preferredName: builtin.preferredName,
    };
  }

  return { ok: false, message: "用户名或密码不正确。" };
}

// ---------------------------------------------------------------------------
// 存储读写
// ---------------------------------------------------------------------------

/** 读出账号数组；格式损坏或不可用时按空数组处理（绝不让一跳船就炸掉）。 */
function readUsers(storage: LocalUsersStorage | null | undefined): LocalUser[] {
  const raw = storage?.getItem(LOCAL_USERS_STORAGE_KEY) ?? null;
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isLocalUser);
  } catch {
    return [];
  }
}

/** 写入账号数组。存储不可用时什么也不做。 */
function writeUsers(
  storage: LocalUsersStorage | null | undefined,
  users: LocalUser[],
): void {
  storage?.setItem(LOCAL_USERS_STORAGE_KEY, JSON.stringify(users));
}

/** 单个元素形状校验 —— 读取时只保留字段齐全的行，避免脏数据进登录逻辑。 */
function isLocalUser(value: unknown): value is LocalUser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    isStudentId(candidate.id) &&
    typeof candidate.username === "string" &&
    typeof candidate.passwordHash === "string" &&
    typeof candidate.createdAt === "string"
  );
}

// ---------------------------------------------------------------------------
// 当前用户会话（`sso.currentUser`）
// ---------------------------------------------------------------------------

/** 当前会话用户;key 与账号不同 —— 只存「当前登录的是谁」，便于顶栏展示用户名。 */
export const CURRENT_USER_STORAGE_KEY = "sso.currentUser";

/** 当前会话用户。`id` 与 `LocalUser.id` 相同，是学生身份。 */
export interface CurrentUser {
  id: string;
  username: string;
  preferredName?: string;
}

/** 读出当前会话用户；格式损坏/不可用时按未登录处理。 */
export function getCurrentUser(
  storage: LocalUsersStorage | null | undefined,
): CurrentUser | null {
  const raw = storage?.getItem(CURRENT_USER_STORAGE_KEY) ?? null;
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isCurrentUser(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** 记录当前会话用户（登录/注册成功时写）。 */
export function setCurrentUser(
  storage: LocalUsersStorage | null | undefined,
  user: CurrentUser,
): void {
  storage?.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
}

/** 清空当前会话用户（退出/切换时写）。 */
export function clearCurrentUser(
  storage: LocalUsersStorage | null | undefined,
): void {
  if (!storage) return;
  if (typeof storage.removeItem === "function") {
    storage.removeItem(CURRENT_USER_STORAGE_KEY);
  } else {
    storage.setItem(CURRENT_USER_STORAGE_KEY, "");
  }
}

/** `CurrentUser` 形状校验 —— 读取只采用字段齐全的合法值。 */
function isCurrentUser(value: unknown): value is CurrentUser {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    isStudentId(candidate.id) &&
    typeof candidate.username === "string"
  );
}

// ---------------------------------------------------------------------------
// 修改密码（演示级）
// ---------------------------------------------------------------------------

export interface ChangePasswordInput {
  id: string;
  oldPassword: string;
  newPassword: string;
}

export type ChangePasswordResult =
  { ok: true } | { ok: false; message: string };

/**
 * 修改某账号的密码（按 `id` 匹配，即当前学生身份）。
 *
 * 同样**演示级**：只做 `hashPassword` 摘要替换，没有真实安全语义。
 * 内置评审账号（test/eval）不在 `sso.localUsers` 数组里，按 id 匹配不上，
 * 会如实返回「账号不存在」—— 不偷偷给内置账号改密码。
 */
export function changePassword(
  storage: LocalUsersStorage | null | undefined,
  input: ChangePasswordInput,
): ChangePasswordResult {
  if (!isStudentId(input.id)) {
    return { ok: false, message: "无法定位当前账号。" };
  }
  if (input.newPassword.length < 6) {
    return { ok: false, message: "新密码至少 6 个字符。" };
  }
  const oldHash = hashPassword(input.oldPassword);
  const newHash = hashPassword(input.newPassword);
  if (oldHash === newHash) {
    return { ok: false, message: "新密码不能与旧密码相同。" };
  }

  const users = readUsers(storage);
  const user = users.find((item) => item.id === input.id);
  if (!user || user.passwordHash !== oldHash) {
    return { ok: false, message: "旧密码不正确或账号不存在。" };
  }

  user.passwordHash = newHash;
  writeUsers(storage, users);
  return { ok: true };
}
