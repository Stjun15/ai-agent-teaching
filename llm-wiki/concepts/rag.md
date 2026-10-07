---
type: concept
last_updated: 2026-10-06
id: rag
name: RAG 检索增强生成
prerequisites: [tool-calling]
difficulty: 3
estimated_time: 60min
tags: [core, rag, retrieval]
---

# RAG 检索增强生成

## 先来一个故事：你在一座巨大的图书馆里

你去国家图书馆找一本书。你不能抱着一整座图书馆进阅览室——你只能：

1. **查目录** 📇 → 在电脑上搜"明朝历史"
2. **取书** 📚 → 抱着找到的 3 本书回座位
3. **翻书找答案** 🔍 → "朱元璋哪年建的明朝？" → 翻到第 48 页
4. **写下答案** ✍ → "1368 年"

**RAG 就是 AI 版本的上述过程：** 查目录（检索）→ 取书（拿资料）→ 翻书+写答案（基于资料生成回答）。

---

## RAG 和 LLM Wiki 的区别（别搞混了！）

审计报告说 80% 的学生搞混这两个。一张表说清楚：

|              | RAG 📚                       | LLM Wiki 📖                      |
| ------------ | ---------------------------- | -------------------------------- |
| **比喻**     | 每次去图书馆现查现翻         | 把精华做成一本**百科词典**随身带 |
| **每次提问** | 重新检索原文                 | 直接读已编译好的 Wiki 页面       |
| **适合什么** | 资料经常变（新闻、实时数据） | 资料稳定（课程知识、公司规章）   |
| **成本**     | 每次都要检索，成本随提问涨   | 一次编译，反复用                 |
| **像什么**   | 每次做菜现去买菜             | 提前备好菜，要炒直接拿           |

💡 **一句话：RAG 是"现查现用"，LLM Wiki 是"先整理后用"。资料经常变用 RAG，资料稳定用 Wiki。**

---

## 为什么 AI 需要 RAG（三个致命缺点）

1. **AI 不知道你的私有资料**：你公司的退款政策不在 AI 的训练数据里
2. **AI 的知识有截止日期**：训练数据到 2024 年，不知道 2025 年的事
3. **AI 会瞎编**：不知道的事它也敢编一个答案（这叫"幻觉"）

> 🛑 **停一下！** RAG 能让 AI"访问你的资料"，但它**不能消除 AI 的幻觉**—— AI 拿到资料后还是可能编造。RAG 减少了但没消除这个问题。你能分清"减少"和"消除"的区别吗？

---

## 三步流程

```
用户问 → ①检索（找到相关文档） → ②增强（把文档拼进提示词） → ③生成（AI基于文档回答）
```

## 示范代码

RAG 三步 —— 检索 → 增强 → 生成。给 AI 它本来不知道的知识。

> 👉 `embed()` 和 `cosineSimilarity()` 是数学工具函数——**你不用懂它们怎么算**。只要记住：`embed("你好")` 把一句话变成一串数字（向量），`cosineSimilarity` 比较两串数字的"方向有多像"——方向越一致，两句话越相关。就像你看两个人的购物清单，买的越像说明爱好越近。

```typescript
// ① 私有知识库：你的资料
const knowledgeBase = [
  {
    doc: "退款政策：购买后7天内无条件退款，需保留订单号。",
    source: "refund.md",
  },
  {
    doc: "发票政策：电子发票付款后24小时内发到注册邮箱。",
    source: "invoice.md",
  },
  { doc: "会员规则：年费会员只退未使用月份的费用。", source: "member.md" },
];

// ② 检索：用户问"能退款吗？"→ 在所有文档里找到最相关的 top-3
function retrieve(question: string) {
  const qVector = embed(question); // 把问题转成向量（数字数组）
  const hits = knowledgeBase
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(qVector, embed(entry.doc)), // 算相似度
    }))
    .sort((a, b) => b.score - a.score) // 最相关的排前面
    .slice(0, 3); // 只取 top-3
  return hits;
}

// ③ 增强：把检索结果拼进提示词（编号+来源，方便溯源）
function buildContext(hits: typeof knowledgeBase) {
  if (hits.length === 0) return "（无相关资料）";
  return hits
    .map((h, i) => `[资料${i + 1}] 来源：${h.source}\n${h.doc}`)
    .join("\n\n");
}

// ④ 生成：系统提示词 + 检索资料 + 用户问题 → 发给 AI
async function ask(question: string) {
  const hits = retrieve(question);
  const context = buildContext(hits);
  const response = await callLLM({
    model: "deepseek-chat",
    messages: [
      {
        role: "system",
        content: "你是一个客服。只根据提供的资料回答，资料里没有的就说不知道。",
      },
      {
        role: "user",
        content: `参考资料：\n${context}\n\n用户问题：${question}`,
      },
    ],
  });
  return response;
}

await ask("买完不喜欢能退吗？"); // → "可以。根据退款政策，7天内无条件退款。"
// AI 本来不知道公司的退款政策，经过 RAG 它"看"到了
```

> 🛑 **关键检查：** 如果用户问"端午节礼品什么时候发？"但知识库里没有这条——AI 会怎么回答？—— 系统提示词说了"资料里没有的就说不知道"，所以 AI 应该说"抱歉，没有找到相关信息"。**如果系统提示词没这条，AI 就瞎编了。**

---

## ⚠️ 常见错误

- 错误 1：**以为 RAG 就是搜索** → 搜索只返回链接，RAG 还要让 AI **基于搜到的内容写回答**。多了一步"生成"。
- 错误 2：**检索越多越好** → 塞进 20 条文档，AI 信息过载反而更差。top-3 就够了。
- 错误 3：**忘了在系统提示词里约束 AI** → 不写"资料里没有就说不知道"，AI 拿了资料照样瞎编。

---

## 自己动手：你来说

> 用"图书馆查书"的例子，解释 RAG 的三步：检索 → 增强 → 生成。
>
> 然后回答：**RAG 和 LLM Wiki 最大的区别是什么？在什么情况下用 RAG，什么情况下用 Wiki？**

## 自己动手：你来写

> 你开了一家宠物店，知识库里有3篇文档：
>
> - `grooming.md`：美容预约规则（提前1天预约、迟到15分钟取消）
> - `adopt.md`：领养流程（填表→面谈→试养3天→正式签约）
> - `price.md`：价目表（洗澡80元、剪毛150元、全套200元）
>
> 仿照示范代码的 `knowledgeBase` 格式，写出这个宠物店知识库。
>
> 然后：如果用户问"领养需要几天？"，`buildContext()` 会拼出什么内容？写出来。

---

## 相关概念

- [[tool-calling]]
- [[llm-wiki]]
