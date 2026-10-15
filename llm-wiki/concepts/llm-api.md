---
type: concept
last_updated: 2026-10-06
id: llm-api
name: LLM API 入门
prerequisites: [ts-basics]
difficulty: 1
estimated_time: 30min
tags: [core, api, prompt, token]
---

# LLM API 入门

## 先来一个故事：你和餐厅后厨

想象你第一次去一家陌生的餐厅。你不是直接冲进厨房炒菜——你坐在桌子前，跟服务员说"来一碗牛肉面"，服务员把你的话传给后厨，后厨做好了，服务员再把面端到你面前。

**LLM API 就是那个服务员。**

- 你 = 你的程序
- 菜单上的字 = 你发给 AI 的文字（叫 Prompt）
- 端上来的面 = AI 返回的文字（叫 Response）
- 服务员 = API（你和后厨之间的"传话通道"）

💡 **核心认知：** API 是你和 AI 之间的"传话筒"。你写文字发过去，AI 回文字给你——就这么简单。

---

## 关键步骤：一次LLM 调用要传齐三件事

> 本节的`###` 子节是**这一讲必须掌握的步骤清单**，讲稿应当逐步覆盖。
> 结构与 `platform-replica.md` 一致，便于自动检测「讲稿漏讲了哪一步」。

每次"传话"，你要告诉服务员三件事——但每件事的**说话人**不同：

### 角色一 ·system：给 AI 定人设

**做什么：** 告诉 AI「你是谁、怎么说话、能做什么不能做什么」。

**例子：** `"你是一个耐心的编程助教"`

**少了会怎样：** AI 不知道自己是老师还是网管，可能用技术黑话解释。

### 角色二 · user：你真正想问的

**做什么：** 把学生/用户真正想问的那句话原样传过去。

**例子：** `"Python 里的变量是什么？"`

### 角色三 · assistant：AI 上一次的回答

**做什么：** 把上一轮 AI 的回答带上，模型才知道"我们前面聊到哪了"。

**例子：** `"变量就像一个贴了标签的盒子…"`

> 🛑 **停一下！** 你能用自己的话说出这三个角色的区别吗？system / user / assistant 各是干什么的？想三秒再看下面。

**答案自检：** system = 给 AI 定规矩（"你是谁"），user = 你真正要说的话，assistant = AI 的上一次回答。如果你分不清 system 和 user，记住：system 像入职培训时的"员工手册"，user 是你每天上班后接到的"任务"。

---

## 每次通话都是"全新的一次"

这是最容易搞错的地方：**AI 不记得上一通电话说了什么。**

聊天 App（比如微信、这个教学平台）之所以看起来"记得"，是因为程序每次都会把**全部历史对话**重新发一遍。AI 自己就是个"看完就忘"的人——你不把上次的对话再抄一遍给它，它就不知道之前聊过啥。

💡 **一句话记住：** AI 是鱼，7 秒记忆。每次调用都把全部聊天记录重新发一遍，它才能"看起来"记得之前的事。

---

## 示范代码

下面是一次完整的 LLM API 调用 —— 就像一次餐厅点餐。**关键看懂三行：** 第③行定规矩、第④行说需求、第⑥行等结果。

> 👉 `callLLM()` 是封装好的函数——**它背后做的事就是发 HTTP 请求**：把 messages 转成 JSON → POST 到模型服务器 → 等回复。你不看内部实现也能用，就像不用懂微波炉怎么加热也能热饭。你只需要看懂传入什么、拿回什么。

```typescript
// ① 准备一份"对话记录"——就像点菜单
const messages = [
  { role: "system", content: "你是一个友好的编程学习助手。" }, // ③ 定人设
  { role: "user", content: "你好，请介绍一下自己。" }, // ④ 提需求
];

// ② 把"点菜单"交给服务员（API）
// ⑤ stream: true = 服务员一边炒菜一边往外端（打字机效果），不用等整碗面炒完
const response = await callLLM({
  model: "deepseek-chat", // ⑥ 进哪个后厨
  messages: messages, // ⑦ 点菜单内容
  stream: true, // ⑧ 边做边上菜
});
```

