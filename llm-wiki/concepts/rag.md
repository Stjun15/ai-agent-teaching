---
type: concept
last_updated: 2026-09-19
id: rag
name: RAG 检索增强生成
prerequisites: [tool-calling]
difficulty: 4
estimated_time: 60min
tags: [core, rag, retrieval]
---

# RAG 检索增强生成

## 定义

RAG = Retrieval + Augmented + Generation。
先检索相关资料，再让 AI 基于资料生成回答。

## 为什么需要 RAG

- AI 不知道你的私有资料
- AI 的知识有截止日期
- AI 会幻觉，编造不存在的内容

## 核心流程

1. 用户提问
2. 检索相关资料（向量检索）
3. 把资料和问题一起发给 AI
4. AI 基于资料生成回答
5. 标注引用来源

## 关键概念

- 向量检索：把文本转成向量，找最相似的
- 知识边界：AI 只能基于检索到的内容回答
- 引用溯源：每条回答都要能追溯到来源

## 示范代码

RAG 三步：检索 → 增强 → 生成。给 AI 配上知识库，回答它本来不知道的事。

```typescript
// ① 私有知识库：公司政策、产品文档等——这些内容不在模型的训练数据里
const knowledgeBase = [
  { doc: "退款政策：购买后 7 天内无条件退款，需保留订单号。", source: "refund.md" },
  { doc: "发票政策：电子发票付款后 24 小时内发送到注册邮箱。", source: "invoice.md" },
  { doc: "会员规则：年费会员只退未使用月份的费用。", source: "member.md" },
];

// ② 向量化：把每条文档转成向量（数字数组），提前算好存起来
const vectors = knowledgeBase.map((entry) => embed(entry.doc));

// ③ 检索（Retrieval）：用户提问 → 把问题也向量化 → 找最相似的 top-3 文档
function retrieve(question: string, k: number = 3) {
  const qVector = embed(question);                            // 问题 → 向量
  const scores = vectors.map((v) => cosineSimilarity(qVector, v)); // 算相似度
  const topK = scores
    .map((s, i) => ({ score: s, ...knowledgeBase[i] }))       // 带上原文
    .sort((a, b) => b.score - a.score)                        // 相似度高的排前面
    .slice(0, k);                                             // 取 top-K
  return topK;
}

// ④ 增强（Augmented）：把检索到的文档拼成上下文区块，编号 + 来源
function buildContext(hits: typeof knowledgeBase) {
  if (hits.length === 0) return "（无相关资料）";
  return hits
    .map((h, i) => `[资料 ${i + 1}] 来源：${h.source}\n${h.doc}`)
    .join("\n\n");
}

// ⑤ 生成（Generation）：系统提示词 + 检索资料 + 用户问题 → 一起发给模型
async function ask(question: string) {
  const hits = retrieve(question);
  const context = buildContext(hits);
  const response = await callLLM({
    model: "deepseek-chat",
    messages: [
      { role: "system", content: "你是一个客服。只根据提供的资料回答，资料里没有的就说不知道。" },
      { role: "user", content: `参考资料：\n${context}\n\n用户问题：${question}` },
    ],
  });
  return response;
}

// ⑥ 模型本来不知道公司的退款政策，但经过 RAG，它能准确回答
await ask("买完不喜欢能退吗？"); // → "可以。根据退款政策，7 天内无条件退款。"
```

## 常见误解

- 误解1：RAG 就是搜索 → 它比搜索多了生成
- 误解2：检索越多越好 → 太多会干扰 AI
- 误解3：RAG 能解决幻觉 → 它减少幻觉，但不能消除

## 相关概念

- [[tool-calling]]
- [[llm-wiki]]