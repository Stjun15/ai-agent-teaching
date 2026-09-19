"use client";

/**
 * LectureLauncher —— 讲解 / 观察示范两步的自动开场
 *
 * 为什么是「自动」而不是按钮
 * ------------------------
 * 学生反馈（2026-09-19）：进入讲解步骤就该直接详细讲解，不该让他点一个
 * 「请讲讲…」按钮再发一句假提问。于是这里在「对话为空 + 空闲」时自动
 * 发起一轮**静默**请求（`send(..., { silent: true })`）：对话里不会出现
 * 「请讲讲…」的学生消息，导师直接开始 —— 就像老师走进教室就开讲，
 * 而不是等学生举手说「老师请开始」。
 *
 * 后来（同日）扩到「观察示范」步：那一步此前是**空白对话区**，学生点进去
 * 不知道该干什么（走查发现它和动手模仿长得一模一样）。示范步的正确开场
 * 是导师主动摆出一个完整的「对的」样例并逐段说明 —— 也是导师该主动做的事，
 * 同样走静默自动发起。两个步骤各用各的开场词，由工作区按步骤传入。
 *
 * 「动手模仿」刻意**不**自动开场：那一步的主体是学生自己写，导师抢话
 * 反而打扰。
 *
 * 三个防重复的闸门
 * --------------
 * 1. `attemptedRef`：本组件实例只发一次（React 严格模式 effect 会跑两遍）；
 * 2. `messages.length === 0`：对话已有内容（学生已自己提问过）就不插话；
 * 3. `status === "idle"`：正在流式输出时不发起。
 * 重挂载（切步骤再切回来）会重新尝试，但那时对话多半非空，第 2 道闸门
 * 自然挡住 —— 所以不会重复计费。
 */
import { useEffect, useRef } from "react";

import { useChatStream } from "@/hooks/useChatStream";
import { useSessionStore } from "@/stores";

/** 允许自动开场的步骤。动手模仿不在此列（理由见文件头）。 */
export type AutoLaunchStep = "explain" | "observe";

export function LectureLauncher({
  step,
  prompt,
}: {
  step: AutoLaunchStep;
  prompt: string;
}) {
  const { send } = useChatStream();
  const status = useSessionStore((state) => state.status);
  const messageCount = useSessionStore((state) => state.messages.length);
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (status !== "idle" || messageCount !== 0) return;
    attemptedRef.current = true;
    void send({ content: prompt, step }, { silent: true });
  }, [status, messageCount, prompt, step, send]);

  return null;
}
