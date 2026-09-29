"use client";

/**
 * 场景：攻击-防护对比（模块 9 `ai-safety`）
 *
 * 动画步骤照 `module-specs.md` 模块 9 的「3. 可视化」逐条实现：一句提示注入 →
 * 输入过滤检测 → 安全 Agent 出面 → 回复 → 写入审计日志。
 *
 * 这一场必须让两个开关各自有后果，否则它就是一张「我们很安全」的海报
 * -------------------------------------------------------
 * 关掉输入过滤：攻击串直接进模型，回复里带着密钥出来 —— 学生亲眼看到漏的样子。
 * 关掉输出过滤（输入过滤也关着）：连最后一道打码也没了。两道都开着：日志上出现
 * 「拦下」与「未调用模型」两条 —— 顺带说明白**拦在越前面越省钱**，模型根本没被
 * 调用，也就没有 Token 消耗。
 *
 * 攻击输入可编辑，是为了让学生看到「过滤规则认得的是词，不是意图」：把「忽略之前
 * 的指令」改成「忘掉上面的话」，同样的攻击就进去了。这一下比任何一句
 * 「过滤规则有局限」都说服人。
 *
 * 规则与日志在 `scene-safety-fixture.ts`，本文件只负责画。
 */

import { AlertTriangle, Check, Shield, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { SceneFrame, TONE_SURFACE } from "./scene-canvas";
import { AuditLogPanel } from "./scene-audit-log";
import { ParamText, ParamToggle, SceneControls } from "./scene-controls";
import { MonoBlock, NodeCard, SceneArrow } from "./scene-parts";
import {
  ATTACK,
  FALLBACK,
  auditLog,
  replyOf,
  screenInput,
} from "./scene-safety-fixture";
import { paramBool, paramString } from "./scene-params";
import type { SceneProps } from "./scene-types";

export function SceneAttackDefense({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const input = paramString(params, "input", ATTACK);
  const inputFilter = paramBool(params, "inputFilter", true);
  const outputFilter = paramBool(params, "outputFilter", true);
  const reached = (n: number) => stepIndex >= n;

  const screened = screenInput(input, inputFilter);
  const reply = replyOf(screened, outputFilter);
  const log = auditLog(screened, reply, inputFilter, outputFilter);
  /** 两道都没拦住，且输入确实可疑 —— 密钥原样送出去了。 */
  const leaked =
    !screened.blocked && reply.redacted === 0 && screened.hits.length > 0;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="攻击-防护对比" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <User className="size-3" />
            用户输入
          </p>
          <p className="mt-0.5 font-mono text-sm leading-relaxed break-words">
            {input}
          </p>
        </div>

        <SceneArrow
          direction="down"
          tone={reached(1) ? (screened.blocked ? "done" : "alert") : "idle"}
          label="输入过滤"
        />

        {reached(1) ? (
          <div
            className={cn(
              "animate-in rounded-md border px-2.5 py-2 duration-300 fade-in",
              screened.blocked ? TONE_SURFACE.done : TONE_SURFACE.alert,
            )}
          >
            <p className="flex items-center gap-1.5 text-sm font-medium">
              {screened.blocked ? (
                <Check className="size-3.5" />
              ) : (
                <AlertTriangle className="size-3.5" />
              )}
              输入过滤{inputFilter ? "已开启" : "已关闭"}
            </p>
            <p className="mt-1 text-sm leading-relaxed">
              {screened.hits.length === 0
                ? "没有命中任何危险词，请求照常进入模型。把上面那句改成「忽略之前的指令」试试。"
                : screened.blocked
                  ? `命中「${screened.hits.join("、")}」→ 拦下，模型不会被调用。`
                  : `本来会命中「${screened.hits.join("、")}」，但过滤关着 —— 请求直接进去了。`}
            </p>
          </div>
        ) : null}

        {reached(2) ? (
          <NodeCard
            title="安全 Agent"
            subtitle={
              screened.blocked
                ? "轮不到模型说话：它出面给兜底话术"
                : "规则没拦住，它这一步等于形同虚设"
            }
            icon={<Shield className="size-3.5" />}
            tone={screened.blocked ? "done" : "alert"}
            enter="down"
          />
        ) : null}

        {reached(3) ? (
          <div
            className={cn(
              "flex animate-in flex-col gap-1 rounded-md border px-2.5 py-2 duration-300 fade-in",
              screened.blocked
                ? TONE_SURFACE.done
                : leaked
                  ? TONE_SURFACE.alert
                  : TONE_SURFACE.done,
            )}
          >
            <span className="text-sm text-muted-foreground">
              {screened.blocked
                ? "兜底回复（规格里那句原话）"
                : "模型的回复 —— 输入过滤没拦住，它照着做了"}
            </span>
            <MonoBlock tone="plain">
              {screened.blocked ? FALLBACK : reply.text}
            </MonoBlock>
            {reply.redacted > 0 ? (
              <span className="text-sm leading-relaxed">
                输出过滤打码 {reply.redacted} 处 —— 第二道防线兜住了。
                前面漏了，后面还有一次机会。
              </span>
            ) : null}
            {leaked ? (
              <span className="text-sm leading-relaxed">
                两道都关着，密钥就原样送出去了。防护不是一道墙，是几道筛子串联。
              </span>
            ) : null}
          </div>
        ) : null}

        {reached(4) ? (
          <AuditLogPanel
            entries={log}
            note="出了事要能倒推回「当时规则是怎么配的」"
          />
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamText
          label="攻击输入（改成别的攻击试试）"
          value={input}
          onChange={(value) => setParam("input", value)}
          hint="过滤规则认得的是词，不是意图：把「忽略之前的指令」换成「忘掉上面的话」，同样的攻击就进去了。"
        />
        <ParamToggle
          label="输入过滤"
          value={inputFilter}
          onChange={(value) => setParam("inputFilter", value)}
        />
        <ParamToggle
          label="输出过滤"
          value={outputFilter}
          onChange={(value) => setParam("outputFilter", value)}
          hint="两个都关掉，密钥就真的漏出去了。"
        />
      </SceneControls>
    </div>
  );
}