"use client";

/**
 * 把后端的学生数据灌进 `StudentStore`
 *
 * 为什么要有这个 hook
 * ------------------
 * 学习页的掌握度卡（`mastery-card.tsx`）读的是 `StudentStore`，不是直接打接口。
 * 而 `StudentStore.hydrate` **一直没有任何调用方** —— 结果就是卡片恒显示
 * 「尚未测评」，哪怕库里这个学生已经有 3 条掌握度记录。
 * 这不是显示 bug，是数据源没接：端点 `/api/student/profile`、`mastery`、
 * `learning-path` 早就建好了（store 的文件头写明「拿到数据后调这里的 hydrate」），
 * 缺的就是这一段。
 *
 * 为什么是三个接口一起拉
 * -------------------
 * hydrate 的输入本来就是这三块（画像 / 掌握度 / 学习路径），分开 hydrate 会让
 * 页面出现「先显示掌握度、半秒后画像才到」的中间态。一次 Promise.all 灌进去。
 *
 * 失败时怎么办
 * ----------
 * **什么都不做**：store 维持 `loaded: false`，掌握度卡继续显示「尚未测评」。
 * 这比显示 0% 正确（0% 与没测过是两件事），也比弹一个全站错误条正确 ——
 * 学生数据取不到，不该挡住学生继续学习。取数失败会在下次导航时重试
 * （`loaded` 仍是 false）。
 */

import * as React from "react";

import { apiGet } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { isAbortError } from "@/lib/sse";
import { useStudentStore } from "@/stores";
import type { LearningPath, Mastery, StudentProfile } from "@/lib/db/types";

/** 三个端点的响应形状。字段与路由返回体逐字对应（改一边另一边编译报错）。 */
interface ProfileResponse {
  profile: StudentProfile | null;
}
interface MasteryResponse {
  mastery: Mastery[];
}
interface LearningPathResponse {
  learningPath: LearningPath | null;
}

export function useStudentHydrate(): void {
  const loaded = useStudentStore((state) => state.loaded);
  const hydrate = useStudentStore((state) => state.hydrate);

  React.useEffect(() => {
    // 已经灌过就不再拉。SPA 导航不重新挂载外壳，这条判据同时挡住了
    // 「每次换页都重拉一遍全量学生数据」。
    if (loaded) return;

    const controller = new AbortController();
    const signal = controller.signal;

    void Promise.all([
      apiGet<ProfileResponse>("/api/student/profile", signal),
      apiGet<MasteryResponse>("/api/student/mastery", signal),
      apiGet<LearningPathResponse>("/api/student/learning-path", signal),
    ]).then(
      ([profile, mastery, learningPath]) => {
        // 三个都拿到了才 hydrate：灌一半会让「没取到」和「取到了是空」
        // 在界面上长得一样（都是空列表 / 尚未测评）。
        hydrate({
          studentId: currentStudentId(),
          profile: profile.profile,
          mastery: mastery.mastery,
          learningPath: learningPath.learningPath,
        });
      },
      (cause: unknown) => {
        // 主动 abort 不是失败：换页 / 卸载时的取消不该被当成取数失败。
        if (isAbortError(cause)) return;
        console.warn("[student-hydrate] 学生数据取数失败：", cause);
      },
    );

    return () => controller.abort();
  }, [loaded, hydrate]);
}
