"use client";

/**
 * 场景：MCP 调用流程（模块 8 `mcp`）
 *
 * 动画步骤照 `module-specs.md` 模块 8 的「3. 可视化」逐条实现：Agent 提出需要 →
 * MCP Client 出现、工具列表展开 → 选中一个工具、请求飞向 MCP Server →
 * Server 转成一次真实的外部调用 → 结果流回 Agent。
 *
 * 这一场要讲清楚的是「谁的活是谁的」
 * -------------------------------
 * 学生最容易糊的是 MCP Client 与 MCP Server 的分工。所以这条链上有明确的四段，
 * 每段都有名字：Agent 只表达意图 → Client 负责发现与转发 → Server 负责对接外部
 * 世界 → 外部服务真的干活。把 Server 和「外部服务」画成两张卡而不是一张，
 * 就是为了这个：Server 不是那个数据库，它只是通往数据库的那道门。
 *
 * 「描述为空」为什么值得一个开关
 * --------------------------
 * 模块 8 的校验规则里「工具描述」占 25 分，可描述在界面上只是一行灰字，学生
 * 没有理由认真写。这个开关把后果演出来：描述一空，模型只能靠名字猜该不该调用，
 * 于是**这条链在第二步就走不下去** —— 箭头到不了 Server。一个 0.5 秒能试一下的
 * 开关，比一句「描述很重要」有用得多。
 *
 * 两台 server 的工具表在 `scene-mcp-fixture.ts`，本文件只负责画。
 */

import { AlertTriangle, Bot, Globe, Plug, Server } from "lucide-react";

import { SceneFrame, SceneRow } from "./scene-canvas";
import { ParamChoice, ParamToggle, SceneControls } from "./scene-controls";
import { MonoBlock, NodeCard, SceneArrow, ToolCard } from "./scene-parts";
import { SERVERS, findServer, findTool } from "./scene-mcp-fixture";
import { paramBool, paramString } from "./scene-params";
import type { SceneProps } from "./scene-types";

/** Agent 提出的需求。它只说想要什么，不指定用哪个工具 —— 那是 Client 的事。 */
const INTENT = "我需要搜索最新资料";

export function SceneMcpFlow({
  stepIndex,
  caption,
  params,
  setParam,
}: SceneProps) {
  const server = findServer(paramString(params, "server", SERVERS[0].id));
  const tool = findTool(
    server,
    paramString(params, "tool", server.tools[0].name),
  );
  const blank = paramBool(params, "blank", false);
  const reached = (n: number) => stepIndex >= n;
  /** 描述为空：模型判断不了该不该调，链子在选工具这一步就断了。 */
  const stalled = blank;

  return (
    <div className="flex flex-col gap-2">
      <SceneFrame label="MCP 调用流程" caption={caption}>
        <div className="rounded-md border border-border bg-background px-2.5 py-1.5">
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <Bot className="size-3" />
            Agent
          </p>
          <p className="mt-0.5 text-sm">{INTENT}</p>
        </div>

        <SceneArrow
          direction="down"
          tone={reached(1) ? "done" : "idle"}
          label="连接 Client"
        />

        {reached(1) ? (
          <div className="flex animate-in flex-col gap-1.5 rounded-md border border-border bg-card px-2.5 py-2 duration-300 fade-in">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <Plug className="size-3.5" />
              MCP Client
              <span className="font-mono font-normal text-muted-foreground">
                {server.name} · {server.url}
              </span>
            </p>
            <p className="text-sm text-muted-foreground">
              listTools() 拿到的工具 —— Agent 不必预先知道有什么可用
            </p>
            <SceneRow className="items-stretch">
              {server.tools.map((item) => {
                const isActive = item.name === tool.name;
                return (
                  <ToolCard
                    key={item.name}
                    name={item.name}
                    description={
                      isActive && blank ? "（描述为空）" : item.description
                    }
                    tone={isActive ? "active" : "idle"}
                    selected={isActive}
                    trouble={isActive && blank}
                    onSelect={() => setParam("tool", item.name)}
                  />
                );
              })}
            </SceneRow>
          </div>
        ) : null}

        {reached(1) && stalled ? (
          <p className="flex animate-in items-start gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1.5 text-sm leading-relaxed text-rose-900 duration-300 fade-in dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            描述为空，模型只能靠名字猜该不该用它 ——
            这个工具等于不存在。调用链在第二步就断了。
          </p>
        ) : null}

        <SceneArrow
          direction="down"
          tone={stalled ? "alert" : reached(2) ? "done" : "idle"}
          label={stalled ? "调用不成立" : `callTool("${tool.name}")`}
        />

        {reached(2) ? (
          <div className="flex flex-col gap-2">
            <MonoBlock tone="boxed">{`参数 ${tool.params}`}</MonoBlock>
            <NodeCard
              title={`MCP Server · ${server.name}`}
              subtitle="它不认识 Agent 的需要，只认识工具名 —— 把一次调用翻译成一次对外请求"
              icon={<Server className="size-3.5" />}
              tone={stalled ? "alert" : "active"}
              enter="none"
            />
          </div>
        ) : null}

        <SceneArrow
          direction="down"
          tone={reached(3) ? "done" : "idle"}
          label="真的去取"
        />

        {reached(3) ? (
          <NodeCard
            title={`外部服务 · ${tool.service}`}
            subtitle="真正干活的是它。Server 只是通往它的一道门 —— 换台 Server，这里就换了。"
            icon={<Globe className="size-3.5" />}
            tone="done"
            enter="none"
          />
        ) : null}

        {reached(4) ? (
          <div className="flex animate-in flex-col gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2 duration-300 fade-in dark:border-emerald-900 dark:bg-emerald-950/40">
            <span className="text-sm text-muted-foreground">
              结果流回 Agent —— 它拿到的是内容，看不到中间经过了谁
            </span>
            <MonoBlock tone="boxed">{tool.result}</MonoBlock>
          </div>
        ) : null}
      </SceneFrame>

      <SceneControls label="本场景的可调参数">
        <ParamChoice
          label="模拟哪台 MCP Server"
          value={server.id}
          options={SERVERS.map((item) => ({
            value: item.id,
            label: item.name,
          }))}
          onChange={(value) => setParam("server", value)}
        />
        <ParamToggle
          label="清空选中工具的描述"
          value={blank}
          onChange={(value) => setParam("blank", value)}
          hint="描述为空时模型只能靠名字猜，调用链会停在选工具这一步。"
        />
      </SceneControls>
    </div>
  );
}
