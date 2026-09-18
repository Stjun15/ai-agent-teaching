"use client";

import * as React from "react";

import { Badge } from "@/components/ui/badge";
import {
  SettingRow,
  SettingsSection,
} from "@/components/settings/settings-section";
import { ThemeChoice } from "@/components/settings/theme-choice";
import { ApiError, apiGet } from "@/lib/client-api";
import { currentStudentId } from "@/lib/client-identity";
import { isAbortError } from "@/lib/sse";
import { useSettingsStore } from "@/stores";
import type { ArkSettings } from "@/lib/agent/ark-config";

/**
 * `/api/health` 的响应里本页用到的部分。
 *
 * 模型三项直接复用服务端 `ark-config.ts` 的 `ArkSettings`（那是纯逻辑模块，
 * 不 import SDK，两端都能引用），「模型 id 叫什么」只有一份口径。
 * 密钥状态是**本页独有的展示字段**，不进全局 store —— 全局状态只放
 * 「多个页面都要读」的东西，而它只有这里看。
 */
interface HealthConfig extends ArkSettings {
  arkApiKeyConfigured: boolean;
}

interface HealthResponse {
  checks: { config: HealthConfig };
}

/**
 * 设置页。
 *
 * 只有主题是真能改的，其余一律如实标注
 * ---------------------------------
 * `04-frontend.md` 的 SettingsStore 列了四项（模型 / 主题 / 语言 / 语音），
 * 但**当前只有主题有真实消费方**：主题能改 `<html>` 的 class 与代码编辑器的
 * 配色。另外三项的现状是：
 *
 * | 项 | 现状 | 为什么 |
 * |---|---|---|
 * | 模型 | 只能看，不能改 | 实际模型来自服务端环境变量（`ARK_TEXT_MODEL`）；没有任何路由接受 per-request 的模型参数，做一个改不了任何东西的下拉框就是「看着能用、点了没反应」 |
 * | 界面语言 | 未接入 | 界面文案当前只有中文；`locale` 影响的是文案而非内容，接它要先把文案抽出来 |
 * | 语音输入 | 未接入 | 需要录音与转写链路，属 Phase 7 |
 *
 * 把它们显示成可点的开关会让评审以为功能齐了 —— 所以这里显示为不可点的
 * 徽标 + 一句原因。这与顶栏「规划中」的处理是同一种做法。
 */
export function SettingsView() {
  const arkSettings = useSettingsStore((state) => state.arkSettings);
  const setArkSettings = useSettingsStore((state) => state.setArkSettings);
  const [configError, setConfigError] = React.useState<string | null>(null);
  const [studentId, setStudentId] = React.useState<string | null>(null);
  const [apiKeyConfigured, setApiKeyConfigured] = React.useState<
    boolean | null
  >(null);

  /**
   * 读服务端配置与学生身份。
   *
   * 身份为什么也在这里读、而不是渲染时直接调 `currentStudentId()`
   * ----------------------------------------------------------
   * 它要读 `localStorage`，而服务端渲染阶段没有 localStorage —— 渲染期调用会让
   * 服务端渲染出种子 id、浏览器渲染出本地存的 id，两边不一致触发 hydration
   * 报错。放进异步回调里读则首帧两边都是 `null`（都显示「读取中」），
   * 之后再补上，不依赖任何抑制不一致的开关。
   *
   * 状态只由 promise 回调改写，不在 effect 同步路径上 setState：后者会触发
   * 级联渲染（`react-hooks/set-state-in-effect` 会拦，已实测）。
   */
  const load = React.useCallback(
    (signal: AbortSignal): Promise<void> =>
      apiGet<HealthResponse>("/api/health", signal).then(
        (health) => {
          setArkSettings(health.checks.config);
          setApiKeyConfigured(health.checks.config.arkApiKeyConfigured);
          setStudentId(currentStudentId());
        },
        (cause: unknown) => {
          // 主动 abort（换页面）不是错误，不写进状态。
          if (isAbortError(cause)) return;
          setConfigError(
            cause instanceof ApiError ? cause.message : String(cause),
          );
        },
      ),
    [setArkSettings],
  );

  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {/* ---------- 主题（真实可用） ---------- */}
      <SettingsSection
        title="主题"
        description="立即生效，并记住你的选择。"
        badge={<Badge variant="levelLow">可用</Badge>}
      >
        <ThemeChoice />
      </SettingsSection>

      {/* ---------- 模型（只读） ---------- */}
      <SettingsSection
        title="模型"
        description="由服务端环境变量决定，页面内不可切换。"
        badge={<Badge variant="muted">只读</Badge>}
      >
        {configError !== null ? (
          <p className="text-xs leading-relaxed text-destructive">
            读取服务端配置失败：{configError}
          </p>
        ) : arkSettings === null ? (
          <p className="text-xs text-muted-foreground">正在读取服务端配置…</p>
        ) : (
          <dl className="grid gap-2 text-xs sm:grid-cols-[8rem_1fr]">
            <SettingRow label="接入点">{arkSettings.baseUrl}</SettingRow>
            <SettingRow label="文本模型">
              <code className="rounded bg-muted px-1.5 py-0.5">
                {arkSettings.textModel}
              </code>
            </SettingRow>
            <SettingRow label="多模态模型">
              <code className="rounded bg-muted px-1.5 py-0.5">
                {arkSettings.visionModel}
              </code>
            </SettingRow>
            <SettingRow label="API 密钥">
              {apiKeyConfigured === null ? (
                <span className="text-muted-foreground">读取中…</span>
              ) : apiKeyConfigured ? (
                <Badge variant="levelLow">已配置</Badge>
              ) : (
                <Badge variant="levelHigh">未配置</Badge>
              )}
            </SettingRow>
          </dl>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          改模型要改服务端的 <code>ARK_TEXT_MODEL</code> 环境变量并重启 ——
          本页不提供下拉框，因为没有路由接受按请求指定模型，
          那样的下拉框点了不会有任何变化。
        </p>
      </SettingsSection>

      {/* ---------- 学生身份（只读） ---------- */}
      <SettingsSection
        title="学生身份"
        description="所有需要认证的接口都用它认人。"
        badge={<Badge variant="muted">只读</Badge>}
      >
        <code className="block overflow-x-auto rounded bg-muted px-2 py-1.5 text-xs">
          {studentId ?? "读取中…"}
        </code>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
          库里目前没有「创建学生」的端点，所以浏览器使用种子学生身份；
          浏览器本地存了合法 id 时会优先用它。
          <strong className="font-medium">这是一个有明确边界的临时安排</strong>
          ，不是假装已经有登录 —— 真正的入口 <code>/onboarding</code>
          要等创建端点之后才谈得上。
        </p>
      </SettingsSection>

      {/* ---------- 未接入 ---------- */}
      <SettingsSection
        title="界面语言 · 语音输入"
        description="这两项尚未接入。"
        badge={<Badge variant="levelMid">未接入</Badge>}
      >
        <ul className="flex flex-col gap-2 text-xs leading-relaxed text-muted-foreground">
          <li>
            <strong className="font-medium text-foreground">界面语言</strong>
            ：界面文案当前只有中文；它影响的是文案而不是内容，
            切换要先把所有文案抽成一份可替换的表。
          </li>
          <li>
            <strong className="font-medium text-foreground">语音输入</strong>
            ：需要录音与转写链路，排在 Phase 7。
          </li>
        </ul>
      </SettingsSection>
    </div>
  );
}
