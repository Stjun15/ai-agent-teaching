"use client";

/**
 * LectureLauncher —— 讲解 / 观察示范两步的自动开场（缓存优先）
 *
 * 为什么是「自动」而不是按钮
 * ------------------------
 * 学生反馈（2026-09-19）：进入讲解步骤就该直接详细讲解，不该让他点一个
 * 「请讲讲…」按钮再发一句假提问。于是这里在「该步骤还没开过场 + 空闲」时
 * 自动发起：对话里不会出现「请讲讲…」的学生消息，导师直接开始 —— 就像
 * 老师走进教室就开讲，而不是等学生举手说「老师请开始」。
 *
 * 「点开即有」（同日第二次反馈）
 * ---------------------------
 * 学生接着问：「概念讲解不是提前准备好的吗？为什么打开就显示等待模型
 * 响应？」—— 此前每次进入都是现场发起一次真实模型调用（实测 35~42 秒），
 * 而且对话只存内存、刷新即重来。现在改为**缓存优先**：
 *
 *   1. 先 GET `/api/lecture-cache`（本地 SQLite 读，毫秒级）；
 *   2. 命中 → `seedLecture` 直接把讲稿作为已完成的助手消息放进对话，
 *      零等待、零模型调用；
 *   3. 未命中（新部署还没跑预生成脚本）→ 回退为原有的实时生成，
 *      保证功能可用，只是要等。
 *
 * 缓存的生成与失效策略见 `scripts/generate-lecture-cache.mjs` 与
 * `lecture_cache` 表的迁移文件头。
 *
 * 「动手模仿」刻意**不**自动开场：那一步的主体是学生自己写，导师抢话
 * 反而打扰。
 *
 * 三道防重复的闸门
 * --------------
 * 1. `attemptedRef`：本组件实例只尝试一次（React 严格模式 effect 跑两遍）；
 * 2. 按步骤判断：对话里**已有属于本步骤的消息**（学生问过 / 已开过场）就不动；
 * 3. `status === "idle"`：正在流式输出时不发起。
 *
 * 闸门 2 为什么不能用旧版的 `messages.length === 0`：讲解三步共用**同一个**
 * 对话区，而步骤是三条独立路由 —— 学生在讲解步看过讲稿后切到「观察示范」，
 * 对话区里已有讲解的消息，旧闸门会把示范步的开场永远挡死（示范步空白）。
 * 消息带 `step` 标签后（见 session.ts 的 ChatMessage），按步骤各判各的。
 * 缓存请求是异步的，返回后要**复查**闸门 2/3 —— 等待的几十毫秒里学生可能
 * 已经自己开口了。
 */
import { useEffect, useRef } from "react";

import { useChatStream } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores";
import type { AutoLectureStep } from "@/lib/lecture-openers";

/** 允许自动开场的步骤。动手模仿不在此列（理由见文件头）。 */
export type { AutoLectureStep };

/** 缓存命中响应的形状守卫：`{ found: true, content: string }`。 */
function isCachedLecture(value: unknown): value is { content: string } {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return record.found === true && typeof record.content === "string";
}

export function LectureLauncher({
  moduleId,
  step,
  prompt,
}: {
  /** 讲稿缓存按模块检索用。 */
  moduleId: string;
  step: AutoLectureStep;
  /** 缓存未命中时实时生成的开场词（与预生成脚本共用一份定义）。 */
  prompt: string;
}) {
  const { send } = useChatStream();
  const status = useSessionStore((state) => state.status);
  const messages = useSessionStore((state) => state.messages);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (status !== "idle") return;
    if (messages.some((message) => message.step === step)) return;
    attemptedRef.current = true;

    void (async () => {
      // ---- 第一优先：预生成缓存（点开即有）----
      try {
        const response = await fetch(
          `/api/lecture-cache?moduleId=${encodeURIComponent(moduleId)}&step=${step}`,
        );
        if (response.ok) {
          const data: unknown = await response.json();
          if (isCachedLecture(data)) {
            const state = useSessionStore.getState();
            // 异步等待期间学生可能已自己发消息，注入前复查两道闸门。
            if (
              state.status === "idle" &&
              !state.messages.some((message) => message.step === step)
            ) {
              state.seedLecture(step, data.content);
              return;
            }
          }
        }
      } catch {
        // 缓存读不到（端点异常 / 网络问题）不算失败，走下面的实时生成。
      }

      // ---- 回退：实时生成（与改造前行为一致）----
      const state = useSessionStore.getState();
      if (state.status !== "idle") return;
      if (state.messages.some((message) => message.step === step)) return;
      await send({ content: prompt, step }, { silent: true, moduleId });
    })();
  }, [status, messages, moduleId, step, prompt, send]);

  return null;
}
