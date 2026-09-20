"use client";

/**
 * 登录 / 注册（演示级）
 *
 * 这页是「前端演示级」登录：账号只存当前浏览器的 `localStorage`
 * （key `sso.localUsers`，见 `src/lib/local-users.ts`），没有任何后端。
 * 页面上常驻一条「演示模式」提示，明确它是非真实鉴权 —— 与项目『不要假装
 * 有能力』纪律一致，这里不出现任何假后端、假安全的描述。
 *
 * 登录/注册成功后发生什么
 * --------------------
 * 并不是「认证」，而是**替换种子身份**：把新账号生成的 `id`（本身就是合法
 * 学生 UUID）写进现有学生身份存储（`clearStudentId` / `rememberStudentId`），
 * 让报告 / 掌握度 / 学习路径按新身份走。退出登录则清空身份、退回种子学生。
 *
 * 身份为什么在回调里读、不在渲染时读
 * --------------------------------
 * 见 `settings-view.tsx` 同款注释：渲染期读 `localStorage` 会让服务端首帧与
 * 客户端不一致触发 hydration 报错。放进 effect 里读则首帧两边都是「读取中」。
 */
import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, LogOut, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  clearStudentId,
  currentStudentId,
  rememberStudentId,
} from "@/lib/client-identity";
import {
  LOCAL_USERS_STORAGE_KEY,
  clearCurrentUser,
  loginUser,
  registerUser,
  setCurrentUser,
  type LocalUsersStorage,
  type RegisterError,
} from "@/lib/local-users";

type Tab = "login" | "register";

/** `localStorage` 同时满足两种读写的形状（含删除）。不可用时返回 null。 */
function browserStorage():
  (LocalUsersStorage & { removeItem: (k: string) => void }) | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** 展示型输入框的共享外观（与 `LabInput` 一致）。 */
const inputClass = (hasError: boolean) =>
  cn(
    "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring",
    hasError && "border-destructive",
  );