> 🛑 **关键检查：** 上面对话里，AI 知道"上一句说了什么"吗？—— 不知道，因为我们只传了一条 system 和一条 user。如果想让 AI 知道你之前聊过什么，就要把之前的 assistant 回复也塞进 messages 数组。

---

## 多轮对话：怎么让 AI"记住"

把 messages 想象成一串持续在加的"聊天记录"。**每一轮你都做两件事：**

1. 把你要说的 user 话 **push** 进去
2. 把 AI 回你的 assistant 话也 **push** 进去

下一轮再调用时，AI 就能看到你之前说了什么、它回了什么。

### 具体步骤

```typescript
// 第 0 步：初始化——只放 system
const messages = [
  { role: "system", content: "你是编程助教，解释要简洁。" },
];

// 第 1 轮：问第一个问题
messages.push({ role: "user", content: "什么是变量？" });
const reply1 = await callLLM({ model: "deepseek-chat", messages, stream: true });
messages.push({ role: "assistant", content: reply1 });
// 👆 此时 messages 有 3 条：system + user1 + assistant1

// 第 2 轮：追问——AI 知道上一轮在聊"变量"
messages.push({ role: "user", content: "举个生活中的例子" });
const reply2 = await callLLM({ model: "deepseek-chat", messages, stream: true });
messages.push({ role: "assistant", content: reply2 });
// 👆 此时 messages 有 5 条：system + user1 + assistant1 + user2 + assistant2

// 第 3 轮：继续追问
messages.push({ role: "user", content: "那常量又是什么？" });
const reply3 = await callLLM({ model: "deepseek-chat", messages, stream: true });
// 👆 AI 知道你们在聊变量，而且知道已经举过例子——它可以自然引出"常量就是不会变的变量"
```

> 🛑 **停下来想想：** 如果第 2 轮你忘了 push assistant1，AI 收到的是什么？—— 它只看到 system + user1 + user2，**不知道你上一句问什么、它回了什么**。相当于每次对话都从零开始。

### 一句话记住

**messages 就是一个不断 append 的数组。每次调用 API 时把整条数组传过去。AI 不会主动记——是你帮它"回顾"的。**

---

## 流式输出：不要等整碗面做完

想象你去面馆，师傅有两种做法：

- **不上菜模式（stream: false）：** 师傅在厨房默默做好整碗面，一次性端出来。你等 5 分钟，面一次性出现。
- **上菜模式（stream: true）：** 放一根面、你夹一根——师傅边做边给你。你感觉"在吃到了"，不用干等。

流式输出就是第二种：AI **一个字一个字**往外蹦，不用等全部写完。这就是你看到的"打字机效果"。

---

## ⚠️ 常见错觉（看你自己中了几条）

- 错觉 1："AI 记得我说过的话" → ❌ 每次调用都是独立的。程序在背后帮你把历史对话重新发了一遍。
- 错觉 2："话越多 AI 越懂" → ❌ 精准比长度重要。说清楚要什么，不要说废话。
- 错觉 3："AI 理解我的意思" → ❌ AI 只理解你**写出来的字**。你没写出来的，它猜不到。

---

## 自己动手：你来说

> 请你用自己的话，给一个完全没学过编程的朋友解释：**什么是 LLM API？** 用刚才的"餐厅后厨"例子说。
>
> 然后回答这个：**为什么 AI 看起来"记得"上一句，但实际上不记得？**

## 自己动手：你来写

> 仿照刚才的示范代码，写出一个完整的 `messages` 数组：
>
> - system prompt 设定为"你是高中数学老师，回答要严谨、有推导过程"
> - user 消息为"请用三种方法证明勾股定理"
>
> 写完对照示范代码检查：role 对不对？content 写清楚了吗？少没少逗号？

---

## 相关概念

- [[system-prompt]]
- [[agent-loop]]