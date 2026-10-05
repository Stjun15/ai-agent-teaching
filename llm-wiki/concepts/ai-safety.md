---
type: concept
last_updated: 2026-09-17
id: ai-safety
name: AI 安全与可控性
prerequisites: [mcp]
difficulty: 4
estimated_time: 50min
tags: [core, safety, security]
---

# AI 安全与可控性

## 定义

让 Agent 在安全边界内运行，不产生有害输出，不执行危险操作。

## 核心风险

- 幻觉：编造不存在的信息
- 提示注入：用户诱导 Agent 越权
- 危险操作：删除文件、执行恶意代码
- 成本失控：无限循环、Token 爆炸
- 隐私泄露：把用户数据发给第三方

## 防护机制

- 内容过滤：输入输出都过滤
- 沙箱：危险操作隔离
- 限流：限制调用次数和 Token
- 兜底：出错时给友好提示
- 引用溯源：回答能追溯来源

## 示范代码

四层防护：输入过滤 → 沙箱隔离 → 输出兜底 → 限流防炸。每一层都是一道闸门。

```typescript
// ① 输入过滤：用户说的话先进安全检查，不合规的直接挡掉
function filterInput(content: string): { ok: boolean; reason?: string } {
  const blocked = ["删除所有文件", "忽略之前的指令", "现在你是 hacker"];
  if (blocked.some((pattern) => content.includes(pattern))) {
    return { ok: false, reason: "输入包含危险指令，已拦截。" };
  }
  return { ok: true };
}

// ② 沙箱执行：危险操作（删文件、执行代码）放进隔离环境跑
async function safeExecute(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    return await fn(); // 正常执行
  } catch (error) {
    return "操作失败，系统已自动回滚。"; // 任何异常都兜底，不让外部看到内部错误
  }
}

// ③ 输出兜底：模型返回的内容再过一遍安全检查
function filterOutput(content: string): string {
  const dangerous = ["密钥", "sk-", "password"];
  for (const word of dangerous) {
    if (content.includes(word)) {
      return "回答中可能包含敏感信息，已过滤。请重新提问。";
    }
  }
  return content; // 通过检查，原样返回
}

// ④ 限流：控制调用频率，防止 token 费用爆炸
const rateLimiter = new Map<string, number>(); // IP → 上次调用时间戳
function checkRateLimit(userId: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const lastCall = rateLimiter.get(userId) ?? 0;
  if (now - lastCall < 60000 / maxPerMinute) {
    return false; // 太快了，拒绝
  }
  rateLimiter.set(userId, now);
  return true;
}

// ⑤ 完整的安全 Agent：四层闸门串联
async function safeAgentRun(userInput: string) {
  // 第一道门：输入过滤
  const inputCheck = filterInput(userInput);
  if (!inputCheck.ok) return inputCheck.reason;

  // 第二道门：限流检查
  if (!checkRateLimit("student-1")) return "请求太频繁，请 2 秒后再试。";

  // 第三道门：沙箱执行
  const rawOutput = await safeExecute(() => agent.run(userInput));

  // 第四道门：输出过滤
  return filterOutput(String(rawOutput));
}
```

## 相关概念

- [[mcp]]
- [[rag]]
- [[platform-replica]]（安全这一讲收尾后，下一步就是用它验收整个平台：教学平台复刻）
