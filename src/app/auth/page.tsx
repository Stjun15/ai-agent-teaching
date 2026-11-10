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
import { Blocks, GraduationCap, Info, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AuthBackdrop } from "@/components/auth/auth-backdrop";
import { siteConfig } from "@/lib/site";
import { LEARNING_STEPS } from "@/lib/learning-steps";
import { cn } from "@/lib/utils";
import {
  clearAuthToken,
  clearStudentId,
  currentAuthToken,
  rememberAuthToken,
  rememberStudentId,
} from "@/lib/client-identity";
import { useSessionStore } from "@/stores/session";
import { useFloatingChatStore } from "@/stores/floating-chat";

type Tab = "login" | "register";

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * 输入框：只有一条底线，不是四面描边的盒子。
 *
 * 登录页是全站唯一需要人填表的地方。描边盒子 + 圆角 + 灰底是
 * 「后台表单」的长相；一条底线更接近在纸上书写 —— 与全站的
 * 纸/墨基调一致，也让整页少掉四个方块。
 */
const inputClass = (hasError: boolean) =>
  cn(
    "w-full border-0 border-b bg-transparent px-0 py-2 text-[0.95rem] outline-none transition-colors",
    "placeholder:text-muted-foreground/45",
    "focus-visible:border-b-foreground",
    hasError ? "border-b-destructive" : "border-b-border",
  );

function readRedirectDestination(): string | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get("redirect");
  if (!raw) return null;
  // 防开放重定向：只允许站内相对路径（以 / 开头且不含 //）。
  if (!raw.startsWith("/") || raw.includes("//")) return null;
  return raw;
}