/** 字段错误文案（以最后一次为准；同一字段可能有多条）。 */
function fieldError(errors: RegisterError[], field: RegisterError["field"]) {
  return errors
    .filter((item) => item.field === field)
    .map((item) => item.message)
    .join("；");
}

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<Tab>("login");

  // 登录表单
  const [loginUsername, setLoginUsername] = React.useState("");
  const [loginPassword, setLoginPassword] = React.useState("");
  const [loginError, setLoginError] = React.useState<string | null>(null);

  // 注册表单
  const [regUsername, setRegUsername] = React.useState("");
  const [regPassword, setRegPassword] = React.useState("");
  const [regConfirm, setRegConfirm] = React.useState("");
  const [regErrors, setRegErrors] = React.useState<RegisterError[]>([]);

  const [submitting, setSubmitting] = React.useState(false);

  // 当前身份（用于展示 + 退出）—— 在异步回调里读，避免首帧 hydration 不一致
  // 与 effect 同步 setState（见设置页同款取舍，`react-hooks/set-state-in-effect`）。
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (alive) setCurrentId(currentStudentId());
    });
    return () => {
      alive = false;
    };
  }, []);

  /** 登录成功后替换身份、记录当前会话用户，并返回首页。 */
  function adoptIdentity(id: string, username: string, preferredName: string) {
    rememberStudentId(id, browserStorage());
    setCurrentUser(browserStorage(), { id, username, preferredName });
    router.push("/");
  }

  function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      const result = loginUser(browserStorage(), {
        username: loginUsername,
        password: loginPassword,
      });
      if (result.ok) {
        adoptIdentity(result.id, result.username, result.preferredName);
        return;
      }
      setLoginError(result.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setRegErrors([]);
    setSubmitting(true);
    try {
      const result = registerUser(browserStorage(), {
        username: regUsername,
        password: regPassword,
        confirmPassword: regConfirm,
      });
      if (result.ok) {
        adoptIdentity(result.id, result.username, result.preferredName);
        return;
      }
      setRegErrors(result.errors);
    } finally {
      setSubmitting(false);
    }
  }

  /** 退出：清空身份与会话用户，回到种子，再去首页。 */
  function handleLogout() {
    clearStudentId(browserStorage());
    clearCurrentUser(browserStorage());
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-6">
        {/* 常驻「演示模式」诚实提示 */}
        <div
          role="note"
          className="flex items-start gap-3 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <ShieldOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">演示模式</span>
            <span className="text-xs leading-relaxed">
              账号只存在这台浏览器的本机 localStorage，没有后端、不是真实鉴权，
              清除浏览器数据即丢失。仅用于演示登录形态，请勿用于真实场景。
            </span>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>账户登录</CardTitle>
            <CardDescription>
              登录后将以该身份继续学习，报告与掌握度按它记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* 双 tab */}
            <div className="flex gap-2">
              {(
                [
                  { id: "login", label: "登录" },
                  { id: "register", label: "注册" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setTab(item.id);
                    setLoginError(null);
                    setRegErrors([]);
                  }}
                  aria-pressed={tab === item.id}
                  className={cn(
                    "rounded-lg border px-4 py-1.5 text-sm transition-colors",
                    tab === item.id
                      ? "border-ring bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:border-ring/60 hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="login-username"
                    className="text-xs font-medium"
                  >
                    用户名
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    autoComplete="username"
                    value={loginUsername}
                    onChange={(e) => setLoginUsername(e.target.value)}
                    placeholder="用户名"
                    className={inputClass(false)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="login-password"
                    className="text-xs font-medium"
                  >
                    密码
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="密码"
                    className={inputClass(false)}
                  />
                </div>

                {loginError ? (
                  <p
                    role="alert"
                    className="text-xs leading-relaxed text-destructive"
                  >
                    {loginError}
                  </p>
                ) : null}

                <Button type="submit" disabled={submitting}>
                  登 录
                </Button>

                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  评审演示账号：用户名 <code>test</code> 或 <code>eval</code>
                  ，密码 <code>test1234</code> 或 <code>eval1234</code>
                  （一一对应）。
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-username" className="text-xs font-medium">
                    用户名
                  </label>
                  <input
                    id="reg-username"
                    type="text"
                    autoComplete="username"
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="用户名（2–32 个字符）"
                    className={inputClass(
                      fieldError(regErrors, "username") !== "",
                    )}
                  />
                  {fieldError(regErrors, "username") ? (
                    <p className="text-[11px] text-destructive">
                      {fieldError(regErrors, "username")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-password" className="text-xs font-medium">
                    密码
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    autoComplete="new-password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="密码（至少 6 个字符）"
                    className={inputClass(
                      fieldError(regErrors, "password") !== "",
                    )}
                  />
                  {fieldError(regErrors, "password") ? (
                    <p className="text-[11px] text-destructive">
                      {fieldError(regErrors, "password")}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="reg-confirm" className="text-xs font-medium">
                    确认密码
                  </label>
                  <input
                    id="reg-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={regConfirm}
                    onChange={(e) => setRegConfirm(e.target.value)}
                    placeholder="再次输入密码"
                    className={inputClass(
                      fieldError(regErrors, "confirmPassword") !== "",
                    )}
                  />
                  {fieldError(regErrors, "confirmPassword") ? (
                    <p className="text-[11px] text-destructive">
                      {fieldError(regErrors, "confirmPassword")}
                    </p>
                  ) : null}
                </div>

                <Button type="submit" disabled={submitting}>
                  注册并登录
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* 当前身份 + 退出 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              当前身份
              <Badge variant="muted">演示</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">
              {currentId ?? "读取中…"}
            </code>
            <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              这里显示的是当前学生身份的
              id。退出登录会把它清空，回到内置的种子学生。
            </p>
            <Button
              type="button"
              variant="outline"
              onClick={handleLogout}
              className="self-start"
            >
              <LogOut className="size-4" aria-hidden />
              退出登录（回到种子身份）
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-muted-foreground">
          账号数据存储键：<code>{LOCAL_USERS_STORAGE_KEY}</code>
        </p>
      </div>
    </main>
  );
}
