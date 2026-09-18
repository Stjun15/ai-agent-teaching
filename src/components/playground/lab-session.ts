"use client";

import { ApiError, apiPost } from "@/lib/client-api";

/**
 * 沙箱的会话缓存
 *
 * 为什么需要它
 * ----------
 * 四个 Agent 里有三个（讲解 / 校验点评 / 答疑）都要求 `sessionId`：
 * `api-spec.md` 把会话当成教学流程的载体，Agent 的输出要落进那条会话里。
 * 于是沙箱每跑一次就得先有一个会话。
 *
 * 为什么按模块缓存而不是每次新建
 * --------------------------
 * 「同一个模块连着试几次」是沙箱最常见的用法（改一版 Prompt、再跑一次）。
 * 每次都新建会在 `session` 表里堆一串只有一条消息的空会话，既污染学习报告
 * 的统计、也让「我到底学过几轮」变得不可信。
 *
 * 缓存粒度是**模块**而不是全局一个：会话在库里是「学生 × 模块」的一轮学习，
 * 换模块就该是一条新会话。粒度选错的表现是「换模块后讲解 Agent 还以为是上一个
 * 模块」—— 而那种错在提示词里是看不出来的。
 *
 * 用 `Map` 而不是 `useState` 的理由见调用方：它不参与渲染。
 */
export function createSessionCache() {
  const cache = new Map<string, string>();

  return {
    /**
     * 取该模块的会话 id，没有就新建。
     *
     * 模块没选时抛出一个**能读懂**的错误，而不是让 `undefined` 一路传到服务端
     * 变成一句 `moduleId: 期望字符串` —— 后者会让学生以为是自己操作错了，
     * 而事实是他还没选。
     */
    async ensure(
      moduleId: string,
      studentId: string,
      signal: AbortSignal,
    ): Promise<string> {
      if (moduleId === "") {
        throw new ApiError(0, "INVALID_INPUT", "先选一个模块再运行。", false);
      }

      const cached = cache.get(moduleId);
      if (cached !== undefined) return cached;

      const created = await apiPost<{ sessionId: string }>(
        "/api/session",
        { studentId, moduleId },
        signal,
      );
      cache.set(moduleId, created.sessionId);
      return created.sessionId;
    },
  };
}
