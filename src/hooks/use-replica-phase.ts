"use client";

/**
 * 复刻六阶段的「学生停在第几阶段」持久化。
 *
 * 为什么必须持久化
 * --------------
 * 复刻是 180 分钟的项目模块，学生必然中途关页面、刷新、明天再来。
 * 阶段位置此前是组件 useState —— 任何一次整页刷新都把学生打回启动台、
 * 左栏全部变回未完成（2026-10-04 学生视角走查实测）。
 *
 * 为什么用 useSyncExternalStore 而不是 useState + useEffect 回读
 * ------------------------------------------------------------
 * localStorage 是「外部系统」，React 19 的正规接法就是它：水合期用
 * getServerSnapshot 渲染第 0 阶段（与服务端一致，不炸水合），挂载后
 * 切到客户端快照。这和麦克风探测（挂载后才置真）是同一个取舍，但
 * 不需要在 effect 里 setState —— `react-hooks/set-state-in-effect`
 * 会拦（见 use-speech-recognition.ts 的行级豁免注释，a4089fe）。
 *
 * 存储不按学生隔离：换账号读到的是上一个账号的阶段位置 —— 可接受，
 * 它只是「界面停在哪」，不是学习数据（掌握度/会话都按学生走库）。
 */

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ai-teaching:replicaPhase";
const CHANGE_EVENT = "ai-teaching:replica-phase-change";

/** 读阶段位置；越界或缺失一律回第 0 阶段。 */
export function readReplicaPhase(phaseCount: number): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw === null ? 0 : Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 && parsed < phaseCount
    ? parsed
    : 0;
}

export function writeReplicaPhase(index: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, String(index));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  // 同浏览器的其他标签页改了位置也跟随（storage 事件只发给其他标签页）。
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useReplicaPhase(phaseCount: number): {
  phaseIndex: number;
  setPhaseIndex: (index: number) => void;
} {
  const phaseIndex = useSyncExternalStore(
    subscribe,
    () => readReplicaPhase(phaseCount),
    () => 0,
  );
  const setPhaseIndex = useCallback((index: number) => {
    writeReplicaPhase(index);
  }, []);
  return { phaseIndex, setPhaseIndex };
}