export default function AuthPage() {
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
    browserStorage()?.setItem("ai-teaching:currentUsername", username);
    // 清空前一个身份的对话缓存，避免账号切换后看到旧对话
    useSessionStore.getState().reset();
    useFloatingChatStore.getState().reset();
    // 直接读 URL 参数（不依赖 React 钩子，useEffect 在 Turbopack 下不触发）
    const redirect = readRedirectDestination();
    const dest = redirect ?? "/";
    window.location.href = dest;
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
    // 清空对话缓存，退出后不再显示前一个身份的对话
    useSessionStore.getState().reset();
    useFloatingChatStore.getState().reset();
    window.location.href = "/";
  }

  function handleDemoFill(username: string, password: string) {
    setLoginUsername(username);
    setLoginPassword(password);
    setLoginError(null);
  }

  return (
    // 外层只负责「铺满视口 + 承载背景」：背景必须比版心宽，
    // 否则笔触会被 1120px 的容器剪掉，两侧留白又变回白纸。
    <main className="relative isolate flex w-full flex-1 flex-col overflow-hidden">
      <AuthBackdrop />
      {/* 不再套 .auth-paper：可读性由背景自己的 mask 保证（背景在内容区
          自动淡到 0），不需要一层不透明纸把背景整片盖掉。 */}
      <div className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-5 py-12 sm:px-8 sm:py-20">
        {/* 扉页式两栏：左页交代「这是一门什么课」，右页是入口。
          原来是一枚居中的 logo + 标题 + 副标题 + 两张卡片 —— 那是登录页模板
          的标准长相，与首页的长卷、学习中心的条目完全不是一回事。
          左栏不是装饰：七步流程直接摆出来，人在登录前就知道自己签的是什么。 */}
        <div className="grid flex-1 items-start gap-14 lg:grid-cols-[1fr_21rem] lg:gap-20">
          {/* ---------- 左页：课程扉页 ---------- */}
          <section className="hidden lg:block">
            <p className="text-[0.75rem] font-medium tracking-[0.24em] text-primary uppercase">
              AI Native · 掌握式学习
            </p>

            <h1 className="mt-5 text-[2.8rem] leading-[1.1] font-semibold tracking-[-0.025em] text-balance">
              用 AI 教学生
              <br />
              <span className="text-primary">理解 AI</span>
            </h1>

            <p className="mt-6 max-w-[26em] leading-relaxed text-pretty text-muted-foreground">
              十二讲，每一讲都走完下面这七步。掌握度达标才解锁下一讲 ——
              没学会就不往前走，这是这门课唯一的规定。
            </p>

            <ol className="mt-10 flex flex-col border-t border-rule">
              {LEARNING_STEPS.map((step, index) => (
                <li
                  key={step.id}
                  className="flex items-baseline gap-4 border-b border-rule py-3"
                >
                  <span className="w-6 shrink-0 font-serif text-[0.95rem] text-primary tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="w-[5.5em] shrink-0 text-sm font-medium">
                    {step.label}
                  </span>
                  <span className="text-[0.8rem] leading-relaxed text-muted-foreground">
                    {step.detail}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <div>
            <div className="flex items-center gap-2.5 lg:hidden">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Blocks className="size-5" aria-hidden />
              </span>
              <span className="font-serif text-lg font-semibold">
                {siteConfig.name}
              </span>
            </div>

            <div
              role="tablist"
              aria-label="登录或注册"
              className="mt-8 flex gap-7 border-b border-rule lg:mt-0"
            >
              {(
                [
                  { id: "login", label: "登录" },
                  { id: "register", label: "注册" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  onClick={() => {
                    setTab(item.id);
                    setLoginError(null);
                    setRegError(null);
                  }}
                  aria-selected={tab === item.id}
                  className={cn(
                    "-mb-px border-b-2 pb-2.5 font-serif text-[1.05rem] transition-colors",
                    tab === item.id
                      ? "border-b-foreground font-semibold text-foreground"
                      : "border-b-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <p className="mt-5 text-[0.8rem] leading-relaxed text-muted-foreground">
              登录后将以该身份继续学习，报告与掌握度按它记录。
            </p>

            {tab === "login" ? (
              <form onSubmit={handleLogin} className="mt-8 flex flex-col gap-6">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="login-username"
                    className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
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
                    className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
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
                    className="text-[0.8rem] leading-relaxed text-danger"
                  >
                    {loginError}
                  </p>
                ) : null}

                <Button type="submit" disabled={submitting} className="h-10">
                  登 录
                </Button>

                <div className="rounded-md bg-surface px-4 py-3.5">
                  <div className="mb-2.5 flex items-center gap-1.5 text-[0.72rem] font-medium text-muted-foreground">
                    <GraduationCap className="size-3.5" aria-hidden />
                    评审演示
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleDemoFill("test", "test1234")}
                      className="flex-1 rounded border border-border bg-card px-2.5 py-1.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      test / test1234
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDemoFill("eval", "eval1234")}
                      className="flex-1 rounded border border-border bg-card px-2.5 py-1.5 text-[0.72rem] font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                    >
                      eval / eval1234
                    </button>
                  </div>
                  <p className="mt-2 text-[0.7rem] leading-relaxed text-muted-foreground/70">
                    点击按钮自动填充账号密码，然后点「登录」即可。
                  </p>
                </div>
              </form>
            ) : (
              <form
                onSubmit={handleRegister}
                className="mt-8 flex flex-col gap-6"
              >
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="reg-username"
                    className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
                  >
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
                  <label
                    htmlFor="reg-password"
                    className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
                  >
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
                  <label
                    htmlFor="reg-confirm"
                    className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase"
                  >
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
                    className="text-[0.8rem] leading-relaxed text-danger"
                  >
                    {regError}
                  </p>
                ) : null}

                <Button type="submit" disabled={submitting} className="h-10">
                  注册并登录
                </Button>
              </form>
            )}

            <div className="mt-10 border-t border-rule pt-5">
              <p className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">
                当前身份
              </p>
              <code className="mt-2 block overflow-x-auto font-mono text-[0.72rem] text-muted-foreground">
                {currentId ?? "读取中…"}
              </code>
              <p className="mt-2 flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-muted-foreground/80">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                这里显示的是当前学生身份的
                id。退出登录会把它清空，回到内置的种子学生。
              </p>
              <button
                type="button"
                onClick={handleLogout}
                className="mt-3 inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground"
              >
                <LogOut className="size-3.5" aria-hidden />
                退出登录（回到种子身份）
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
