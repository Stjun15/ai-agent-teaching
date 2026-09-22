"use client";

/**
 * 登录 / 注册 —— 真实鉴权（JWT 令牌）
 *
 * 登录：POST /api/auth/login → { token, studentId, username }
 * 注册：POST /api/auth/register → { token, studentId, username }
 *
 * 令牌存浏览器 localStorage（key `ai-teaching:authToken`），
 * 后续所有需要认证的请求由 `authHeaders()` 自动带 token 头。
 * 未登录时回退到种子学生身份的 `x-student-id` 头。
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, LogOut } from "lucide-react";

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
  clearAuthToken,
  clearStudentId,
  currentAuthToken,
  rememberAuthToken,
  rememberStudentId,
} from "@/lib/client-identity";

type Tab = "login" | "register";

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const inputClass = (hasError: boolean) =>
  cn(
    "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm outline-none focus-visible:border-ring",
    hasError && "border-destructive",
  );

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
  const [regError, setRegError] = React.useState<string | null>(null);

  const [submitting, setSubmitting] = React.useState(false);

  // 当前身份展示。渲染期不读 localStorage（hydration）。
  const [currentId, setCurrentId] = React.useState<string | null>(null);
  React.useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => {
      if (!alive) return;
      // 优先显示 token 里解析出的 studentId；没有则退回种子身份。
      const token = currentAuthToken();
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split(".")[1])) as {
            sub: string;
          };
          setCurrentId(payload.sub);
        } catch {
          setCurrentId(null);
        }
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  function adoptIdentity(id: string, token: string, username: string) {
    rememberStudentId(id, browserStorage());
    rememberAuthToken(token, browserStorage());
    // 同时记一个简单用户名供顶栏展示
    browserStorage()?.setItem("ai-teaching:currentUsername", username);
    router.push("/");
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim(),
          password: loginPassword,
        }),
      });
      if (!res.ok) {
        let message = "登录失败，请稍后再试。";
        try {
          const body = (await res.json()) as {
            error?: { message?: string };
          };
          message = body.error?.message ?? message;
        } catch {
          /* ignore parse error */
        }
        setLoginError(message);
        return;
      }
      const data = (await res.json()) as {
        token: string;
        studentId: string;
        username: string;
      };
      adoptIdentity(data.studentId, data.token, data.username);
    } catch {
      setLoginError("网络错误，请检查连接后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setRegError(null);

    if (regPassword !== regConfirm) {
      setRegError("两次输入的密码不一致。");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim(),
          password: regPassword,
        }),
      });
      if (!res.ok) {
        let message = "注册失败，请稍后再试。";
        try {
          const body = (await res.json()) as {
            error?: { message?: string };
          };
          message = body.error?.message ?? message;
        } catch {
          /* ignore */
        }
        setRegError(message);
        return;
      }
      const data = (await res.json()) as {
        token: string;
        studentId: string;
        username: string;
      };
      adoptIdentity(data.studentId, data.token, data.username);
    } catch {
      setRegError("网络错误，请检查连接后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  function handleLogout() {
    clearStudentId(browserStorage());
    clearAuthToken(browserStorage());
    browserStorage()?.removeItem?.("ai-teaching:currentUsername");
    router.push("/");
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-12 sm:py-16">
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>账户登录</CardTitle>
            <CardDescription>
              登录后将以该身份继续学习，报告与掌握度按它记录。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
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
                    setRegError(null);
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
                    className={inputClass(false)}
                  />
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
                    className={inputClass(false)}
                  />
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
                    className={inputClass(false)}
                  />
                </div>

                {regError ? (
                  <p
                    role="alert"
                    className="text-xs leading-relaxed text-destructive"
                  >
                    {regError}
                  </p>
                ) : null}

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
              <Badge variant="muted">JWT 鉴权</Badge>
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
          JWT 令牌存储在浏览器的 localStorage。
        </p>
      </div>
    </main>
  );
}
