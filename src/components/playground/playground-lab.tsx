"use client";

import * as React from "react";
import { FlaskConical, Play } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LabInput, LabTabs } from "@/components/playground/lab-controls";
import {
  LAB_EXPERIMENTS,
  findExperiment,
} from "@/components/playground/lab-experiments";
import { OutcomeView } from "@/components/playground/lab-outcome";
import { createSessionCache } from "@/components/playground/lab-session";
import {
  coerceValue,
  type LabOutcome,
} from "@/components/playground/lab-types";
import { ApiError, NETWORK_ERROR_CODE, apiPostTimed } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { isAbortError } from "@/lib/sse";
import type { PlaygroundModule } from "@/components/playground/lab-types";

/**
 * 沙箱实验室的流程编排。
 *
 * 为什么要把「实际发出的请求体」也显示出来
 * ---------------------------------------
 * 沙箱的教学目标不是「跑出结果」，而是**看懂接口契约**：
 * 学生在模块页点的是按钮，看不到背后发了什么。这里把它摊开 ——
 * 字段名、类型、以及服务端按 Zod 校验后的报错原文，全都在屏幕上。
 *
 * 为什么失败也照原样显示，而不是翻译成「操作失败」
 * ---------------------------------------------
 * 见 `lab-outcome.tsx`：错误码与文案本身就是要展示的内容。
 *
 * 本组件只负责「流程」，不负责画控件
 * ------------------------------
 * 输入控件在 `lab-controls.tsx`（纯展示），结果面板在 `lab-outcome.tsx`，
 * 会话缓存在 `lab-session.ts`。这样这个文件的每一行都在讲「数据怎么流」。
 */
export function PlaygroundLab({
  modules,
}: {
  modules: readonly PlaygroundModule[];
}) {
  const [experimentId, setExperimentId] = React.useState(LAB_EXPERIMENTS[0].id);
  const [raw, setRaw] = React.useState<Record<string, string>>({});
  const [outcome, setOutcome] = React.useState<LabOutcome | null>(null);
  const [running, setRunning] = React.useState(false);
  // `useState` 的惰性初始化：整个组件生命周期里只 new 一次缓存。
  // 直接 `useRef(createSessionCache())` 会在每次渲染都白造一个对象。
  const [sessions] = React.useState(createSessionCache);
  const controllerRef = React.useRef<AbortController | null>(null);

  const experiment = findExperiment(experimentId) ?? LAB_EXPERIMENTS[0];

  // 卸载即中断：留在页面上的请求会白烧一次模型调用。
  React.useEffect(() => () => controllerRef.current?.abort(), []);

  const setField = React.useCallback((key: string, value: string): void => {
    setRaw((previous) => ({ ...previous, [key]: value }));
  }, []);

  async function run(): Promise<void> {
    if (running) return;
    setRunning(true);
    setOutcome(null);

    const controller = new AbortController();
    controllerRef.current = controller;
    const studentId = currentStudentId();
    const values = Object.fromEntries(
      experiment.fields.map((field) => [
        field.key,
        coerceValue(field, raw[field.key] ?? ""),
      ]),
    );
    let request: unknown = null;

    try {
      let sessionId: string | null = null;
      if (experiment.needsSession) {
        // 模块字段由清单声明（键名叫 moduleId 还是 currentModule 由它决定），
        // 这里不去猜 —— 猜错的表现是「选了模块却报模块是必填」。
        const moduleField = experiment.fields.find(
          (field) => field.source === "modules",
        );
        sessionId = await sessions.ensure(
          moduleField === undefined
            ? ""
            : String(values[moduleField.key] ?? ""),
          studentId,
          controller.signal,
        );
      }

      request = experiment.build(values, { studentId, sessionId });
      const { data, ms } = await apiPostTimed(
        experiment.endpoint,
        request,
        controller.signal,
      );
      setOutcome({ ok: true, request, data, ms });
    } catch (error) {
      if (isAbortError(error)) return;
      const apiError =
        error instanceof ApiError
          ? error
          : new ApiError(
              0,
              NETWORK_ERROR_CODE,
              error instanceof Error ? error.message : String(error),
              true,
            );
      setOutcome({
        ok: false,
        request,
        code: apiError.code,
        message: apiError.message,
        recoverable: apiError.recoverable,
        ms: apiError.durationMs ?? 0,
      });
    } finally {
      controllerRef.current = null;
      setRunning(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <LabTabs
        experiments={LAB_EXPERIMENTS}
        activeId={experimentId}
        onSelect={(id) => {
          setExperimentId(id);
          setOutcome(null);
        }}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-label="参数" className="flex flex-col gap-4">
          <header className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">
                <FlaskConical />
                {experiment.agentLabel}
              </Badge>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                POST {experiment.endpoint}
              </code>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {experiment.description}
            </p>
          </header>

          <div className="flex flex-col gap-3">
            {experiment.fields.map((field) => (
              <LabInput
                key={field.key}
                field={field}
                modules={modules}
                value={raw[field.key] ?? ""}
                onChange={(value) => setField(field.key, value)}
              />
            ))}
          </div>

          <Button
            type="button"
            onClick={run}
            disabled={running}
            className="w-fit"
          >
            <Play className="size-4" />
            {running ? "运行中…" : "运行"}
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {experiment.usesModel === false
              ? "这个能力不调模型：检索在本地完成，毫秒级返回，不消耗 token。"
              : "每次运行都会真实调用模型：要等几秒，也真的消耗 token。"}
          </p>
        </section>

        <section aria-label="结果" className="flex min-w-0 flex-col gap-3">
          {running ? (
            <p className="text-xs leading-relaxed text-muted-foreground">
              等待服务端返回…
            </p>
          ) : (
            <OutcomeView outcome={outcome} />
          )}
        </section>
      </div>
    </div>
  );
}
